from __future__ import annotations

import hashlib
import logging
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.datetime_utils import as_utc
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    generate_token_secret,
    hash_password,
    hash_token,
    verify_password,
)
from app.integrations.email import get_email_client
from app.models import (
    AccountRecoveryRequest,
    Consent,
    PolicyType,
    RecoveryMode,
    RecoveryRequestStatus,
    Session,
    TrustedContact,
    TrustedContactStatus,
    User,
)
from app.schemas.auth import SignupRequest
from app.services.audit import create_audit_log
from app.services.legal import get_active_policy

logger = logging.getLogger(__name__)


def _hash_ip(ip: str | None) -> str | None:
    if not ip:
        return None
    return hashlib.sha256(ip.encode("utf-8")).hexdigest()


def _require_utc(value: datetime | None, *, detail: str) -> datetime:
    normalized = as_utc(value)
    if normalized is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)
    return normalized


async def create_user(db: AsyncSession, payload: SignupRequest, client_ip: str | None) -> tuple[User, str]:
    existing = await db.execute(select(User).where(User.email == payload.email.lower()))
    if existing.scalars().first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")

    active_privacy = await get_active_policy(db, PolicyType.PRIVACY)
    active_terms = await get_active_policy(db, PolicyType.TERMS)
    if not active_privacy or not active_terms:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Policies unavailable")

    accepted = {item.policy_type: item.policy_version for item in payload.consents}
    if accepted.get(PolicyType.PRIVACY) != active_privacy.version:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Privacy policy mismatch")
    if accepted.get(PolicyType.TERMS) != active_terms.version:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Terms policy mismatch")

    verification_token = generate_token_secret()
    user = User(
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        phone=payload.phone,
        jurisdiction_code=payload.jurisdiction_code,
        email_verification_token_hash=hash_token(verification_token),
        email_verification_expires_at=datetime.now(UTC) + timedelta(hours=24),
    )
    db.add(user)
    await db.flush()

    for policy_type, version in accepted.items():
        db.add(
            Consent(
                user_id=user.id,
                policy_type=policy_type,
                policy_version=version,
                ip_hash=_hash_ip(client_ip),
            )
        )

    await create_audit_log(
        db,
        actor_id=user.id,
        action="signup_created",
        entity_type="user",
        entity_id=user.id,
        request_id=None,
        ip_hash=_hash_ip(client_ip),
        metadata={"email": user.email, "email_verification_token": "redacted"},
    )

    try:
        await get_email_client().send_verification_email(to_email=user.email, token=verification_token)
    except Exception as exc:  # pragma: no cover
        logger.warning("verification email dispatch failed for %s: %s", user.email, exc)

    return user, verification_token


async def verify_email(db: AsyncSession, token: str) -> None:
    token_hash = hash_token(token)
    result = await db.execute(select(User).where(User.email_verification_token_hash == token_hash))
    user = result.scalars().first()
    if not user or not user.email_verification_expires_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token")
    email_verification_expires_at = _require_utc(user.email_verification_expires_at, detail="Invalid token")
    if email_verification_expires_at < datetime.now(UTC):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token expired")

    user.email_verified = True
    user.email_verification_token_hash = None
    user.email_verification_expires_at = None


async def login(db: AsyncSession, email: str, password: str) -> tuple[str, datetime, str, datetime]:
    result = await db.execute(select(User).where(User.email == email.lower()))
    user = result.scalars().first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.email_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email verification required")

    access_token, access_expires, jti = create_access_token(user.id)
    refresh_token, refresh_expires = create_refresh_token(user.id)

    session = Session(
        user_id=user.id,
        refresh_token_hash=hash_token(refresh_token),
        access_jti=jti,
        expires_at=refresh_expires,
    )
    db.add(session)
    await db.flush()

    return access_token, access_expires, refresh_token, refresh_expires


