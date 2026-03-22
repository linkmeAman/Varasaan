from __future__ import annotations

import base64
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.datetime_utils import as_utc
from app.integrations.aws import AwsDependencyError, get_aws_storage_crypto_service
from app.integrations.malware_scan import MalwareScanError, get_malware_scan_client
from app.models import (
    Document,
    DocumentAccessGrant,
    DocumentState,
    DocumentVersion,
    MalwareScan,
    MalwareScanStatus,
    TrustedContact,
    TrustedContactStatus,
)
from app.schemas.documents import UploadInitRequest

ALLOWED_TRANSITIONS: dict[DocumentState, set[DocumentState]] = {
    DocumentState.UPLOAD_PENDING: {DocumentState.QUARANTINED, DocumentState.SCAN_FAILED, DocumentState.ACTIVE},
    DocumentState.QUARANTINED: {DocumentState.SCAN_FAILED, DocumentState.ACTIVE},
    DocumentState.SCAN_FAILED: {DocumentState.SOFT_DELETED, DocumentState.PURGED},
    DocumentState.ACTIVE: {DocumentState.SOFT_DELETED, DocumentState.PURGED},
    DocumentState.SOFT_DELETED: {DocumentState.PURGED},
    DocumentState.PURGED: set(),
}


@dataclass(slots=True)
class UploadInitResult:
    document: Document
    version: DocumentVersion
    upload_url: str
    plaintext_dek_b64: str
    kms_key_id: str


def _validate_transition(old: DocumentState, new: DocumentState) -> None:
    if new not in ALLOWED_TRANSITIONS.get(old, set()):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid document state transition")


async def _current_day_upload_bytes(db: AsyncSession, user_id: str) -> int:
    now = datetime.now(UTC)
    start = datetime(now.year, now.month, now.day, tzinfo=UTC)
    result = await db.execute(
        select(func.coalesce(func.sum(DocumentVersion.size_bytes), 0))
        .join(Document, DocumentVersion.document_id == Document.id)
        .where(and_(Document.user_id == user_id, DocumentVersion.created_at >= start))
    )
    return int(result.scalar_one())


async def _document_count(db: AsyncSession, user_id: str) -> int:
    result = await db.execute(select(func.count(Document.id)).where(Document.user_id == user_id))
    return int(result.scalar_one())


def _build_object_key(user_id: str, document_id: str, version_no: int) -> str:
    return f"documents/{user_id}/{document_id}/{version_no}.enc"


async def _generate_upload_material(
    *,
    user_id: str,
    document_id: str,
    version_no: int,
    content_type: str,
) -> tuple[str, str, bytes, str, str]:
    settings = get_settings()
    service = get_aws_storage_crypto_service()
    object_key = _build_object_key(user_id, document_id, version_no)
    encryption_context = {"user_id": user_id, "document_id": document_id, "version_no": str(version_no)}
    try:
        data_key = await service.generate_data_key(encryption_context=encryption_context)
        upload_url = await service.presign_upload(
            object_key=object_key,
            expires_seconds=settings.upload_url_ttl_minutes * 60,
            content_type=content_type,
            bucket=settings.s3_bucket_documents,
        )
    except AwsDependencyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Unable to initialize secure upload") from exc

    return (
        object_key,
        upload_url,
        base64.b64decode(data_key.encrypted_key_b64),
        data_key.plaintext_key_b64,
        data_key.kms_key_id,
    )


async def _create_malware_scan_record(db: AsyncSession, version_id: str) -> MalwareScan:
    scan = MalwareScan(version_id=version_id, status=MalwareScanStatus.PENDING, attempts=0)
    db.add(scan)
    await db.flush()
    return scan


async def init_document_upload(db: AsyncSession, user_id: str, payload: UploadInitRequest) -> UploadInitResult:
    settings = get_settings()
    if payload.size_bytes > settings.max_upload_size_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Document exceeds 50MB limit")
    if await _document_count(db, user_id) >= settings.max_documents_per_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Document limit reached")

    uploaded_today = await _current_day_upload_bytes(db, user_id)
    if uploaded_today + payload.size_bytes > settings.daily_upload_quota_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Daily upload quota exceeded")

    document = Document(user_id=user_id, doc_type=payload.doc_type, state=DocumentState.UPLOAD_PENDING)
    db.add(document)
    await db.flush()

    object_key, upload_url, encrypted_dek, plaintext_dek, kms_key_id = await _generate_upload_material(
        user_id=user_id,
        document_id=document.id,
        version_no=1,
        content_type=payload.content_type,
    )
    version = DocumentVersion(
        document_id=document.id,
        version_no=1,
        state=DocumentState.QUARANTINED,
        object_key=object_key,
        encrypted_dek=encrypted_dek,
        kms_key_id=kms_key_id,
        size_bytes=payload.size_bytes,
        sha256=payload.sha256,
    )
    db.add(version)
    document.state = DocumentState.QUARANTINED
    await db.flush()
    await _create_malware_scan_record(db, version.id)

    return UploadInitResult(document, version, upload_url, plaintext_dek, kms_key_id)


