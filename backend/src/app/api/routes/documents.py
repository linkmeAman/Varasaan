from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session_dep, get_current_user
from app.core.config import get_settings
from app.models import DocumentVersion, User
from app.schemas.common import ApiMessage
from app.schemas.documents import (
    DocumentDetailResponse,
    DocumentDownloadResponse,
    DocumentSummaryResponse,
    DocumentVersionStatusResponse,
    GrantCreateRequest,
    ScanDispatchResponse,
    UploadInitRequest,
    UploadInitResponse,
)
from app.services import documents as document_service
from app.workers.tasks import enqueue_malware_scan

router = APIRouter(prefix="/documents", tags=["documents"])


def _version_response(version: DocumentVersion, scan_status: str | None = None, scan_summary: str | None = None) -> DocumentVersionStatusResponse:
    return DocumentVersionStatusResponse(
        id=version.id,
        document_id=version.document_id,
        version_no=version.version_no,
        state=version.state.value,
        object_key=version.object_key,
        size_bytes=version.size_bytes,
        sha256=version.sha256,
        created_at=version.created_at,
        scan_status=scan_status,
        scan_summary=scan_summary,
        scan_failed_purge_at=version.scan_failed_purge_at,
    )


@router.post("/uploads/init", response_model=UploadInitResponse, status_code=status.HTTP_201_CREATED)
async def init_upload(
    payload: UploadInitRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dep),
) -> UploadInitResponse:
    result = await document_service.init_document_upload(db, user.id, payload)
    settings = get_settings()
    return UploadInitResponse(
        document_id=result.document.id,
        version_id=result.version.id,
        version_no=result.version.version_no,
        object_key=result.version.object_key,
        upload_url=result.upload_url,
        upload_url_expires_in_seconds=settings.upload_url_ttl_minutes * 60,
        plaintext_dek_b64=result.plaintext_dek_b64,
        kms_key_id=result.kms_key_id,
    )


@router.get("", response_model=list[DocumentSummaryResponse])
async def list_documents(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dep),
) -> list[DocumentSummaryResponse]:
    documents = await document_service.list_documents_for_user(db, user.id)
    response: list[DocumentSummaryResponse] = []
    for document in documents:
        current_version = None
        if document.current_version_id:
            version = await db.get(DocumentVersion, document.current_version_id)
            if version:
                scan = await document_service.get_scan_for_version(db, version.id)
                current_version = _version_response(
                    version,
                    scan_status=scan.status.value if scan else None,
                    scan_summary=scan.result_summary if scan else None,
                )

        response.append(
            DocumentSummaryResponse(
                id=document.id,
                doc_type=document.doc_type,
                state=document.state.value,
                current_version_id=document.current_version_id,
                created_at=document.created_at,
                deleted_at=document.deleted_at,
                current_version=current_version,
            )
        )
    return response


@router.get("/{document_id}", response_model=DocumentDetailResponse)
async def get_document(
    document_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dep),
) -> DocumentDetailResponse:
    document = await document_service.get_document_for_user(db, user.id, document_id)
    versions = await document_service.list_versions_for_document(db, document_id)

    version_responses: list[DocumentVersionStatusResponse] = []
    current_version_response: DocumentVersionStatusResponse | None = None
    for version in versions:
        scan = await document_service.get_scan_for_version(db, version.id)
        serialized = _version_response(
            version,
            scan_status=scan.status.value if scan else None,
            scan_summary=scan.result_summary if scan else None,
        )
        version_responses.append(serialized)
        if version.id == document.current_version_id:
            current_version_response = serialized

    return DocumentDetailResponse(
        id=document.id,
        doc_type=document.doc_type,
        state=document.state.value,
        current_version_id=document.current_version_id,
        created_at=document.created_at,
        deleted_at=document.deleted_at,
        current_version=current_version_response,
        versions=version_responses,
    )


@router.get("/versions/{version_id}", response_model=DocumentVersionStatusResponse)
async def get_document_version(
    version_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dep),
) -> DocumentVersionStatusResponse:
    version = await document_service.get_version_for_user(db, user.id, version_id)
    scan = await document_service.get_scan_for_version(db, version_id)
    return _version_response(
        version,
        scan_status=scan.status.value if scan else None,
        scan_summary=scan.result_summary if scan else None,
    )


@router.post("/{document_id}/versions/init", response_model=UploadInitResponse, status_code=status.HTTP_201_CREATED)
async def init_upload_version(
    document_id: str,
    payload: UploadInitRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dep),
) -> UploadInitResponse:
    result = await document_service.add_document_version(db, user.id, document_id, payload)
    settings = get_settings()
    return UploadInitResponse(
        document_id=result.document.id,
        version_id=result.version.id,
        version_no=result.version.version_no,
        object_key=result.version.object_key,
        upload_url=result.upload_url,
        upload_url_expires_in_seconds=settings.upload_url_ttl_minutes * 60,
        plaintext_dek_b64=result.plaintext_dek_b64,
        kms_key_id=result.kms_key_id,
    )


@router.post("/versions/{version_id}/scan", response_model=ScanDispatchResponse)
async def queue_scan(
    version_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dep),
) -> ScanDispatchResponse:
    await document_service.get_version_for_user(db, user.id, version_id)
    settings = get_settings()
    if settings.celery_task_always_eager:
        await document_service.orchestrate_malware_scan(db, version_id)
        return ScanDispatchResponse(version_id=version_id, status="processed")
    enqueue_malware_scan(version_id)
    return ScanDispatchResponse(version_id=version_id, status="queued")


@router.get("/{document_id}/download", response_model=DocumentDownloadResponse)
async def get_download_url(
    document_id: str,
    trusted_contact_id: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dep),
) -> DocumentDownloadResponse:
    allowed = await document_service.can_decrypt_document(db, user.id, document_id, trusted_contact_id=trusted_contact_id)
    if not allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    settings = get_settings()
    download_url = await document_service.get_document_download_url(db, document_id)
    return DocumentDownloadResponse(
        download_url=download_url,
        expires_in_seconds=settings.download_url_ttl_minutes * 60,
    )


@router.post("/{document_id}/grants", response_model=ApiMessage)
async def create_grant(
    document_id: str,
    payload: GrantCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dep),
) -> ApiMessage:
    await document_service.create_access_grant(
        db,
        user.id,
        document_id,
        payload.trusted_contact_id,
        payload.granted_reason,
        payload.expires_in_hours,
    )
    return ApiMessage(message="Access grant created")


@router.delete("/{document_id}", response_model=ApiMessage)
async def delete_document(
    document_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dep),
) -> ApiMessage:
    await document_service.soft_delete_document(db, user.id, document_id)
    return ApiMessage(message="Document soft-deleted")