async def refresh_session(db: AsyncSession, refresh_token: str) -> tuple[str, datetime, str, datetime]:
    token_hash = hash_token(refresh_token)
    result = await db.execute(select(Session).where(Session.refresh_token_hash == token_hash))
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
    if session.revoked_at is not None:
        await revoke_all_sessions(db, session.user_id)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session revoked")
    session_expires_at = _require_utc(session.expires_at, detail="Invalid session")
    if session_expires_at < datetime.now(UTC):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")

    user_result = await db.execute(select(User).where(User.id == session.user_id))
    user = user_result.scalars().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user")

    access_token, access_expires, jti = create_access_token(user.id)
    new_refresh, refresh_expires = create_refresh_token(user.id)

    new_session = Session(
        user_id=user.id,
        refresh_token_hash=hash_token(new_refresh),
        access_jti=jti,
        expires_at=refresh_expires,
        parent_session_id=session.id,
    )
    db.add(new_session)
    await db.flush()

    session.revoked_at = datetime.now(UTC)
    session.replaced_by_session_id = new_session.id
    return access_token, access_expires, new_refresh, refresh_expires


async def revoke_session(db: AsyncSession, refresh_token: str) -> None:
    token_hash = hash_token(refresh_token)
    result = await db.execute(select(Session).where(Session.refresh_token_hash == token_hash))
    session = result.scalars().first()
    if session and session.revoked_at is None:
        session.revoked_at = datetime.now(UTC)


async def revoke_all_sessions(db: AsyncSession, user_id: str) -> None:
    result = await db.execute(select(Session).where(and_(Session.user_id == user_id, Session.revoked_at.is_(None))))
    now = datetime.now(UTC)
    for session in result.scalars().all():
        session.revoked_at = now


async def password_reset_request(db: AsyncSession, email: str) -> str | None:
    result = await db.execute(select(User).where(User.email == email.lower()))
    user = result.scalars().first()
    if not user:
        return None

    settings = get_settings()
    token = generate_token_secret()
    user.password_reset_token_hash = hash_token(token)
    user.password_reset_expires_at = datetime.now(UTC) + timedelta(minutes=settings.password_reset_token_ttl_minutes)

    try:
        await get_email_client().send_password_reset_email(to_email=user.email, token=token)
    except Exception as exc:  # pragma: no cover
        logger.warning("password reset email dispatch failed for %s: %s", user.email, exc)

    return token


async def password_reset_confirm(db: AsyncSession, token: str, new_password: str) -> None:
    token_hash = hash_token(token)
    result = await db.execute(select(User).where(User.password_reset_token_hash == token_hash))
    user = result.scalars().first()
    if not user or not user.password_reset_expires_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset token")
    password_reset_expires_at = _require_utc(user.password_reset_expires_at, detail="Invalid reset token")
    if password_reset_expires_at < datetime.now(UTC):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reset token expired")

    user.password_hash = hash_password(new_password)
    user.password_reset_token_hash = None
    user.password_reset_expires_at = None
    user.password_changed_at = datetime.now(UTC)
    await revoke_all_sessions(db, user.id)


async def resolve_access_token_subject(db: AsyncSession, token: str) -> User:
    payload = decode_access_token(token)
    user_id = payload.get("sub")
    token_iat = payload.get("iat")
    if not user_id or not token_iat:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token user")

    password_changed_at = _require_utc(user.password_changed_at, detail="Invalid token user")
    if int(password_changed_at.timestamp()) > int(token_iat):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired by password change")

    return user


