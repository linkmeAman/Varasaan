from __future__ import annotations

import json
import logging
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.integrations.aws import get_aws_storage_crypto_service
from app.integrations.email import get_email_client
from app.models import (
    AuditLog,
    Case,
    CaseParticipant,
    CaseParticipantRole,
    CaseStatus,
    CaseTask,
    CaseTaskEvidence,
    CaseTaskStatus,
    Document,
    DocumentState,
    DocumentVersion,
    InventoryAccount,
    MalwareScan,
    MalwareScanStatus,
    RecurringPaymentRail,
    TrustedContact,
    TrustedContactRole,
    TrustedContactStatus,
    User,
)
from app.schemas.cases import (
    CASE_TASK_EVIDENCE_CONTENT_TYPES,
    CASE_TASK_EVIDENCE_DOC_TYPE,
    DEATH_CERTIFICATE_DOC_TYPE,
    CaseActivityEventResponse,
    CaseBleedStopperCaseSummaryResponse,
    CaseBleedStopperResponse,
    CaseBleedStopperRowResponse,
    CaseReportEvidenceReferenceResponse,
    CaseReportResponse,
    CaseReportSummaryResponse,
    CaseReportTaskRowResponse,
)
from app.schemas.documents import UploadInitRequest
from app.services import documents as document_service
from app.services.case_activity import (
    record_case_activated,
    record_case_closed,
    record_case_contacts_notified,
    record_case_evidence_retention_purged,
    record_case_evidence_upload_initialized,
    record_case_report_viewed,
    record_case_task_updated,
)

TERMINAL_CASE_TASK_STATUSES = {CaseTaskStatus.RESOLVED, CaseTaskStatus.ESCALATED}
logger = logging.getLogger(__name__)


@dataclass(slots=True)
class CaseTaskEvidenceSnapshot:
    task: CaseTask
    evidence: CaseTaskEvidence
    document: Document
    version: DocumentVersion | None
    scan: MalwareScan | None


@dataclass(slots=True)
class CaseReportComputation:
    summary: CaseReportSummaryResponse
    task_rows: list[CaseReportTaskRowResponse]
    clean_evidence_references: list[CaseReportEvidenceReferenceResponse]
    report_ready: bool
    warnings: list[str]


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def _deserialize_metadata(log: AuditLog) -> dict:
    if not log.metadata_json:
        return {}
    try:
        payload = json.loads(log.metadata_json)
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


def _actor_label(user: User | None) -> str:
    if user is None:
        return "System"
    if user.full_name:
        normalized = user.full_name.strip()
        if normalized:
            return normalized
    return user.email


def _display_owner_name(owner: User | None) -> str:
    if owner and owner.full_name:
        normalized = owner.full_name.strip()
        if normalized:
            return normalized
    return owner.email if owner else ""


def _format_inr_amount(monthly_amount_paise: int) -> str:
    return f"INR {monthly_amount_paise / 100:.2f}"


def _recurring_reference_label(task: CaseTask) -> str:
    return task.payment_reference_hint or task.platform


def _build_card_action_steps(task: CaseTask) -> list[str]:
    reference_label = _recurring_reference_label(task)
    return [
        f"Review the latest card statement and locate the merchant descriptor for {reference_label}.",
        "Contact the card issuer or bank and request cancellation of the recurring merchant mandate.",
        "Raise a dispute for any debit that was processed after the loss event or after cancellation was requested.",
        "Capture the complaint number, support email, or cancellation confirmation as task evidence.",
    ]


def _build_upi_autopay_action_steps(task: CaseTask) -> list[str]:
    reference_label = _recurring_reference_label(task)
    return [
        f"Open the bank or UPI app that manages the autopay mandate for {reference_label}.",
        "Navigate to UPI mandates or autopay instructions and revoke the active mandate.",
        "If the mandate cannot be revoked in-app, contact the bank and request manual revocation of the UPI autopay.",
        "Capture the revocation confirmation or app screenshot as task evidence.",
    ]


def _build_generic_action_steps(task: CaseTask) -> list[str]:
    reference_label = _recurring_reference_label(task)
    return [
        f"Contact {task.platform} support and request cancellation of the recurring payment tied to {reference_label}.",
        "Ask for written confirmation that future renewals and debits have been stopped.",
        "If billing continues, escalate through the payment provider or bank and note the case reference.",
        "Capture the cancellation email thread, ticket, or screenshot as task evidence.",
    ]


