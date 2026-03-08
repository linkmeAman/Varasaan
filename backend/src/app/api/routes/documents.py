from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session_dep, get_current_user
from app.core.config import get_settings
from app.models import User
from app.schemas.common import ApiMessage
from app.schemas.documents import (
    DocumentDownloadResponse,
    GrantCreateRequest,
    ScanDispatchResponse,
    UploadInitRequest,
    UploadInitResponse,
)
from app.services import documents as document_service
from app.workers.tasks import enqueue_malware_scan

router = APIRouter(prefix="/documents", tags=["documents"])


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
