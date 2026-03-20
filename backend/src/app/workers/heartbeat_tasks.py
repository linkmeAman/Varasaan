from __future__ import annotations

import asyncio

from app.db.session import get_session_factory
from app.services import heartbeats as heartbeat_service
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
    name="app.workers.heartbeat_tasks.dispatch_due_heartbeats_task",
    autoretry_for=DEFAULT_AUTORETRY_FOR,
    retry_backoff=DEFAULT_RETRY_BACKOFF,
    retry_backoff_max=DEFAULT_RETRY_BACKOFF_MAX,
    retry_jitter=DEFAULT_RETRY_JITTER,
    max_retries=DEFAULT_MAX_RETRIES,
)
def dispatch_due_heartbeats_task(self, limit: int = 100) -> dict[str, int]:
    _ = self
    due_ids = _run_async(_run_in_session(lambda db: heartbeat_service.list_due_heartbeat_ids(db, limit=limit)))
    for heartbeat_id in due_ids:
        process_due_heartbeat_task.delay(heartbeat_id)
    return {"scheduled": len(due_ids)}


@celery_app.task(
    bind=True,
    name="app.workers.heartbeat_tasks.process_due_heartbeat_task",
    autoretry_for=DEFAULT_AUTORETRY_FOR,
    retry_backoff=DEFAULT_RETRY_BACKOFF,
    retry_backoff_max=DEFAULT_RETRY_BACKOFF_MAX,
    retry_jitter=DEFAULT_RETRY_JITTER,
    max_retries=DEFAULT_MAX_RETRIES,
)
def process_due_heartbeat_task(self, heartbeat_id: str) -> dict[str, str]:
    _ = self
    _run_async(_run_in_session(lambda db: heartbeat_service.process_due_heartbeat(db, heartbeat_id=heartbeat_id)))
    return {"heartbeat_id": heartbeat_id, "status": "processed"}


def dispatch_due_heartbeats(limit: int = 100) -> str:
    task = dispatch_due_heartbeats_task.delay(limit)
    return task.id


def enqueue_due_heartbeat_processing(heartbeat_id: str) -> str:
    task = process_due_heartbeat_task.delay(heartbeat_id)
    return task.id