def _build_card_dispute_letter(*, owner_name: str, owner_email: str, task: CaseTask) -> str:
    reference_label = _recurring_reference_label(task)
    return "\n".join(
        [
            "Subject: Request to cancel recurring card charge and review disputed debit",
            "",
            "To the card issuer or bank support team,",
            "",
            f"I am writing regarding the estate of {owner_name} ({owner_email}).",
            f"Please cancel any recurring card charge linked to {task.platform} and the merchant reference {reference_label}.",
            f"The estimated recurring amount is {_format_inr_amount(task.monthly_amount_paise or 0)} per month.",
            "",
            "Please block future recurring debits for this merchant, review any debit that should be reversed, and confirm the action taken in writing.",
            "",
            "Supporting documents, including the death certificate and account statements, can be provided on request.",
            "",
            "Regards,",
            "Executor / estate representative",
        ]
    )


def _build_bleed_stopper_row(*, task: CaseTask, owner_name: str, owner_email: str) -> CaseBleedStopperRowResponse:
    if task.payment_rail == RecurringPaymentRail.CARD:
        return CaseBleedStopperRowResponse(
            task_id=task.id,
            platform=task.platform,
            category=task.category,
            priority=task.priority,
            status=task.status,
            monthly_amount_paise=task.monthly_amount_paise or 0,
            payment_rail=RecurringPaymentRail.CARD,
            payment_reference_hint=task.payment_reference_hint,
            action_type="card_dispute",
            action_steps=_build_card_action_steps(task),
            letter_template=_build_card_dispute_letter(owner_name=owner_name, owner_email=owner_email, task=task),
        )

    if task.payment_rail == RecurringPaymentRail.UPI_AUTOPAY:
        return CaseBleedStopperRowResponse(
            task_id=task.id,
            platform=task.platform,
            category=task.category,
            priority=task.priority,
            status=task.status,
            monthly_amount_paise=task.monthly_amount_paise or 0,
            payment_rail=RecurringPaymentRail.UPI_AUTOPAY,
            payment_reference_hint=task.payment_reference_hint,
            action_type="revoke_upi_autopay",
            action_steps=_build_upi_autopay_action_steps(task),
        )

    return CaseBleedStopperRowResponse(
        task_id=task.id,
        platform=task.platform,
        category=task.category,
        priority=task.priority,
        status=task.status,
        monthly_amount_paise=task.monthly_amount_paise or 0,
        payment_rail=RecurringPaymentRail.OTHER,
        payment_reference_hint=task.payment_reference_hint,
        action_type="cancel_recurring_payment",
        action_steps=_build_generic_action_steps(task),
    )


def _evidence_download_available(snapshot: CaseTaskEvidenceSnapshot) -> bool:
    return (
        snapshot.document.state == DocumentState.ACTIVE
        and snapshot.document.current_version_id == (snapshot.version.id if snapshot.version else None)
        and snapshot.scan is not None
        and snapshot.scan.status == MalwareScanStatus.CLEAN
    )


async def _latest_document_version_subquery():
    return (
        select(
            DocumentVersion.document_id.label("document_id"),
            func.max(DocumentVersion.version_no).label("max_version_no"),
        )
        .group_by(DocumentVersion.document_id)
        .subquery()
    )


async def upsert_case_for_executor_contact(
    db: AsyncSession,
    *,
    owner_user_id: str,
    trusted_contact: TrustedContact,
) -> Case | None:
    if trusted_contact.role != TrustedContactRole.EXECUTOR:
        return None

    result = await db.execute(select(Case).where(Case.owner_user_id == owner_user_id))
    case = result.scalars().first()
    if case is None:
        case = Case(owner_user_id=owner_user_id, status=CaseStatus.ACTIVATION_PENDING)
        db.add(case)
        await db.flush()

    participants_result = await db.execute(
        select(CaseParticipant).where(
            CaseParticipant.case_id == case.id,
            CaseParticipant.role == CaseParticipantRole.EXECUTOR,
        )
    )
    for participant in participants_result.scalars().all():
        if participant.trusted_contact_id != trusted_contact.id:
            await db.delete(participant)

    participant_result = await db.execute(
        select(CaseParticipant).where(
            CaseParticipant.case_id == case.id,
            CaseParticipant.trusted_contact_id == trusted_contact.id,
        )
    )
    participant = participant_result.scalars().first()
    if participant is None:
        participant = CaseParticipant(
            case_id=case.id,
            trusted_contact_id=trusted_contact.id,
            role=CaseParticipantRole.EXECUTOR,
        )
        db.add(participant)
    else:
        participant.role = CaseParticipantRole.EXECUTOR

    await db.flush()
    return case


