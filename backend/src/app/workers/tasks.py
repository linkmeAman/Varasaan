from __future__ import annotations

import asyncio
from datetime import UTC, datetime

from app.services import cases as case_service
from app.db.session import get_session_factory
from app.services import documents as document_service
from app.services import exports as export_service
from app.services import packets as packet_service
from app.workers.celery_app import celery_app
from app.workers.retry_policy import (
    DEFAULT_AUTORETRY_FOR,
    DEFAULT_MAX_RETRIES,
    DEFAULT_RETRY_BACKOFF,
    DEFAULT_RETRY_BACKOFF_MAX,
    DEFAULT_RETRY_JITTER,
)


async def _run_in_session(coro):
    session_factory = get_session_factory()
    async with session_factory() as db:
        try:
            result = await coro(db)
            await db.commit()
            return result
        except Exception:
            await db.rollback()
            raise


def _run_async(coro):
    return asyncio.run(coro)


@celery_app.task(
    bind=True,
    name="app.workers.tasks.process_export_job_task",
    autoretry_for=DEFAULT_AUTORETRY_FOR,
    retry_backoff=DEFAULT_RETRY_BACKOFF,
    retry_backoff_max=DEFAULT_RETRY_BACKOFF_MAX,
    retry_jitter=DEFAULT_RETRY_JITTER,
    max_retries=DEFAULT_MAX_RETRIES,
)
def process_export_job_task(self, export_job_id: str) -> dict[str, str]:
    _run_async(_run_in_session(lambda db: export_service.process_export_job(db, export_job_id)))
    return {"export_job_id": export_job_id, "status": "ready_or_terminal"}


@celery_app.task(
    bind=True,
    name="app.workers.tasks.process_packet_job_task",
    autoretry_for=DEFAULT_AUTORETRY_FOR,
    retry_backoff=DEFAULT_RETRY_BACKOFF,
    retry_backoff_max=DEFAULT_RETRY_BACKOFF_MAX,
    retry_jitter=DEFAULT_RETRY_JITTER,
    max_retries=DEFAULT_MAX_RETRIES,
)
def process_packet_job_task(self, packet_job_id: str) -> dict[str, str]:
    worker_id = self.request.id or f"packet-worker-{datetime.now(UTC).timestamp()}"
    _run_async(_run_in_session(lambda db: packet_service.process_packet_job(db, packet_job_id, worker_id)))
    return {"packet_job_id": packet_job_id, "status": "ready_or_terminal"}


@celery_app.task(
    bind=True,
    name="app.workers.tasks.process_malware_scan_task",
    autoretry_for=DEFAULT_AUTORETRY_FOR,
    retry_backoff=DEFAULT_RETRY_BACKOFF,
    retry_backoff_max=DEFAULT_RETRY_BACKOFF_MAX,
    retry_jitter=DEFAULT_RETRY_JITTER,
    max_retries=DEFAULT_MAX_RETRIES,
)
def process_malware_scan_task(self, version_id: str) -> dict[str, str]:
    _run_async(_run_in_session(lambda db: document_service.orchestrate_malware_scan(db, version_id)))
    return {"version_id": version_id, "status": "processed"}


@celery_app.task(
    bind=True,
    name="app.workers.tasks.purge_expired_case_evidence_task",
    autoretry_for=DEFAULT_AUTORETRY_FOR,
    retry_backoff=DEFAULT_RETRY_BACKOFF,
    retry_backoff_max=DEFAULT_RETRY_BACKOFF_MAX,
    retry_jitter=DEFAULT_RETRY_JITTER,
    max_retries=DEFAULT_MAX_RETRIES,
)
def purge_expired_case_evidence_task(self) -> dict[str, int]:
    purged = _run_async(_run_in_session(case_service.purge_expired_case_evidence))
    return {"purged_evidence_count": purged}


def enqueue_export_job(export_job_id: str) -> str:
    task = process_export_job_task.delay(export_job_id)
    return task.id


def enqueue_packet_job(packet_job_id: str) -> str:
    task = process_packet_job_task.delay(packet_job_id)
    return task.id


def enqueue_malware_scan(version_id: str) -> str:
    task = process_malware_scan_task.delay(version_id)
    return task.id


def enqueue_case_evidence_retention_cleanup() -> str:
    task = purge_expired_case_evidence_task.delay()
    return task.id