async def add_document_version(db: AsyncSession, user_id: str, document_id: str, payload: UploadInitRequest) -> UploadInitResult:
    settings = get_settings()
    if payload.size_bytes > settings.max_upload_size_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Document exceeds 50MB limit")
    uploaded_today = await _current_day_upload_bytes(db, user_id)
    if uploaded_today + payload.size_bytes > settings.daily_upload_quota_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Daily upload quota exceeded")

    document = await db.get(Document, document_id)
    if not document or document.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if document.state in {DocumentState.SOFT_DELETED, DocumentState.PURGED}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Document is deleted")

    result = await db.execute(select(func.coalesce(func.max(DocumentVersion.version_no), 0)).where(DocumentVersion.document_id == document_id))
    next_version_no = int(result.scalar_one()) + 1

    object_key, upload_url, encrypted_dek, plaintext_dek, kms_key_id = await _generate_upload_material(
        user_id=user_id,
        document_id=document_id,
        version_no=next_version_no,
        content_type=payload.content_type,
    )
    version = DocumentVersion(
        document_id=document_id,
        version_no=next_version_no,
        state=DocumentState.QUARANTINED,
        object_key=object_key,
        encrypted_dek=encrypted_dek,
        kms_key_id=kms_key_id,
        size_bytes=payload.size_bytes,
        sha256=payload.sha256,
    )
    db.add(version)
    document.state = DocumentState.QUARANTINED
    await db.flush()
    await _create_malware_scan_record(db, version.id)
    return UploadInitResult(document, version, upload_url, plaintext_dek, kms_key_id)


async def mark_scan_running(db: AsyncSession, version_id: str, attempt_increment: bool = True) -> MalwareScan:
    result = await db.execute(select(MalwareScan).where(MalwareScan.version_id == version_id))
    scan = result.scalars().first()
    if not scan:
        scan = MalwareScan(version_id=version_id)
        db.add(scan)
        await db.flush()

    scan.status = MalwareScanStatus.RUNNING
    scan.started_at = datetime.now(UTC)
    scan.last_error = None
    if attempt_increment:
        scan.attempts += 1
    await db.flush()
    return scan