async def assert_executor_identity(db: AsyncSession, *, user_email: str) -> None:
    result = await db.execute(
        select(func.count(CaseParticipant.id))
        .join(TrustedContact, TrustedContact.id == CaseParticipant.trusted_contact_id)
        .where(
            TrustedContact.email == _normalize_email(user_email),
            TrustedContact.status == TrustedContactStatus.ACTIVE,
            TrustedContact.role == TrustedContactRole.EXECUTOR,
            CaseParticipant.role == CaseParticipantRole.EXECUTOR,
        )
    )
    if int(result.scalar_one()) == 0:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Executor access required")


async def list_accessible_cases(db: AsyncSession, *, user_email: str) -> list[Case]:
    await assert_executor_identity(db, user_email=user_email)
    result = await db.execute(
        select(Case)
        .join(CaseParticipant, CaseParticipant.case_id == Case.id)
        .join(TrustedContact, TrustedContact.id == CaseParticipant.trusted_contact_id)
        .where(
            TrustedContact.email == _normalize_email(user_email),
            TrustedContact.status == TrustedContactStatus.ACTIVE,
            TrustedContact.role == TrustedContactRole.EXECUTOR,
            CaseParticipant.role == CaseParticipantRole.EXECUTOR,
        )
        .order_by(Case.updated_at.desc())
    )
    return list(result.scalars().unique().all())


async def get_accessible_case(db: AsyncSession, *, case_id: str, user_email: str) -> Case:
    case = await db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    result = await db.execute(
        select(func.count(CaseParticipant.id))
        .join(TrustedContact, TrustedContact.id == CaseParticipant.trusted_contact_id)
        .where(
            CaseParticipant.case_id == case_id,
            CaseParticipant.role == CaseParticipantRole.EXECUTOR,
            TrustedContact.email == _normalize_email(user_email),
            TrustedContact.status == TrustedContactStatus.ACTIVE,
            TrustedContact.role == TrustedContactRole.EXECUTOR,
        )
    )
    if int(result.scalar_one()) == 0:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Executor access required")

    return case


async def init_case_death_certificate_upload(
    db: AsyncSession,
    *,
    case: Case,
    size_bytes: int,
    content_type: str,
    sha256: str | None,
):
    if case.status == CaseStatus.CLOSED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Closed cases cannot be modified")

    upload_request = UploadInitRequest(
        doc_type=DEATH_CERTIFICATE_DOC_TYPE,
        size_bytes=size_bytes,
        content_type=content_type,
        sha256=sha256,
    )

    document = await db.get(Document, case.death_certificate_document_id) if case.death_certificate_document_id else None
    if document and document.user_id == case.owner_user_id and document.deleted_at is None:
        result = await document_service.add_document_version(db, case.owner_user_id, document.id, upload_request)
    else:
        result = await document_service.init_document_upload(db, case.owner_user_id, upload_request)

    case.death_certificate_document_id = result.document.id
    case.death_certificate_version_id = result.version.id
    await db.flush()
    return result


def _validate_case_document_reference(case: Case, document: Document | None, version: DocumentVersion | None) -> None:
    if document is None or version is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Death certificate document not found")
    if case.death_certificate_document_id != document.id or case.death_certificate_version_id != version.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Death certificate reference does not match this case")
    if document.user_id != case.owner_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Death certificate does not belong to this case")
    if version.document_id != document.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Document version does not belong to the referenced document")
    if document.doc_type != DEATH_CERTIFICATE_DOC_TYPE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid death certificate document type")


async def _case_task_count(db: AsyncSession, *, case_id: str) -> int:
    result = await db.execute(select(func.count(CaseTask.id)).where(CaseTask.case_id == case_id))
    return int(result.scalar_one())


async def _schedule_case_evidence_retention(
    db: AsyncSession,
    *,
    case_id: str,
    expires_at: datetime,
) -> int:
    result = await db.execute(
        select(CaseTaskEvidence)
        .join(CaseTask, CaseTask.id == CaseTaskEvidence.case_task_id)
        .where(
            CaseTask.case_id == case_id,
            CaseTaskEvidence.retention_purged_at.is_(None),
        )
    )
    rows = list(result.scalars().all())
    for evidence in rows:
        evidence.retention_purge_at = expires_at
    await db.flush()
    return len(rows)


