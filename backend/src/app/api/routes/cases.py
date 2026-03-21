from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session_dep, get_current_user, get_request_id
from app.core.config import get_settings
from app.models import Case, CaseTask, CaseTaskStatus, DocumentState, MalwareScanStatus, User
from app.schemas.cases import (
    CaseActivationConfirmRequest,
    CaseActivationUploadInitRequest,
    CaseActivationUploadInitResponse,
    CaseActivityEventResponse,
    CaseReportResponse,
    CaseSummaryResponse,
    CaseTaskEvidenceResponse,
    CaseTaskEvidenceUploadInitRequest,
    CaseTaskEvidenceUploadInitResponse,
    CaseTaskPatchRequest,
    CaseTaskResponse,
    CaseTaskStatusCounts,
)
from app.schemas.documents import DocumentDownloadResponse, ScanDispatchResponse
from app.services import cases as case_service
from app.services import documents as document_service
from app.workers.tasks import enqueue_malware_scan

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


def _serialize_case_task(task: CaseTask, *, evidence_count: int) -> CaseTaskResponse:
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
        evidence_count=evidence_count,
        evidence_document_id=task.evidence_document_id,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


def _serialize_case_task_evidence(snapshot: case_service.CaseTaskEvidenceSnapshot) -> CaseTaskEvidenceResponse:
    scan_status = snapshot.scan.status.value if snapshot.scan else None
    scan_summary = None
    if snapshot.scan:
        scan_summary = snapshot.scan.result_summary or snapshot.scan.last_error

    download_available = (
        snapshot.document.state == DocumentState.ACTIVE
        and snapshot.document.current_version_id == (snapshot.version.id if snapshot.version else None)
        and snapshot.scan is not None
        and snapshot.scan.status == MalwareScanStatus.CLEAN
    )
    return CaseTaskEvidenceResponse(
        id=snapshot.evidence.id,
        document_id=snapshot.document.id,
        file_name=snapshot.evidence.file_name,
        content_type=snapshot.evidence.content_type,
        document_state=snapshot.document.state.value,
        scan_status=scan_status,
        scan_summary=scan_summary,
        created_at=snapshot.evidence.created_at,
        download_available=download_available,
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
    request: Request,
    request_id: str | None = Depends(get_request_id),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dep),
) -> CaseSummaryResponse:
    case = await case_service.get_accessible_case(db, case_id=case_id, user_email=user.email)
    activated_case = await case_service.activate_case(
        db,
        case=case,
        document_id=payload.document_id,
        version_id=payload.version_id,
        actor_id=user.id,
        request_id=request_id,
        client_ip=request.client.host if request.client else None,
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
    evidence_counts = await case_service.get_case_task_evidence_counts(db, task_ids=[task.id for task in tasks])
    return [_serialize_case_task(task, evidence_count=evidence_counts.get(task.id, 0)) for task in tasks]


@router.patch("/{case_id}/tasks/{task_id}", response_model=CaseTaskResponse)
async def patch_case_task(
    case_id: str,
    task_id: str,
    payload: CaseTaskPatchRequest,
    request: Request,
    request_id: str | None = Depends(get_request_id),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dep),
) -> CaseTaskResponse:
    case = await case_service.get_accessible_case(db, case_id=case_id, user_email=user.email)
    task = await case_service.patch_case_task(
        db,
        case_id=case.id,
        task_id=task_id,
        payload=payload,
        actor_id=user.id,
        request_id=request_id,
        client_ip=request.client.host if request.client else None,
    )
    evidence_count = await case_service.get_case_task_evidence_count(db, task_id=task.id)
    return _serialize_case_task(task, evidence_count=evidence_count)


@router.get("/{case_id}/activity", response_model=list[CaseActivityEventResponse])
async def get_case_activity(
    case_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dep),
) -> list[CaseActivityEventResponse]:
    case = await case_service.get_accessible_case(db, case_id=case_id, user_email=user.email)
    return await case_service.list_case_activity_events(db, case_id=case.id)


@router.get("/{case_id}/tasks/{task_id}/evidence", response_model=list[CaseTaskEvidenceResponse])
async def list_case_task_evidence(
    case_id: str,
    task_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dep),
) -> list[CaseTaskEvidenceResponse]:
    case = await case_service.get_accessible_case(db, case_id=case_id, user_email=user.email)
    await case_service.get_case_task(db, case_id=case.id, task_id=task_id)
    snapshots = await case_service.list_case_evidence_snapshots(db, case_id=case.id, task_id=task_id)
    return [_serialize_case_task_evidence(snapshot) for snapshot in snapshots]


