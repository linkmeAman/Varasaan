from __future__ import annotations

from hmac import compare_digest

from fastapi import APIRouter, Depends, Header, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session_dep, get_request_id
from app.core.config import get_settings
from app.models import Case, CaseActivationReviewStatus, User
from app.schemas.cases import (
    InternalCaseReviewApproveRequest,
    InternalCaseReviewRejectRequest,
    InternalCaseReviewResponse,
)
from app.services import cases as case_service

router = APIRouter(prefix="/internal/case-reviews", tags=["internal-case-reviews"], include_in_schema=False)


def _display_owner_name(owner: User | None, fallback_email: str) -> str:
    if owner and owner.full_name:
        normalized = owner.full_name.strip()
        if normalized:
            return normalized
    return fallback_email


async def _require_internal_api_key(
    x_internal_api_key: str | None = Header(default=None, alias="X-Internal-Api-Key"),
) -> None:
    if not x_internal_api_key or not compare_digest(x_internal_api_key, get_settings().internal_api_key):
        from fastapi import HTTPException

        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid internal API key")


async def _serialize_internal_case_review(db: AsyncSession, case: Case) -> InternalCaseReviewResponse:
    owner = await db.get(User, case.owner_user_id)
    owner_email = owner.email if owner else ""
    return InternalCaseReviewResponse(
        id=case.id,
        owner_user_id=case.owner_user_id,
        owner_name=_display_owner_name(owner, owner_email),
        owner_email=owner_email,
        status=case.status,
        activation_review_status=case.activation_review_status,
        activation_review_reason=case.activation_review_reason,
        activation_review_note=case.activation_review_note,
        activation_review_requested_at=case.activation_review_requested_at,
        activation_review_updated_at=case.activation_review_updated_at,
        death_certificate_document_id=case.death_certificate_document_id,
        death_certificate_version_id=case.death_certificate_version_id,
        death_certificate_sanitized_at=case.death_certificate_sanitized_at,
        death_certificate_metadata_stripped=case.death_certificate_metadata_stripped,
        activated_at=case.activated_at,
        created_at=case.created_at,
        updated_at=case.updated_at,
    )


@router.get("", response_model=list[InternalCaseReviewResponse], include_in_schema=False)
async def list_internal_case_reviews(
    review_status: CaseActivationReviewStatus | None = CaseActivationReviewStatus.PENDING_REVIEW,
    _authorized: None = Depends(_require_internal_api_key),
    db: AsyncSession = Depends(db_session_dep),
) -> list[InternalCaseReviewResponse]:
    cases = await case_service.list_internal_case_reviews(db, review_status=review_status)
    return [await _serialize_internal_case_review(db, case) for case in cases]


@router.get("/{case_id}", response_model=InternalCaseReviewResponse, include_in_schema=False)
async def get_internal_case_review(
    case_id: str,
    _authorized: None = Depends(_require_internal_api_key),
    db: AsyncSession = Depends(db_session_dep),
) -> InternalCaseReviewResponse:
    case = await case_service.get_case_for_internal_review(db, case_id=case_id)
    return await _serialize_internal_case_review(db, case)


@router.post("/{case_id}/approve", response_model=InternalCaseReviewResponse, include_in_schema=False)
async def approve_internal_case_review(
    case_id: str,
    payload: InternalCaseReviewApproveRequest,
    request: Request,
    request_id: str | None = Depends(get_request_id),
    _authorized: None = Depends(_require_internal_api_key),
    db: AsyncSession = Depends(db_session_dep),
) -> InternalCaseReviewResponse:
    case = await case_service.get_case_for_internal_review(db, case_id=case_id)
    reviewed = await case_service.approve_case_activation_review(
        db,
        case=case,
        request_id=request_id,
        client_ip=request.client.host if request.client else None,
        note=payload.note,
    )
    return await _serialize_internal_case_review(db, reviewed)


@router.post("/{case_id}/reject", response_model=InternalCaseReviewResponse, include_in_schema=False)
async def reject_internal_case_review(
    case_id: str,
    payload: InternalCaseReviewRejectRequest,
    request: Request,
    request_id: str | None = Depends(get_request_id),
    _authorized: None = Depends(_require_internal_api_key),
    db: AsyncSession = Depends(db_session_dep),
) -> InternalCaseReviewResponse:
    case = await case_service.get_case_for_internal_review(db, case_id=case_id)
    reviewed = await case_service.reject_case_activation_review(
        db,
        case=case,
        reason=payload.reason,
        note=payload.note,
        request_id=request_id,
        client_ip=request.client.host if request.client else None,
    )
    return await _serialize_internal_case_review(db, reviewed)