async def _notify_case_contacts(
    db: AsyncSession,
    *,
    case: Case,
    actor_id: str | None,
    request_id: str | None,
    client_ip: str | None,
    task_count: int,
) -> None:
    owner = await db.get(User, case.owner_user_id)
    owner_name = _display_owner_name(owner) or None
    owner_email = owner.email if owner else ""
    result = await db.execute(
        select(TrustedContact)
        .where(
            TrustedContact.user_id == case.owner_user_id,
            TrustedContact.status == TrustedContactStatus.ACTIVE,
        )
        .order_by(TrustedContact.created_at.asc(), TrustedContact.id.asc())
    )

    sent_to: set[str] = set()
    for contact in result.scalars().all():
        normalized_email = _normalize_email(contact.email)
        if normalized_email in sent_to:
            continue
        try:
            await get_email_client().send_case_open_notification(
                to_email=contact.email,
                owner_email=owner_email,
                owner_name=owner_name,
                activated_at=case.activated_at or datetime.now(UTC),
                task_count=task_count,
            )
            sent_to.add(normalized_email)
        except Exception as exc:  # pragma: no cover
            logger.warning("case open notification failed for %s: %s", contact.email, exc)

    if sent_to:
        await record_case_contacts_notified(
            db,
            case_id=case.id,
            actor_id=actor_id,
            request_id=request_id,
            client_ip=client_ip,
            recipient_count=len(sent_to),
        )


async def _seed_case_tasks_from_inventory(db: AsyncSession, *, case: Case) -> None:
    existing_result = await db.execute(select(CaseTask.inventory_account_id).where(CaseTask.case_id == case.id))
    existing_inventory_ids = {
        inventory_account_id
        for inventory_account_id in existing_result.scalars().all()
        if inventory_account_id is not None
    }

    inventory_result = await db.execute(
        select(InventoryAccount)
        .where(InventoryAccount.user_id == case.owner_user_id)
        .order_by(InventoryAccount.created_at.asc())
    )
    for account in inventory_result.scalars().all():
        if account.id in existing_inventory_ids:
            continue
        db.add(
            CaseTask(
                case_id=case.id,
                inventory_account_id=account.id,
                platform=account.platform,
                category=account.category,
                priority=account.importance_level,
                is_recurring_payment=account.is_recurring_payment,
                payment_rail=account.payment_rail,
                monthly_amount_paise=account.monthly_amount_paise,
                payment_reference_hint=account.payment_reference_hint,
                status=CaseTaskStatus.NOT_STARTED,
            )
        )

    await db.flush()


async def activate_case(
    db: AsyncSession,
    *,
    case: Case,
    document_id: str,
    version_id: str,
    actor_id: str | None = None,
    request_id: str | None = None,
    client_ip: str | None = None,
) -> Case:
    if case.status == CaseStatus.CLOSED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Closed cases cannot be reactivated")

    document = await db.get(Document, document_id)
    version = await db.get(DocumentVersion, version_id)
    _validate_case_document_reference(case, document, version)

    if (
        document.state != DocumentState.ACTIVE
        or version.state != DocumentState.ACTIVE
        or document.current_version_id != version.id
    ):
        await document_service.orchestrate_malware_scan(db, version.id)
        document = await db.get(Document, document_id)
        version = await db.get(DocumentVersion, version_id)
        _validate_case_document_reference(case, document, version)

    if (
        document.state != DocumentState.ACTIVE
        or version.state != DocumentState.ACTIVE
        or document.current_version_id != version.id
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Death certificate must complete document validation before activation",
        )

    was_active = case.status == CaseStatus.ACTIVE and case.activated_at is not None
    should_seed_tasks = case.activated_at is None or await _case_task_count(db, case_id=case.id) == 0

    if case.activated_at is None:
        case.activated_at = datetime.now(UTC)
    case.status = CaseStatus.ACTIVE
    case.death_certificate_document_id = document.id
    case.death_certificate_version_id = version.id

    if should_seed_tasks:
        await _seed_case_tasks_from_inventory(db, case=case)

    await db.flush()
    if not was_active:
        task_count = await _case_task_count(db, case_id=case.id)
        await record_case_activated(
            db,
            case_id=case.id,
            actor_id=actor_id,
            request_id=request_id,
            client_ip=client_ip,
            task_count=task_count,
        )
        await _notify_case_contacts(
            db,
            case=case,
            actor_id=actor_id,
            request_id=request_id,
            client_ip=client_ip,
            task_count=task_count,
        )
    return case