async def apply_scan_result_for_version(
    db: AsyncSession,
    *,
    version_id: str,
    scan_passed: bool,
    provider_scan_id: str | None = None,
    summary: str | None = None,
) -> Document:
    version = await db.get(DocumentVersion, version_id)
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")
    document = await db.get(Document, version.document_id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    target = DocumentState.ACTIVE if scan_passed else DocumentState.SCAN_FAILED
    _validate_transition(version.state, target)
    version.state = target

    result = await db.execute(select(MalwareScan).where(MalwareScan.version_id == version_id))
    scan = result.scalars().first()
    if scan:
        scan.status = MalwareScanStatus.CLEAN if scan_passed else MalwareScanStatus.INFECTED
        scan.provider_scan_id = provider_scan_id
        scan.completed_at = datetime.now(UTC)
        scan.result_summary = summary
        scan.last_error = None

    if scan_passed:
        document.current_version_id = version.id
        document.state = DocumentState.ACTIVE
    else:
        document.state = DocumentState.SCAN_FAILED
        settings = get_settings()
        version.scan_failed_purge_at = datetime.now(UTC) + timedelta(days=settings.scan_failed_purge_after_days)

    await db.flush()
    from app.services.case_activity import record_case_evidence_scan_result_for_document

    await record_case_evidence_scan_result_for_document(
        db,
        document_id=document.id,
        scan_passed=scan_passed,
        summary=summary,
    )
    return document


async def mark_scan_error(db: AsyncSession, *, version_id: str, error: str) -> None:
    result = await db.execute(select(MalwareScan).where(MalwareScan.version_id == version_id))
    scan = result.scalars().first()
    if not scan:
        scan = MalwareScan(version_id=version_id)
        db.add(scan)
        await db.flush()

    scan.status = MalwareScanStatus.ERROR
    scan.last_error = error[:500]
    scan.completed_at = datetime.now(UTC)
    await db.flush()

    version = await db.get(DocumentVersion, version_id)
    if version is None:
        return

    from app.services.case_activity import record_case_evidence_scan_result_for_document

    await record_case_evidence_scan_result_for_document(
        db,
        document_id=version.document_id,
        scan_passed=False,
        summary=error[:500],
    )


async def apply_scan_result(db: AsyncSession, user_id: str, version_id: str, scan_passed: bool) -> Document:
    version = await db.get(DocumentVersion, version_id)
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")

    document = await db.get(Document, version.document_id)
    if not document or document.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    return await apply_scan_result_for_version(db, version_id=version_id, scan_passed=scan_passed)


async def soft_delete_document(db: AsyncSession, user_id: str, document_id: str) -> None:
    document = await db.get(Document, document_id)
    if not document or document.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    _validate_transition(document.state, DocumentState.SOFT_DELETED)
    document.state = DocumentState.SOFT_DELETED
    document.deleted_at = datetime.now(UTC)


async def can_decrypt_document(db: AsyncSession, user_id: str, document_id: str, trusted_contact_id: str | None = None) -> bool:
    document = await db.get(Document, document_id)
    if not document or document.state != DocumentState.ACTIVE:
        return False

    if document.user_id == user_id:
        return True

    if trusted_contact_id:
        contact = await db.get(TrustedContact, trusted_contact_id)
        if not contact or contact.status != TrustedContactStatus.ACTIVE:
            return False

        result = await db.execute(
            select(DocumentAccessGrant).where(
                DocumentAccessGrant.document_id == document_id,
                DocumentAccessGrant.granted_to_contact_id == trusted_contact_id,
            )
        )
        grant = result.scalars().first()
        if not grant:
            return False
        if grant.revoked_at is not None:
            return False
        expires_at = as_utc(grant.expires_at)
        if expires_at is not None and expires_at < datetime.now(UTC):
            return False
        return True

    return False


async def get_document_download_url(db: AsyncSession, document_id: str) -> str:
    document = await db.get(Document, document_id)
    if not document or not document.current_version_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active document version not found")
    version = await db.get(DocumentVersion, document.current_version_id)
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active document version not found")

    settings = get_settings()
    try:
        return await get_aws_storage_crypto_service().presign_download(
            object_key=version.object_key,
            bucket=settings.s3_bucket_documents,
            expires_seconds=settings.download_url_ttl_minutes * 60,
        )
    except AwsDependencyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Unable to sign download URL") from exc


async def create_access_grant(
    db: AsyncSession,
    user_id: str,
    document_id: str,
    trusted_contact_id: str,
    granted_reason: str | None,
    expires_in_hours: int | None,
) -> DocumentAccessGrant:
    document = await db.get(Document, document_id)
    if not document or document.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    contact = await db.get(TrustedContact, trusted_contact_id)
    if not contact or contact.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trusted contact not found")

    expires_at = datetime.now(UTC) + timedelta(hours=expires_in_hours) if expires_in_hours else None
    grant = DocumentAccessGrant(
        document_id=document_id,
        granted_to_contact_id=trusted_contact_id,
        granted_reason=granted_reason,
        expires_at=expires_at,
    )
    db.add(grant)
    await db.flush()
    return grant


async def purge_scan_failed_versions(db: AsyncSession) -> int:
    now = datetime.now(UTC)
    result = await db.execute(
        select(DocumentVersion).where(
            DocumentVersion.state == DocumentState.SCAN_FAILED,
            DocumentVersion.scan_failed_purge_at.is_not(None),
            DocumentVersion.scan_failed_purge_at < now,
        )
    )
    purged = 0
    for version in result.scalars().all():
        version.state = DocumentState.PURGED
        purged += 1
    return purged


async def get_document_for_user(db: AsyncSession, user_id: str, document_id: str) -> Document:
    document = await db.get(Document, document_id)
    if not document or document.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return document


async def get_version_for_user(db: AsyncSession, user_id: str, version_id: str) -> DocumentVersion:
    version = await db.get(DocumentVersion, version_id)
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")
    document = await db.get(Document, version.document_id)
    if not document or document.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")
    return version


async def list_documents_for_user(db: AsyncSession, user_id: str) -> list[Document]:
    result = await db.execute(
        select(Document).where(Document.user_id == user_id).order_by(Document.created_at.desc())
    )
    return list(result.scalars().all())


async def list_versions_for_document(db: AsyncSession, document_id: str) -> list[DocumentVersion]:
    result = await db.execute(
        select(DocumentVersion)
        .where(DocumentVersion.document_id == document_id)
        .order_by(DocumentVersion.version_no.desc())
    )
    return list(result.scalars().all())


async def get_scan_for_version(db: AsyncSession, version_id: str) -> MalwareScan | None:
    result = await db.execute(select(MalwareScan).where(MalwareScan.version_id == version_id))
    return result.scalars().first()


async def orchestrate_malware_scan(db: AsyncSession, version_id: str) -> MalwareScan:
    settings = get_settings()
    version = await db.get(DocumentVersion, version_id)
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")

    scan = await mark_scan_running(db, version_id=version_id, attempt_increment=True)
    try:
        object_url = await get_aws_storage_crypto_service().presign_download(
            object_key=version.object_key,
            bucket=settings.s3_bucket_documents,
            expires_seconds=settings.malware_scan_presign_ttl_seconds,
        )
        outcome = await get_malware_scan_client().scan_object(
            object_url=object_url,
            object_key=version.object_key,
            version_id=version.id,
        )
    except AwsDependencyError as exc:
        await mark_scan_error(db, version_id=version_id, error=str(exc))
        return scan
    except MalwareScanError as exc:
        await mark_scan_error(db, version_id=version_id, error=str(exc))
        return scan
    except Exception as exc:
        await mark_scan_error(db, version_id=version_id, error=f"malware_scan_unhandled:{exc}")
        return scan

    await apply_scan_result_for_version(
        db,
        version_id=version_id,
        scan_passed=outcome.scan_passed,
        provider_scan_id=outcome.provider_scan_id,
        summary=outcome.summary,
    )
    refreshed = await db.execute(select(MalwareScan).where(MalwareScan.version_id == version_id))
    return refreshed.scalars().first() or scan

