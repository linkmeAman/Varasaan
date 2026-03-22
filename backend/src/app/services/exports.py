from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.datetime_utils import as_utc
from app.core.security import generate_token_secret, hash_token
from app.integrations.aws import AwsDependencyError, get_aws_storage_crypto_service
from app.models import Document, DocumentState, DocumentVersion, ExportJob, ExportJobStatus


async def create_export_job(db: AsyncSession, user_id: str) -> ExportJob:
    job = ExportJob(user_id=user_id, status=ExportJobStatus.QUEUED)
    db.add(job)
    await db.flush()
    return job


async def get_export_job_for_user(db: AsyncSession, user_id: str, export_job_id: str) -> ExportJob:
    job = await db.get(ExportJob, export_job_id)
    if not job or job.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Export job not found")
    return job


async def _build_export_payload(db: AsyncSession, user_id: str) -> bytes:
    result = await db.execute(
        select(Document, DocumentVersion)
        .join(DocumentVersion, Document.current_version_id == DocumentVersion.id, isouter=True)
        .where(Document.user_id == user_id)
        .where(Document.state != DocumentState.PURGED)
    )
    docs = []
    for document, current_version in result.all():
        docs.append(
            {
                "document_id": document.id,
                "doc_type": document.doc_type,
                "state": document.state.value,
                "current_version_id": document.current_version_id,
                "object_key": current_version.object_key if current_version else None,
                "size_bytes": current_version.size_bytes if current_version else None,
                "created_at": document.created_at.isoformat(),
            }
        )
    payload = {"exported_at": datetime.now(UTC).isoformat(), "documents": docs}
    return json.dumps(payload, separators=(",", ":"), ensure_ascii=True).encode("utf-8")


async def process_export_job(db: AsyncSession, export_job_id: str) -> ExportJob:
    settings = get_settings()
    job = await db.get(ExportJob, export_job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Export job not found")
    if job.status == ExportJobStatus.READY:
        return job
    if job.status == ExportJobStatus.FAILED:
        return job

    job.status = ExportJobStatus.PROCESSING
    await db.flush()

    object_key = f"exports/{job.user_id}/{job.id}.json"
    try:
        payload = await _build_export_payload(db, job.user_id)
        await get_aws_storage_crypto_service().upload_bytes(
            bucket=settings.s3_bucket_exports,
            object_key=object_key,
            payload=payload,
            content_type="application/json",
        )
    except AwsDependencyError as exc:
        job.status = ExportJobStatus.FAILED
        await db.flush()
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except Exception as exc:
        job.status = ExportJobStatus.FAILED
        await db.flush()
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Export artifact generation failed") from exc

    job.artifact_key = object_key
    job.status = ExportJobStatus.READY
    job.expires_at = datetime.now(UTC) + timedelta(hours=settings.export_bundle_ttl_hours)
    await db.flush()
    return job


async def issue_one_time_download_token(db: AsyncSession, user_id: str, export_job_id: str) -> tuple[str, datetime]:
    settings = get_settings()
    job = await get_export_job_for_user(db, user_id, export_job_id)
    if job.status != ExportJobStatus.READY:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Export not ready")
    if not job.artifact_key:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Export artifact missing")
    expires_at = as_utc(job.expires_at)
    if expires_at is not None and expires_at < datetime.now(UTC):
        job.status = ExportJobStatus.EXPIRED
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Export expired")

    token = generate_token_secret()
    expires_at = datetime.now(UTC) + timedelta(minutes=settings.export_download_token_ttl_minutes)
    job.download_token_hash = hash_token(token)
    job.download_token_expires_at = expires_at
    job.download_consumed_at = None
    await db.flush()
    return token, expires_at


async def _validate_one_time_token(db: AsyncSession, export_job_id: str, one_time_token: str) -> ExportJob:
    job = await db.get(ExportJob, export_job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Export job not found")
    if job.status != ExportJobStatus.READY:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Export not ready")
    if job.download_consumed_at is not None:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Download token already consumed")
    if not job.download_token_hash or not job.download_token_expires_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Download token not issued")
    download_token_expires_at = as_utc(job.download_token_expires_at)
    if download_token_expires_at is None or download_token_expires_at < datetime.now(UTC):
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Download token expired")
    if hash_token(one_time_token) != job.download_token_hash:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid download token")
    return job


async def build_owner_download_url(db: AsyncSession, user_id: str, export_job_id: str) -> str:
    settings = get_settings()
    job = await get_export_job_for_user(db, user_id, export_job_id)
    if job.status != ExportJobStatus.READY:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Export not ready")
    if not job.artifact_key:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Export artifact missing")
    expires_at = as_utc(job.expires_at)
    if expires_at is not None and expires_at < datetime.now(UTC):
        job.status = ExportJobStatus.EXPIRED
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Export expired")
    try:
        return await get_aws_storage_crypto_service().presign_download(
            bucket=settings.s3_bucket_exports,
            object_key=job.artifact_key,
            expires_seconds=settings.download_url_ttl_minutes * 60,
        )
    except AwsDependencyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Unable to sign export download URL") from exc


async def consume_token_and_build_download_url(db: AsyncSession, export_job_id: str, one_time_token: str) -> str:
    settings = get_settings()
    job = await _validate_one_time_token(db, export_job_id, one_time_token)
    if not job.artifact_key:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Export artifact missing")

    job.download_consumed_at = datetime.now(UTC)
    await db.flush()
    try:
        return await get_aws_storage_crypto_service().presign_download(
            bucket=settings.s3_bucket_exports,
            object_key=job.artifact_key,
            expires_seconds=settings.download_url_ttl_minutes * 60,
        )
    except AwsDependencyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Unable to sign export download URL") from exc
