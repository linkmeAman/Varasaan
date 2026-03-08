from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import LegalPolicyVersion, PolicyType


async def get_active_policy(db: AsyncSession, policy_type: PolicyType) -> LegalPolicyVersion | None:
    now = datetime.now(UTC)
    result = await db.execute(
        select(LegalPolicyVersion)
        .where(LegalPolicyVersion.policy_type == policy_type)
        .where(LegalPolicyVersion.is_active.is_(True))
        .where(LegalPolicyVersion.effective_from <= now)
        .order_by(LegalPolicyVersion.effective_from.desc())
    )
    return result.scalars().first()


async def list_active_policies(db: AsyncSession) -> list[LegalPolicyVersion]:
    now = datetime.now(UTC)
    result = await db.execute(
        select(LegalPolicyVersion)
        .where(LegalPolicyVersion.is_active.is_(True))
        .where(LegalPolicyVersion.effective_from <= now)
    )
    return list(result.scalars().all())
