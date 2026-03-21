from __future__ import annotations

from collections import Counter
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Case,
    CaseParticipant,
    CaseParticipantRole,
    CaseStatus,
    CaseTask,
    CaseTaskStatus,
    Document,
    DocumentState,
    DocumentVersion,
    InventoryAccount,
    TrustedContact,
    TrustedContactRole,
    TrustedContactStatus,
)
from app.schemas.cases import DEATH_CERTIFICATE_DOC_TYPE
from app.schemas.documents import UploadInitRequest
from app.services import documents as document_service


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


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

    should_seed_tasks = case.activated_at is None or await _case_task_count(db, case_id=case.id) == 0

    if case.activated_at is None:
        case.activated_at = datetime.now(UTC)
    case.status = CaseStatus.ACTIVE
    case.death_certificate_document_id = document.id
    case.death_certificate_version_id = version.id

    if should_seed_tasks:
        await _seed_case_tasks_from_inventory(db, case=case)

    await db.flush()
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


async def patch_case_task(db: AsyncSession, *, case_id: str, task_id: str, payload) -> CaseTask:
    task = await db.get(CaseTask, task_id)
    if task is None or task.case_id != case_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case task not found")

    fields = payload.model_fields_set
    if "notes" in fields:
        task.notes = _normalize_optional_text(payload.notes)
    if "status" in fields:
        if payload.status is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Status is required")
        task.status = payload.status
    if "reference_number" in fields:
        task.reference_number = _normalize_optional_text(payload.reference_number)
    if "submitted_date" in fields:
        task.submitted_date = payload.submitted_date

    await db.flush()
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
