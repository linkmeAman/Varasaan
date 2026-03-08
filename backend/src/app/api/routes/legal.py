from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session_dep
from app.models import LegalPolicyVersion
from app.schemas.legal import LegalPolicyCreateRequest, LegalPolicyResponse
from app.services.legal import list_active_policies

router = APIRouter(prefix="/legal", tags=["legal"])


@router.post("/policies", response_model=LegalPolicyResponse, status_code=status.HTTP_201_CREATED)
async def create_policy(payload: LegalPolicyCreateRequest, db: AsyncSession = Depends(db_session_dep)) -> LegalPolicyResponse:
    policy = LegalPolicyVersion(
        policy_type=payload.policy_type,
        version=payload.version,
        effective_from=payload.effective_from,
        is_active=payload.is_active,
        checksum=payload.checksum,
    )
    db.add(policy)
    await db.flush()
    return LegalPolicyResponse(
        id=policy.id,
        policy_type=policy.policy_type,
        version=policy.version,
        effective_from=policy.effective_from,
        is_active=policy.is_active,
        checksum=policy.checksum,
    )


@router.get("/policies", response_model=list[LegalPolicyResponse])
async def get_policies(db: AsyncSession = Depends(db_session_dep)) -> list[LegalPolicyResponse]:
    policies = await list_active_policies(db)
    if not policies:
        result = await db.execute(select(LegalPolicyVersion))
        policies = list(result.scalars().all())
    return [
        LegalPolicyResponse(
            id=policy.id,
            policy_type=policy.policy_type,
            version=policy.version,
            effective_from=policy.effective_from,
            is_active=policy.is_active,
            checksum=policy.checksum,
        )
        for policy in policies
    ]