@router.post(
    "/{case_id}/tasks/{task_id}/evidence/uploads/init",
    response_model=CaseTaskEvidenceUploadInitResponse,
    status_code=status.HTTP_201_CREATED,
)
async def init_case_task_evidence_upload(
    case_id: str,
    task_id: str,
    payload: CaseTaskEvidenceUploadInitRequest,
    request: Request,
    request_id: str | None = Depends(get_request_id),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dep),
) -> CaseTaskEvidenceUploadInitResponse:
    case = await case_service.get_accessible_case(db, case_id=case_id, user_email=user.email)
    evidence, result = await case_service.init_case_task_evidence_upload(
        db,
        case=case,
        task_id=task_id,
        file_name=payload.file_name,
        size_bytes=payload.size_bytes,
        content_type=payload.content_type,
        sha256=payload.sha256,
        actor_id=user.id,
        request_id=request_id,
        client_ip=request.client.host if request.client else None,
    )
    settings = get_settings()
    return CaseTaskEvidenceUploadInitResponse(
        evidence_id=evidence.id,
        document_id=result.document.id,
        version_id=result.version.id,
        version_no=result.version.version_no,
        object_key=result.version.object_key,
        upload_url=result.upload_url,
        upload_url_expires_in_seconds=settings.upload_url_ttl_minutes * 60,
        plaintext_dek_b64=result.plaintext_dek_b64,
        kms_key_id=result.kms_key_id,
    )


@router.post("/{case_id}/tasks/{task_id}/evidence/{evidence_id}/scan", response_model=ScanDispatchResponse)
async def queue_case_task_evidence_scan(
    case_id: str,
    task_id: str,
    evidence_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dep),
) -> ScanDispatchResponse:
    case = await case_service.get_accessible_case(db, case_id=case_id, user_email=user.email)
    snapshot = await case_service.get_case_task_evidence_snapshot(
        db,
        case_id=case.id,
        task_id=task_id,
        evidence_id=evidence_id,
    )
    if snapshot.version is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidence version not found")
    if snapshot.scan and snapshot.scan.status == MalwareScanStatus.RUNNING:
        return ScanDispatchResponse(version_id=snapshot.version.id, status="running")
    if snapshot.scan and snapshot.scan.status in {MalwareScanStatus.CLEAN, MalwareScanStatus.INFECTED}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Evidence scan already completed")

    settings = get_settings()
    if settings.celery_task_always_eager:
        await document_service.orchestrate_malware_scan(db, snapshot.version.id)
        return ScanDispatchResponse(version_id=snapshot.version.id, status="processed")
    enqueue_malware_scan(snapshot.version.id)
    return ScanDispatchResponse(version_id=snapshot.version.id, status="queued")


@router.get("/{case_id}/tasks/{task_id}/evidence/{evidence_id}/download", response_model=DocumentDownloadResponse)
async def get_case_task_evidence_download(
    case_id: str,
    task_id: str,
    evidence_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dep),
) -> DocumentDownloadResponse:
    case = await case_service.get_accessible_case(db, case_id=case_id, user_email=user.email)
    snapshot = await case_service.get_case_task_evidence_snapshot(
        db,
        case_id=case.id,
        task_id=task_id,
        evidence_id=evidence_id,
    )
    serialized = _serialize_case_task_evidence(snapshot)
    if not serialized.download_available:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Evidence is not ready for download")

    settings = get_settings()
    download_url = await document_service.get_document_download_url(db, snapshot.document.id)
    return DocumentDownloadResponse(
        download_url=download_url,
        expires_in_seconds=settings.download_url_ttl_minutes * 60,
    )


@router.get("/{case_id}/report", response_model=CaseReportResponse)
async def get_case_report(
    case_id: str,
    request: Request,
    request_id: str | None = Depends(get_request_id),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dep),
) -> CaseReportResponse:
    case = await case_service.get_accessible_case(db, case_id=case_id, user_email=user.email)
    return await case_service.build_case_report(
        db,
        case=case,
        actor_id=user.id,
        request_id=request_id,
        client_ip=request.client.host if request.client else None,
    )
