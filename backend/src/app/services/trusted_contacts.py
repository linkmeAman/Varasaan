from datetime import UTC, datetime, timedelta
import logging

from fastapi import HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.datetime_utils import as_utc
from app.core.security import generate_token_secret, hash_token
from app.integrations.email import get_email_client
from app.models import InviteToken, TrustedContact, TrustedContactStatus, User
from app.schemas.trusted_contacts import TrustedContactCreateRequest

logger = logging.getLogger(__name__)


def _generic_invite_message() -> str:
    return "If the invite is valid, an email will be sent shortly."


async def create_trusted_contact(db: AsyncSession, user_id: str, payload: TrustedContactCreateRequest) -> TrustedContact:
    settings = get_settings()
    count_result = await db.execute(select(func.count(TrustedContact.id)).where(TrustedContact.user_id == user_id))
    if int(count_result.scalar_one()) >= settings.max_trusted_contacts:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Trusted contact limit reached")

    contact = TrustedContact(
        user_id=user_id,
        email=payload.email.lower(),
        name=payload.name,
        role=payload.role,
        recovery_enabled=payload.recovery_enabled,
    )
    db.add(contact)
    await db.flush()

    if contact.role.value == "executor":
        from app.services.cases import upsert_case_for_executor_contact

        await upsert_case_for_executor_contact(db, owner_user_id=user_id, trusted_contact=contact)

    return contact


async def send_invite(db: AsyncSession, user_id: str, trusted_contact_id: str, force_reissue: bool) -> tuple[str, str | None]:
    contact = await db.get(TrustedContact, trusted_contact_id)
    if not contact or contact.user_id != user_id:
        return _generic_invite_message(), None

    if contact.status == TrustedContactStatus.REVOKED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Contact is revoked")

    settings = get_settings()
    result = await db.execute(
        select(InviteToken)
        .where(InviteToken.trusted_contact_id == trusted_contact_id)
        .where(InviteToken.revoked_at.is_(None))
        .order_by(InviteToken.created_at.desc())
    )
    existing = result.scalars().first()

    if existing and not force_reissue and as_utc(existing.expires_at) > datetime.now(UTC):
        return _generic_invite_message(), None

    now = datetime.now(UTC)
    if existing and existing.send_count >= 3 and (now - as_utc(existing.created_at)).total_seconds() < 86400:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Invite resend limit reached")

    token = generate_token_secret()
    token_record = InviteToken(
        trusted_contact_id=trusted_contact_id,
        token_hash=hash_token(token),
        expires_at=now + timedelta(hours=settings.invite_token_ttl_hours),
        send_count=(existing.send_count + 1) if existing else 1,
    )
    if existing:
        existing.revoked_at = now
    db.add(token_record)
    await db.flush()

    inviter = await db.get(User, user_id)
    inviter_email = inviter.email if inviter else "a Varasaan user"
    try:
        await get_email_client().send_trusted_contact_invite(
            to_email=contact.email,
            token=token,
            inviter_email=inviter_email,
        )
    except Exception as exc:  # pragma: no cover
        logger.warning("trusted contact invite email dispatch failed for %s: %s", contact.email, exc)

    return _generic_invite_message(), token


async def accept_invite(db: AsyncSession, token: str) -> None:
    token_hash = hash_token(token)
    result = await db.execute(select(InviteToken).where(InviteToken.token_hash == token_hash))
    invite = result.scalars().first()
    if not invite or invite.revoked_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid invite")
    if as_utc(invite.expires_at) < datetime.now(UTC):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite expired")

    invite.used_at = datetime.now(UTC)
    contact = await db.get(TrustedContact, invite.trusted_contact_id)
    if contact:
        contact.status = TrustedContactStatus.ACTIVE


async def revoke_contact(db: AsyncSession, user_id: str, trusted_contact_id: str) -> None:
    contact = await db.get(TrustedContact, trusted_contact_id)
    if not contact or contact.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")

    contact.status = TrustedContactStatus.REVOKED
    now = datetime.now(UTC)
    result = await db.execute(
        select(InviteToken).where(
            and_(InviteToken.trusted_contact_id == trusted_contact_id, InviteToken.revoked_at.is_(None))
        )
    )
    for token in result.scalars().all():
        token.revoked_at = now
