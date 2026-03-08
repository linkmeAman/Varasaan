from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.integrations.aws import AwsDependencyError, get_aws_storage_crypto_service
from app.models import Document, DocumentState, PacketJob, PacketJobStatus


async def create_packet_job(db: AsyncSession, user_id: str, platform: str) -> PacketJob:
    job = PacketJob(user_id=user_id, platform=platform, status=PacketJobStatus.QUEUED)
    db.add(job)
    await db.flush()
    return job


async def get_packet_job_for_user(db: AsyncSession, user_id: str, packet_job_id: str) -> PacketJob:
    job = await db.get(PacketJob, packet_job_id)
    if not job or job.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Packet job not found")
    return job


async def _build_packet_artifact(db: AsyncSession, user_id: str, platform: str) -> bytes:
    docs_result = await db.execute(
        select(Document).where(Document.user_id == user_id).where(Document.state == DocumentState.ACTIVE)
    )
    docs = [
        {
            "document_id": doc.id,
            "doc_type": doc.doc_type,
            "current_version_id": doc.current_version_id,
            "state": doc.state.value,
        }
        for doc in docs_result.scalars().all()
    ]
    payload = {
        "platform": platform,
        "generated_at": datetime.now(UTC).isoformat(),
        "document_count": len(docs),
        "documents": docs,
    }
    return json.dumps(payload, separators=(",", ":"), ensure_ascii=True).encode("utf-8")


async def process_packet_job(db: AsyncSession, packet_job_id: str, worker_id: str) -> PacketJob:
    settings = get_settings()
    job = await db.get(PacketJob, packet_job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Packet job not found")
    if job.status == PacketJobStatus.READY:
        return job
    if job.status == PacketJobStatus.FAILED:
        return job

    job.status = PacketJobStatus.RUNNING
    job.worker_id = worker_id
    job.last_heartbeat = datetime.now(UTC)
    job.timeout_at = datetime.now(UTC) + timedelta(seconds=settings.packet_job_timeout_seconds)
    await db.flush()

    object_key = f"packets/{job.user_id}/{job.id}.json"
    try:
        artifact = await _build_packet_artifact(db, job.user_id, job.platform)
        await get_aws_storage_crypto_service().upload_bytes(
            bucket=settings.s3_bucket_exports,
            object_key=object_key,
            payload=artifact,
            content_type="application/json",
        )
    except AwsDependencyError as exc:
        job.status = PacketJobStatus.FAILED
        await db.flush()
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except Exception as exc:
        job.status = PacketJobStatus.FAILED
        await db.flush()
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Packet artifact generation failed") from exc

    job.artifact_key = object_key
    job.status = PacketJobStatus.READY
    job.last_heartbeat = datetime.now(UTC)
    job.timeout_at = None
    await db.flush()
    return job
