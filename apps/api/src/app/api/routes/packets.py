from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session_dep, get_current_user
from app.core.config import get_settings
from app.models import User
from app.schemas.packets import PacketGenerateRequest, PacketJobResponse
from app.services import packets as packet_service
from app.workers.tasks import enqueue_packet_job

router = APIRouter(prefix="/packets", tags=["packets"])


@router.post("", response_model=PacketJobResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_packet_job(
    payload: PacketGenerateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dep),
) -> PacketJobResponse:
    job = await packet_service.create_packet_job(db, user.id, payload.platform)
    settings = get_settings()
    if settings.celery_task_always_eager:
        job = await packet_service.process_packet_job(db, job.id, worker_id="inline-worker")
    else:
        await db.commit()
        await db.refresh(job)
        enqueue_packet_job(job.id)
    return PacketJobResponse(id=job.id, status=job.status.value, platform=job.platform)


@router.get("/{packet_job_id}", response_model=PacketJobResponse)
async def get_packet_job(
    packet_job_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dep),
) -> PacketJobResponse:
    job = await packet_service.get_packet_job_for_user(db, user.id, packet_job_id)
    return PacketJobResponse(id=job.id, status=job.status.value, platform=job.platform)