async def close_case(
    db: AsyncSession,
    *,
    case: Case,
    actor_id: str | None = None,
    request_id: str | None = None,
    client_ip: str | None = None,
) -> Case:
    if case.status == CaseStatus.CLOSED:
        return case
    if case.status != CaseStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only active cases can be closed")

    report = await _build_case_report_data(db, case=case)
    if not report.report_ready or report.warnings:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Case can be closed only after all tasks are terminal and clean evidence is available",
        )

    settings = get_settings()
    closed_at = datetime.now(UTC)
    retention_expires_at = closed_at + timedelta(days=settings.case_evidence_retention_days)

    case.status = CaseStatus.CLOSED
    case.closed_at = closed_at
    case.evidence_retention_expires_at = retention_expires_at
    retained_evidence_count = await _schedule_case_evidence_retention(
        db,
        case_id=case.id,
        expires_at=retention_expires_at,
    )
    await db.flush()
    await record_case_closed(
        db,
        case_id=case.id,
        actor_id=actor_id,
        request_id=request_id,
        client_ip=client_ip,
        retained_evidence_count=retained_evidence_count,
        evidence_retention_expires_at=retention_expires_at,
    )
    return case


async def list_case_tasks(
    db: AsyncSession,
    *,
    case_id: str,
    task_status: CaseTaskStatus | None = None,
    platform: str | None = None,
    category: str | None = None,
    priority: int | None = None,
) -> list[CaseTask]:
    statement = select(CaseTask).where(CaseTask.case_id == case_id)
    if task_status is not None:
        statement = statement.where(CaseTask.status == task_status)
    if platform:
        statement = statement.where(CaseTask.platform == platform.strip())
    if category:
        statement = statement.where(CaseTask.category == category.strip())
    if priority is not None:
        statement = statement.where(CaseTask.priority == priority)

    statement = statement.order_by(CaseTask.priority.desc(), CaseTask.created_at.asc())
    result = await db.execute(statement)
    return list(result.scalars().all())


async def get_case_task(db: AsyncSession, *, case_id: str, task_id: str) -> CaseTask:
    task = await db.get(CaseTask, task_id)
    if task is None or task.case_id != case_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case task not found")
    return task


async def patch_case_task(
    db: AsyncSession,
    *,
    case_id: str,
    task_id: str,
    payload,
    actor_id: str | None = None,
    request_id: str | None = None,
    client_ip: str | None = None,
) -> CaseTask:
    task = await get_case_task(db, case_id=case_id, task_id=task_id)

    changed_fields: list[str] = []
    fields = payload.model_fields_set
    if "notes" in fields:
        next_notes = _normalize_optional_text(payload.notes)
        if task.notes != next_notes:
            changed_fields.append("notes")
        task.notes = next_notes
    if "status" in fields:
        if payload.status is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Status is required")
        if task.status != payload.status:
            changed_fields.append("status")
        task.status = payload.status
    if "reference_number" in fields:
        next_reference_number = _normalize_optional_text(payload.reference_number)
        if task.reference_number != next_reference_number:
            changed_fields.append("reference_number")
        task.reference_number = next_reference_number
    if "submitted_date" in fields:
        if task.submitted_date != payload.submitted_date:
            changed_fields.append("submitted_date")
        task.submitted_date = payload.submitted_date

    await db.flush()
    await record_case_task_updated(
        db,
        case_id=case_id,
        task=task,
        actor_id=actor_id,
        request_id=request_id,
        client_ip=client_ip,
        changed_fields=changed_fields,
    )
    return task


async def get_case_task_status_counts(db: AsyncSession, *, case_id: str):
    result = await db.execute(select(CaseTask.status).where(CaseTask.case_id == case_id))
    counts = Counter(result.scalars().all())
    return {
        "not_started": counts.get(CaseTaskStatus.NOT_STARTED, 0),
        "in_progress": counts.get(CaseTaskStatus.IN_PROGRESS, 0),
        "submitted": counts.get(CaseTaskStatus.SUBMITTED, 0),
        "waiting": counts.get(CaseTaskStatus.WAITING, 0),
        "resolved": counts.get(CaseTaskStatus.RESOLVED, 0),
        "escalated": counts.get(CaseTaskStatus.ESCALATED, 0),
    }


