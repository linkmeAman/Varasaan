from __future__ import annotations

import hmac
import json
from datetime import UTC, datetime
from hashlib import sha256

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import LegalPolicyVersion, PolicyType, User


async def seed_active_policies(db: AsyncSession) -> None:
    existing = await db.execute(select(LegalPolicyVersion))
    if existing.scalars().first():
        return
    db.add(
        LegalPolicyVersion(
            policy_type=PolicyType.PRIVACY,
            version="2026.03",
            effective_from=datetime(2026, 3, 1, tzinfo=UTC),
            checksum="privacy-2026-03",
            is_active=True,
        )
    )
    db.add(
        LegalPolicyVersion(
            policy_type=PolicyType.TERMS,
            version="2026.03",
            effective_from=datetime(2026, 3, 1, tzinfo=UTC),
            checksum="terms-2026-03",
            is_active=True,
        )
    )
    await db.commit()


async def mark_user_verified(db: AsyncSession, email: str) -> None:
    result = await db.execute(select(User).where(User.email == email.lower()))
    user = result.scalars().first()
    if not user:
        raise AssertionError(f"user {email} not found")
    user.email_verified = True
    user.email_verification_token_hash = None
    user.email_verification_expires_at = None
    await db.commit()


def sign_webhook(payload: dict, secret: str) -> tuple[bytes, str]:
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    sig = hmac.new(secret.encode("utf-8"), raw, sha256).hexdigest()
    return raw, sig
