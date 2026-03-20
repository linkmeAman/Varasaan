from __future__ import annotations

from celery import Celery

from app.core.config import get_settings


def create_celery() -> Celery:
    settings = get_settings()
    broker = settings.celery_broker_url or settings.redis_url
    backend = None if settings.celery_task_always_eager else (settings.celery_result_backend or settings.redis_url)
    app = Celery("varasaan", broker=broker, backend=backend, include=["app.workers.heartbeat_tasks", "app.workers.tasks"])
    app.conf.update(
        task_serializer="json",
        result_serializer="json",
        accept_content=["json"],
        task_acks_late=True,
        worker_prefetch_multiplier=1,
        broker_transport_options={"visibility_timeout": settings.celery_visibility_timeout_seconds},
        task_default_queue="varasaan.default",
        task_routes={
            "app.workers.heartbeat_tasks.dispatch_due_heartbeats_task": {"queue": "varasaan.heartbeats"},
            "app.workers.heartbeat_tasks.process_due_heartbeat_task": {"queue": "varasaan.heartbeats"},
            "app.workers.tasks.process_export_job_task": {"queue": "varasaan.exports"},
            "app.workers.tasks.process_packet_job_task": {"queue": "varasaan.packets"},
            "app.workers.tasks.process_malware_scan_task": {"queue": "varasaan.scans"},
        },
        beat_schedule={
            "dispatch-due-heartbeats-every-5-minutes": {
                "task": "app.workers.heartbeat_tasks.dispatch_due_heartbeats_task",
                "schedule": 300.0,
            }
        },
        task_always_eager=settings.celery_task_always_eager,
        task_ignore_result=settings.celery_task_always_eager,
        task_store_eager_result=False,
    )
    return app


celery_app = create_celery()