async def get_case_task_evidence_counts(db: AsyncSession, *, task_ids: list[str]) -> dict[str, int]:
    if not task_ids:
        return {}

    result = await db.execute(
        select(CaseTaskEvidence.case_task_id, func.count(CaseTaskEvidence.id))
        .where(
            CaseTaskEvidence.case_task_id.in_(task_ids),
            CaseTaskEvidence.retention_purged_at.is_(None),
        )
        .group_by(CaseTaskEvidence.case_task_id)
    )
    return {str(task_id): int(count) for task_id, count in result.all()}


async def get_case_task_evidence_count(db: AsyncSession, *, task_id: str) -> int:
    counts = await get_case_task_evidence_counts(db, task_ids=[task_id])
    return counts.get(task_id, 0)


async def list_case_evidence_snapshots(
    db: AsyncSession,
    *,
    case_id: str,
    task_id: str | None = None,
) -> list[CaseTaskEvidenceSnapshot]:
    latest_version_subquery = await _latest_document_version_subquery()
    statement = (
        select(CaseTaskEvidence, CaseTask, Document, DocumentVersion, MalwareScan)
        .join(CaseTask, CaseTask.id == CaseTaskEvidence.case_task_id)
        .join(Document, Document.id == CaseTaskEvidence.document_id)
        .outerjoin(
            latest_version_subquery,
            latest_version_subquery.c.document_id == Document.id,
        )
        .outerjoin(
            DocumentVersion,
            (DocumentVersion.document_id == Document.id)
            & (DocumentVersion.version_no == latest_version_subquery.c.max_version_no),
        )
        .outerjoin(MalwareScan, MalwareScan.version_id == DocumentVersion.id)
        .where(CaseTask.case_id == case_id)
        .where(CaseTaskEvidence.retention_purged_at.is_(None))
        .order_by(CaseTask.priority.desc(), CaseTask.created_at.asc(), CaseTaskEvidence.created_at.asc())
    )
    if task_id:
        statement = statement.where(CaseTask.id == task_id)

    result = await db.execute(statement)
    return [
        CaseTaskEvidenceSnapshot(
            evidence=evidence,
            task=task,
            document=document,
            version=version,
            scan=scan,
        )
        for evidence, task, document, version, scan in result.all()
    ]


async def get_case_task_evidence_snapshot(
    db: AsyncSession,
    *,
    case_id: str,
    task_id: str,
    evidence_id: str,
) -> CaseTaskEvidenceSnapshot:
    snapshots = await list_case_evidence_snapshots(db, case_id=case_id, task_id=task_id)
    for snapshot in snapshots:
        if snapshot.evidence.id == evidence_id:
            return snapshot
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task evidence not found")


async def init_case_task_evidence_upload(
    db: AsyncSession,
    *,
    case: Case,
    task_id: str,
    file_name: str,
    size_bytes: int,
    content_type: str,
    sha256: str | None,
    actor_id: str | None = None,
    request_id: str | None = None,
    client_ip: str | None = None,
):
    if case.status != CaseStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Case evidence is available only after activation")
    if content_type not in CASE_TASK_EVIDENCE_CONTENT_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported evidence content type")
    normalized_file_name = file_name.strip()
    if not normalized_file_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Evidence file name is required")

    task = await get_case_task(db, case_id=case.id, task_id=task_id)
    upload_request = UploadInitRequest(
        doc_type=CASE_TASK_EVIDENCE_DOC_TYPE,
        size_bytes=size_bytes,
        content_type=content_type,
        sha256=sha256,
    )
    result = await document_service.init_document_upload(db, case.owner_user_id, upload_request)

    evidence = CaseTaskEvidence(
        case_task_id=task.id,
        document_id=result.document.id,
        file_name=normalized_file_name,
        content_type=content_type,
    )
    db.add(evidence)
    task.evidence_document_id = result.document.id
    await db.flush()

    await record_case_evidence_upload_initialized(
        db,
        case_id=case.id,
        task=task,
        evidence=evidence,
        actor_id=actor_id,
        request_id=request_id,
        client_ip=client_ip,
    )
    return evidence, result