async def request_account_recovery(
    db: AsyncSession,
    *,
    email: str,
    mode: str,
    trusted_contact_email: str | None = None,
) -> tuple[AccountRecoveryRequest | None, str | None, str | None]:
    settings = get_settings()
    now = datetime.now(UTC)
    recovery_mode = RecoveryMode(mode)
    normalized_email = email.lower().strip()
    trusted_contact = None

    if recovery_mode == RecoveryMode.PRIMARY_EMAIL:
        result = await db.execute(select(User).where(User.email == normalized_email))
        user = result.scalars().first()
    elif recovery_mode == RecoveryMode.BACKUP_EMAIL:
        result = await db.execute(
            select(User).where(
                User.backup_recovery_email == normalized_email,
                User.backup_recovery_email_verified.is_(True),
            )
        )
        user = result.scalars().first()
    else:
        result = await db.execute(select(User).where(User.email == normalized_email))
        user = result.scalars().first()
        if user and trusted_contact_email:
            contact_result = await db.execute(
                select(TrustedContact).where(
                    TrustedContact.user_id == user.id,
                    TrustedContact.email == trusted_contact_email.lower().strip(),
                    TrustedContact.status == TrustedContactStatus.ACTIVE,
                    TrustedContact.recovery_enabled.is_(True),
                )
            )
            trusted_contact = contact_result.scalars().first()
        else:
            trusted_contact = None
        if not trusted_contact:
            user = None

    if not user:
        return None, None, None

    cooldown_cutoff = now - timedelta(minutes=settings.recovery_request_cooldown_minutes)
    cooldown_result = await db.execute(
        select(AccountRecoveryRequest)
        .where(
            AccountRecoveryRequest.user_id == user.id,
            AccountRecoveryRequest.mode == recovery_mode,
            AccountRecoveryRequest.created_at >= cooldown_cutoff,
            AccountRecoveryRequest.status.in_(
                [
                    RecoveryRequestStatus.PENDING,
                    RecoveryRequestStatus.APPROVAL_PENDING,
                    RecoveryRequestStatus.APPROVED,
                ]
            ),
        )
        .order_by(AccountRecoveryRequest.created_at.desc())
    )
    if cooldown_result.scalars().first():
        return None, None, None

    recovery_token = generate_token_secret()
    approval_token = generate_token_secret() if recovery_mode == RecoveryMode.TRUSTED_CONTACT else None
    request = AccountRecoveryRequest(
        user_id=user.id,
        mode=recovery_mode,
        status=(
            RecoveryRequestStatus.APPROVAL_PENDING
            if recovery_mode == RecoveryMode.TRUSTED_CONTACT
            else RecoveryRequestStatus.PENDING
        ),
        trusted_contact_id=trusted_contact.id if trusted_contact else None,
        recovery_token_hash=hash_token(recovery_token),
        approval_token_hash=hash_token(approval_token) if approval_token else None,
        expires_at=now + timedelta(minutes=settings.recovery_token_ttl_minutes),
    )
    db.add(request)
    await db.flush()

    try:
        await get_email_client().send_recovery_email(
            to_email=user.email,
            token=recovery_token,
            mode=recovery_mode.value,
        )
        if recovery_mode == RecoveryMode.TRUSTED_CONTACT and approval_token and trusted_contact:
            await get_email_client().send_recovery_approval_email(
                to_email=trusted_contact.email,
                token=approval_token,
            )
    except Exception as exc:  # pragma: no cover
        logger.warning("account recovery email dispatch failed for %s: %s", user.email, exc)

    return request, recovery_token, approval_token


async def approve_trusted_contact_recovery(db: AsyncSession, approval_token: str) -> None:
    token_hash = hash_token(approval_token)
    result = await db.execute(select(AccountRecoveryRequest).where(AccountRecoveryRequest.approval_token_hash == token_hash))
    request = result.scalars().first()
    if not request:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid recovery approval token")
    if request.mode != RecoveryMode.TRUSTED_CONTACT:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid recovery mode")
    request_expires_at = _require_utc(request.expires_at, detail="Invalid recovery approval token")
    if request_expires_at < datetime.now(UTC):
        request.status = RecoveryRequestStatus.EXPIRED
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Recovery request expired")
    if request.completed_at is not None:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Recovery request already completed")

    request.approved_at = datetime.now(UTC)
    request.status = RecoveryRequestStatus.APPROVED


async def complete_account_recovery(db: AsyncSession, recovery_token: str, new_password: str) -> None:
    token_hash = hash_token(recovery_token)
    result = await db.execute(select(AccountRecoveryRequest).where(AccountRecoveryRequest.recovery_token_hash == token_hash))
    request = result.scalars().first()
    if not request:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid recovery token")
    request_expires_at = _require_utc(request.expires_at, detail="Invalid recovery token")
    if request_expires_at < datetime.now(UTC):
        request.status = RecoveryRequestStatus.EXPIRED
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Recovery token expired")
    if request.completed_at is not None:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Recovery token already used")
    if request.mode == RecoveryMode.TRUSTED_CONTACT and request.approved_at is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Trusted contact approval pending")

    user = await db.get(User, request.user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Recovery target not found")

    user.password_hash = hash_password(new_password)
    user.password_changed_at = datetime.now(UTC)
    await revoke_all_sessions(db, user.id)

    request.status = RecoveryRequestStatus.COMPLETED
    request.completed_at = datetime.now(UTC)
    request.recovery_token_hash = hash_token(generate_token_secret())
    request.approval_token_hash = hash_token(generate_token_secret()) if request.approval_token_hash else None
