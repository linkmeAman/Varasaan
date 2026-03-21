from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session_dep, get_current_user
from app.core.config import get_settings
from app.models import Case, CaseTask, CaseTaskStatus, User
from app.schemas.cases import (
    CaseActivationConfirmRequest,
    CaseActivationUploadInitRequest,
    CaseActivationUploadInitResponse,
    CaseSummaryResponse,
    CaseTaskPatchRequest,
    CaseTaskResponse,
    CaseTaskStatusCounts,
)
from app.services import cases as case_service

router = APIRouter(prefix="/cases", tags=["cases"])


def _display_owner_name(owner: User | None, fallback_email: str) -> str:
    if owner and owner.full_name:
        normalized = owner.full_name.strip()
        if normalized:
            return normalized
    return fallback_email


async def _serialize_case_summary(db: AsyncSession, case: Case) -> CaseSummaryResponse:
    owner = await db.get(User, case.owner_user_id)
    owner_email = owner.email if owner else ""
    task_status_counts = await case_service.get_case_task_status_counts(db, case_id=case.id)
    task_count = sum(task_status_counts.values())
    return CaseSummaryResponse(
        id=case.id,
        owner_user_id=case.owner_user_id,
        owner_name=_display_owner_name(owner, owner_email),
        owner_email=owner_email,
        status=case.status,
        death_certificate_document_id=case.death_certificate_document_id,
        death_certificate_version_id=case.death_certificate_version_id,
        activated_at=case.activated_at,
        closed_at=case.closed_at,
        created_at=case.created_at,
        updated_at=case.updated_at,
        task_count=task_count,
        task_status_counts=CaseTaskStatusCounts(**task_status_counts),
    )


def _serialize_case_task(task: CaseTask) -> CaseTaskResponse:
    return CaseTaskResponse(
        id=task.id,
        case_id=task.case_id,
        inventory_account_id=task.inventory_account_id,
        platform=task.platform,
        category=task.category,
        priority=task.priority,
        status=task.status,
        notes=task.notes,
        reference_number=task.reference_number,
        submitted_date=task.submitted_date,
        evidence_document_id=task.evidence_document_id,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


@router.get("", response_model=list[CaseSummaryResponse])
async def list_accessible_cases(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dep),
) -> list[CaseSummaryResponse]:
    cases = await case_service.list_accessible_cases(db, user_email=user.email)
    return [await _serialize_case_summary(db, case) for case in cases]


@router.get("/{case_id}", response_model=CaseSummaryResponse)
async def get_case_summary(
    case_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dep),
) -> CaseSummaryResponse:
    case = await case_service.get_accessible_case(db, case_id=case_id, user_email=user.email)
    return await _serialize_case_summary(db, case)


@router.post(
    "/{case_id}/death-certificate/uploads/init",
    response_model=CaseActivationUploadInitResponse,
    status_code=status.HTTP_201_CREATED,
)
async def init_case_death_certificate_upload(
    case_id: str,
    payload: CaseActivationUploadInitRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dep),
) -> CaseActivationUploadInitResponse:
    case = await case_service.get_accessible_case(db, case_id=case_id, user_email=user.email)
    result = await case_service.init_case_death_certificate_upload(
        db,
        case=case,
        size_bytes=payload.size_bytes,
        content_type=payload.content_type,
        sha256=payload.sha256,
    )
    settings = get_settings()
    return CaseActivationUploadInitResponse(
        document_id=result.document.id,
        version_id=result.version.id,
        version_no=result.version.version_no,
        object_key=result.version.object_key,
        upload_url=result.upload_url,
        upload_url_expires_in_seconds=settings.upload_url_ttl_minutes * 60,
        plaintext_dek_b64=result.plaintext_dek_b64,
        kms_key_id=result.kms_key_id,
    )


@router.post("/{case_id}/activate", response_model=CaseSummaryResponse)
async def activate_case(
    case_id: str,
    payload: CaseActivationConfirmRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dep),
) -> CaseSummaryResponse:
    case = await case_service.get_accessible_case(db, case_id=case_id, user_email=user.email)
    activated_case = await case_service.activate_case(
        db,
        case=case,
        document_id=payload.document_id,
        version_id=payload.version_id,
    )
    return await _serialize_case_summary(db, activated_case)


@router.get("/{case_id}/tasks", response_model=list[CaseTaskResponse])
async def list_case_tasks(
    case_id: str,
    status_value: CaseTaskStatus | None = Query(default=None, alias="status"),
    platform: str | None = Query(default=None),
    category: str | None = Query(default=None),
    priority: int | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dep),
) -> list[CaseTaskResponse]:
    case = await case_service.get_accessible_case(db, case_id=case_id, user_email=user.email)
    tasks = await case_service.list_case_tasks(
        db,
        case_id=case.id,
        task_status=status_value,
        platform=platform,
        category=category,
        priority=priority,
    )
    return [_serialize_case_task(task) for task in tasks]


@router.patch("/{case_id}/tasks/{task_id}", response_model=CaseTaskResponse)
async def patch_case_task(
    case_id: str,
    task_id: str,
    payload: CaseTaskPatchRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dep),
) -> CaseTaskResponse:
    case = await case_service.get_accessible_case(db, case_id=case_id, user_email=user.email)
    task = await case_service.patch_case_task(db, case_id=case.id, task_id=task_id, payload=payload)
    return _serialize_case_task(task)