async def list_case_activity_events(
    db: AsyncSession,
    *,
    case_id: str,
    descending: bool = True,
) -> list[CaseActivityEventResponse]:
    order_by = AuditLog.created_at.desc() if descending else AuditLog.created_at.asc()
    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.entity_type == "case", AuditLog.entity_id == case_id)
        .order_by(order_by, AuditLog.id.asc())
    )
    logs = list(result.scalars().all())
    actor_ids = sorted({log.actor_id for log in logs if log.actor_id})
    actors: dict[str, User] = {}
    if actor_ids:
        actor_rows = await db.execute(select(User).where(User.id.in_(actor_ids)))
        actors = {user.id: user for user in actor_rows.scalars().all()}

    events: list[CaseActivityEventResponse] = []
    for log in logs:
        metadata = _deserialize_metadata(log)
        message = str(metadata.get("message") or log.action.replace("_", " "))
        events.append(
            CaseActivityEventResponse(
                timestamp=log.created_at,
                event_type=log.action,
                task_id=metadata.get("task_id"),
                evidence_id=metadata.get("evidence_id"),
                actor_label=_actor_label(actors.get(log.actor_id)) if log.actor_id else "System",
                message=message,
            )
        )
    return events


async def build_case_bleed_stopper(
    db: AsyncSession,
    *,
    case: Case,
) -> CaseBleedStopperResponse:
    if case.status != CaseStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Subscription bleed stopper is available only after activation",
        )

    owner = await db.get(User, case.owner_user_id)
    owner_name = _display_owner_name(owner)
    owner_email = owner.email if owner else ""
    tasks = await list_case_tasks(db, case_id=case.id)
    recurring_tasks = [
        task
        for task in tasks
        if task.is_recurring_payment and task.payment_rail is not None and task.monthly_amount_paise is not None
    ]
    recurring_tasks.sort(
        key=lambda task: (
            -int(task.monthly_amount_paise or 0),
            -task.priority,
            task.platform.lower(),
            task.created_at,
        )
    )

    rows = [_build_bleed_stopper_row(task=task, owner_name=owner_name, owner_email=owner_email) for task in recurring_tasks]
    return CaseBleedStopperResponse(
        summary=CaseBleedStopperCaseSummaryResponse(
            id=case.id,
            owner_name=owner_name,
            owner_email=owner_email,
            status=case.status,
            activated_at=case.activated_at,
        ),
        monthly_bleed_paise=sum(task.monthly_amount_paise or 0 for task in recurring_tasks),
        recurring_task_count=len(recurring_tasks),
        rows=rows,
    )


async def _build_case_report_data(
    db: AsyncSession,
    *,
    case: Case,
) -> CaseReportComputation:
    owner = await db.get(User, case.owner_user_id)
    tasks = await list_case_tasks(db, case_id=case.id)
    evidence_counts = await get_case_task_evidence_counts(db, task_ids=[task.id for task in tasks])
    evidence_snapshots = await list_case_evidence_snapshots(db, case_id=case.id)

    clean_evidence_by_task: dict[str, list[CaseTaskEvidenceSnapshot]] = defaultdict(list)
    for snapshot in evidence_snapshots:
        if _evidence_download_available(snapshot):
            clean_evidence_by_task[snapshot.task.id].append(snapshot)

    report_ready = all(task.status in TERMINAL_CASE_TASK_STATUSES for task in tasks)
    warnings: list[str] = []
    non_terminal_tasks = [task for task in tasks if task.status not in TERMINAL_CASE_TASK_STATUSES]
    tasks_without_clean_evidence = [task for task in tasks if not clean_evidence_by_task.get(task.id)]
    if non_terminal_tasks:
        warnings.append(f"{len(non_terminal_tasks)} task(s) are not yet resolved or escalated.")
    if tasks_without_clean_evidence:
        warnings.append(f"{len(tasks_without_clean_evidence)} task(s) do not have clean evidence yet.")

    task_rows = [
        CaseReportTaskRowResponse(
            id=task.id,
            platform=task.platform,
            category=task.category,
            priority=task.priority,
            status=task.status,
            notes=task.notes,
            reference_number=task.reference_number,
            submitted_date=task.submitted_date,
            evidence_count=evidence_counts.get(task.id, 0),
            clean_evidence_count=len(clean_evidence_by_task.get(task.id, [])),
        )
        for task in tasks
    ]

    clean_evidence_references: list[CaseReportEvidenceReferenceResponse] = []
    for task in tasks:
        for snapshot in clean_evidence_by_task.get(task.id, []):
            clean_evidence_references.append(
                CaseReportEvidenceReferenceResponse(
                    evidence_id=snapshot.evidence.id,
                    task_id=task.id,
                    platform=task.platform,
                    category=task.category,
                    file_name=snapshot.evidence.file_name,
                    content_type=snapshot.evidence.content_type,
                    created_at=snapshot.evidence.created_at,
                )
            )

    summary = CaseReportSummaryResponse(
        case_id=case.id,
        owner_name=_display_owner_name(owner),
        owner_email=owner.email if owner else "",
        status=case.status,
        activated_at=case.activated_at,
        closed_at=case.closed_at,
        evidence_retention_expires_at=case.evidence_retention_expires_at,
        generated_at=datetime.now(UTC),
        total_tasks=len(tasks),
        resolved_task_count=sum(1 for task in tasks if task.status == CaseTaskStatus.RESOLVED),
        escalated_task_count=sum(1 for task in tasks if task.status == CaseTaskStatus.ESCALATED),
        clean_evidence_count=len(clean_evidence_references),
    )
    return CaseReportComputation(
        summary=summary,
        task_rows=task_rows,
        clean_evidence_references=clean_evidence_references,
        report_ready=report_ready,
        warnings=warnings,
    )


