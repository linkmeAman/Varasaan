from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session_dep, get_current_user
from app.core.config import get_settings
from app.models import User
from app.schemas.exports import ExportDownloadResponse, ExportJobResponse, ExportTokenResponse
from app.services import exports as export_service
from app.workers.tasks import enqueue_export_job

router = APIRouter(prefix="/exports", tags=["exports"])


@router.post("", response_model=ExportJobResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_export(user: User = Depends(get_current_user), db: AsyncSession = Depends(db_session_dep)) -> ExportJobResponse:
    job = await export_service.create_export_job(db, user.id)
    settings = get_settings()
    if settings.celery_task_always_eager:
        job = await export_service.process_export_job(db, job.id)
    else:
        await db.commit()
        await db.refresh(job)
        enqueue_export_job(job.id)
    return ExportJobResponse(id=job.id, status=job.status.value)


@router.get("/{export_job_id}", response_model=ExportJobResponse)
async def get_export(export_job_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(db_session_dep)) -> ExportJobResponse:
    job = await export_service.get_export_job_for_user(db, user.id, export_job_id)
    return ExportJobResponse(id=job.id, status=job.status.value)


@router.post("/{export_job_id}/token", response_model=ExportTokenResponse)
async def issue_download_token(
    export_job_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dep),
) -> ExportTokenResponse:
    token, expires_at = await export_service.issue_one_time_download_token(db, user.id, export_job_id)
    return ExportTokenResponse(one_time_token=token, expires_at=expires_at)


@router.get("/{export_job_id}/download", response_model=ExportDownloadResponse)
async def owner_download(
    export_job_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dep),
) -> ExportDownloadResponse:
    settings = get_settings()
    url = await export_service.build_owner_download_url(db, user.id, export_job_id)
    return ExportDownloadResponse(download_url=url, expires_in_seconds=settings.download_url_ttl_minutes * 60)


@router.get("/{export_job_id}/download-by-token", response_model=ExportDownloadResponse)
async def token_download(
    export_job_id: str,
    token: str = Query(..., min_length=16),
    db: AsyncSession = Depends(db_session_dep),
) -> ExportDownloadResponse:
    settings = get_settings()
    url = await export_service.consume_token_and_build_download_url(db, export_job_id, token)
    return ExportDownloadResponse(download_url=url, expires_in_seconds=settings.download_url_ttl_minutes * 60)
