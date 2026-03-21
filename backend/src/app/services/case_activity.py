from __future__ import annotations

import hashlib

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CaseTask, CaseTaskEvidence
from app.services.audit import create_audit_log

CASE_ACTIVATED_ACTION = "case_activated"
CASE_TASK_UPDATED_ACTION = "case_task_updated"
CASE_EVIDENCE_UPLOAD_INITIALIZED_ACTION = "case_evidence_upload_initialized"
CASE_EVIDENCE_SCAN_PASSED_ACTION = "case_evidence_scan_passed"
CASE_EVIDENCE_SCAN_FAILED_ACTION = "case_evidence_scan_failed"
CASE_REPORT_VIEWED_ACTION = "case_report_viewed"


def hash_ip(ip: str | None) -> str | None:
    if not ip:
        return None
    return hashlib.sha256(ip.encode("utf-8")).hexdigest()


async def record_case_activity(
    db: AsyncSession,
    *,
    case_id: str,
    action: str,
    actor_id: str | None,
    request_id: str | None,
    client_ip: str | None,
    message: str,
    task_id: str | None = None,
    evidence_id: str | None = None,
    metadata: dict | None = None,
) -> None:
    payload = {
        "task_id": task_id,
        "evidence_id": evidence_id,
        "message": message,
        **(metadata or {}),
    }
    await create_audit_log(
        db,
        actor_id=actor_id,
        action=action,
        entity_type="case",
        entity_id=case_id,
        request_id=request_id,
        ip_hash=hash_ip(client_ip),
        metadata=payload,
    )


async def record_case_activated(
    db: AsyncSession,
    *,
    case_id: str,
    actor_id: str | None,
    request_id: str | None,
    client_ip: str | None,
    task_count: int,
) -> None:
    await record_case_activity(
        db,
        case_id=case_id,
        action=CASE_ACTIVATED_ACTION,
        actor_id=actor_id,
        request_id=request_id,
        client_ip=client_ip,
        message=f"Case activated with {task_count} task{'s' if task_count != 1 else ''} available.",
        metadata={"task_count": task_count},
    )


async def record_case_task_updated(
    db: AsyncSession,
    *,
    case_id: str,
    task: CaseTask,
    actor_id: str | None,
    request_id: str | None,
    client_ip: str | None,
    changed_fields: list[str],
) -> None:
    if changed_fields:
        message = f"{task.platform} task updated: {', '.join(changed_fields)}."
    else:
        message = f"{task.platform} task updated."
    await record_case_activity(
        db,
        case_id=case_id,
        action=CASE_TASK_UPDATED_ACTION,
        actor_id=actor_id,
        request_id=request_id,
        client_ip=client_ip,
        task_id=task.id,
        message=message,
        metadata={
            "platform": task.platform,
            "category": task.category,
            "status": task.status.value,
            "changed_fields": changed_fields,
        },
    )


async def record_case_evidence_upload_initialized(
    db: AsyncSession,
    *,
    case_id: str,
    task: CaseTask,
    evidence: CaseTaskEvidence,
    actor_id: str | None,
    request_id: str | None,
    client_ip: str | None,
) -> None:
    await record_case_activity(
        db,
        case_id=case_id,
        action=CASE_EVIDENCE_UPLOAD_INITIALIZED_ACTION,
        actor_id=actor_id,
        request_id=request_id,
        client_ip=client_ip,
        task_id=task.id,
        evidence_id=evidence.id,
        message=f"Evidence upload initialized for {task.platform}: {evidence.file_name}.",
        metadata={
            "platform": task.platform,
            "category": task.category,
            "file_name": evidence.file_name,
            "content_type": evidence.content_type,
            "document_id": evidence.document_id,
        },
    )


async def record_case_evidence_scan_result_for_document(
    db: AsyncSession,
    *,
    document_id: str,
    scan_passed: bool,
    summary: str | None,
    request_id: str | None = None,
    client_ip: str | None = None,
) -> None:
    result = await db.execute(
        select(CaseTaskEvidence, CaseTask)
        .join(CaseTask, CaseTask.id == CaseTaskEvidence.case_task_id)
        .where(CaseTaskEvidence.document_id == document_id)
    )
    row = result.first()
    if row is None:
        return

    evidence, task = row
    action = CASE_EVIDENCE_SCAN_PASSED_ACTION if scan_passed else CASE_EVIDENCE_SCAN_FAILED_ACTION
    status_label = "passed" if scan_passed else "failed"
    message = f"Evidence scan {status_label} for {evidence.file_name}."
    if summary:
        message = f"{message} {summary}"

    await record_case_activity(
        db,
        case_id=task.case_id,
        action=action,
        actor_id=None,
        request_id=request_id,
        client_ip=client_ip,
        task_id=task.id,
        evidence_id=evidence.id,
        message=message,
        metadata={
            "platform": task.platform,
            "category": task.category,
            "file_name": evidence.file_name,
            "content_type": evidence.content_type,
            "document_id": evidence.document_id,
            "scan_summary": summary,
            "scan_passed": scan_passed,
        },
    )


async def record_case_report_viewed(
    db: AsyncSession,
    *,
    case_id: str,
    actor_id: str | None,
    request_id: str | None,
    client_ip: str | None,
    report_ready: bool,
    warning_count: int,
) -> None:
    await record_case_activity(
        db,
        case_id=case_id,
        action=CASE_REPORT_VIEWED_ACTION,
        actor_id=actor_id,
        request_id=request_id,
        client_ip=client_ip,
        message="Printable closure report viewed.",
        metadata={"report_ready": report_ready, "warning_count": warning_count},
    )