async def build_case_report(
    db: AsyncSession,
    *,
    case: Case,
    actor_id: str | None = None,
    request_id: str | None = None,
    client_ip: str | None = None,
) -> CaseReportResponse:
    report = await _build_case_report_data(db, case=case)

    await record_case_report_viewed(
        db,
        case_id=case.id,
        actor_id=actor_id,
        request_id=request_id,
        client_ip=client_ip,
        report_ready=report.report_ready,
        warning_count=len(report.warnings),
    )

    activity_timeline = await list_case_activity_events(db, case_id=case.id, descending=False)
    return CaseReportResponse(
        summary=report.summary,
        task_rows=report.task_rows,
        clean_evidence_references=report.clean_evidence_references,
        activity_timeline=activity_timeline,
        report_ready=report.report_ready,
        warnings=report.warnings,
    )


async def purge_expired_case_evidence(db: AsyncSession, *, now: datetime | None = None) -> int:
    effective_now = now or datetime.now(UTC)
    result = await db.execute(
        select(CaseTaskEvidence, CaseTask)
        .join(CaseTask, CaseTask.id == CaseTaskEvidence.case_task_id)
        .where(
            CaseTaskEvidence.retention_purged_at.is_(None),
            CaseTaskEvidence.retention_purge_at.is_not(None),
            CaseTaskEvidence.retention_purge_at <= effective_now,
        )
        .order_by(CaseTaskEvidence.retention_purge_at.asc(), CaseTaskEvidence.created_at.asc(), CaseTaskEvidence.id.asc())
    )
    due_rows = list(result.all())
    if not due_rows:
        return 0

    settings = get_settings()
    aws_service = get_aws_storage_crypto_service()
    purged_by_case: Counter[str] = Counter()
    processed_document_ids: set[str] = set()

    for evidence, task in due_rows:
        evidence.retention_purged_at = effective_now
        purged_by_case[task.case_id] += 1

        if evidence.document_id in processed_document_ids:
            continue

        document = await db.get(Document, evidence.document_id)
        if document is None:
            processed_document_ids.add(evidence.document_id)
            continue

        versions_result = await db.execute(
            select(DocumentVersion)
            .where(DocumentVersion.document_id == document.id)
            .order_by(DocumentVersion.version_no.asc())
        )
        for version in versions_result.scalars().all():
            if version.object_key:
                await aws_service.delete_object(
                    bucket=settings.s3_bucket_documents,
                    object_key=version.object_key,
                )
            version.state = DocumentState.PURGED

        document.state = DocumentState.PURGED
        document.current_version_id = None
        document.deleted_at = document.deleted_at or effective_now
        processed_document_ids.add(evidence.document_id)

    await db.flush()
    for case_id, purged_evidence_count in purged_by_case.items():
        await record_case_evidence_retention_purged(
            db,
            case_id=case_id,
            purged_evidence_count=purged_evidence_count,
        )
    return sum(purged_by_case.values())
