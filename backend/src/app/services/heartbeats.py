from __future__ import annotations

import hashlib
import logging
from datetime import UTC, datetime, timedelta
from enum import StrEnum

from dateutil.relativedelta import relativedelta
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_utils import as_utc
from app.integrations.email import get_email_client
from app.models import (
    Heartbeat,
    HeartbeatCadence,
    HeartbeatStatus,
    TrustedContact,
    TrustedContactRole,
    TrustedContactStatus,
    User,
)
from app.schemas.heartbeats import HeartbeatResponse, HeartbeatUpsertRequest
from app.services.audit import create_audit_log

logger = logging.getLogger(__name__)

PRE_DUE_REMINDER_DAYS = 7
SECOND_OVERDUE_REMINDER_DAYS = 7
FINAL_ESCALATION_DAYS = 14
PROCESSABLE_HEARTBEAT_STATUSES = (HeartbeatStatus.ACTIVE, HeartbeatStatus.OVERDUE)


class HeartbeatReminderStage(StrEnum):
    PRE_DUE = "pre_due"
    OVERDUE_DAY_0 = "overdue_day_0"
    OVERDUE_DAY_7 = "overdue_day_7"
    OVERDUE_DAY_14 = "overdue_day_14"


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _hash_ip(ip: str | None) -> str | None:
    if not ip:
        return None
    return hashlib.sha256(ip.encode("utf-8")).hexdigest()


def _cadence_delta(cadence: HeartbeatCadence) -> relativedelta:
    months = 1 if cadence == HeartbeatCadence.MONTHLY else 3
    return relativedelta(months=months)


def _compute_next_expected_at(reference_time: datetime, cadence: HeartbeatCadence) -> datetime:
    return reference_time + _cadence_delta(cadence)


def _compute_pre_due_at(next_expected_at: datetime) -> datetime:
    return next_expected_at - timedelta(days=PRE_DUE_REMINDER_DAYS)


def _reset_schedule(heartbeat: Heartbeat, *, reference_time: datetime) -> None:
    normalized_reference = as_utc(reference_time) or reference_time
    next_expected_at = _compute_next_expected_at(normalized_reference, heartbeat.cadence)
    heartbeat.status = HeartbeatStatus.ACTIVE
    heartbeat.last_checked_in_at = normalized_reference
    heartbeat.next_expected_at = next_expected_at
    heartbeat.next_action_at = _compute_pre_due_at(next_expected_at)
    heartbeat.pre_due_notice_sent_at = None
    heartbeat.escalation_level = 0
    heartbeat.last_reminder_sent_at = None
    heartbeat.executor_notified_at = None


def _pause_schedule(heartbeat: Heartbeat) -> None:
    heartbeat.status = HeartbeatStatus.PAUSED
    heartbeat.next_expected_at = None
    heartbeat.next_action_at = None
    heartbeat.pre_due_notice_sent_at = None
    heartbeat.escalation_level = 0
    heartbeat.last_reminder_sent_at = None
    heartbeat.executor_notified_at = None


def _determine_due_stage(heartbeat: Heartbeat, *, now: datetime) -> HeartbeatReminderStage | None:
    next_expected_at = as_utc(heartbeat.next_expected_at)
    if next_expected_at is None:
        return None

    if heartbeat.escalation_level < 3 and now >= next_expected_at + timedelta(days=FINAL_ESCALATION_DAYS):
        return HeartbeatReminderStage.OVERDUE_DAY_14
    if heartbeat.escalation_level < 2 and now >= next_expected_at + timedelta(days=SECOND_OVERDUE_REMINDER_DAYS):
        return HeartbeatReminderStage.OVERDUE_DAY_7
    if heartbeat.escalation_level < 1 and now >= next_expected_at:
        return HeartbeatReminderStage.OVERDUE_DAY_0
    if heartbeat.pre_due_notice_sent_at is None and now >= _compute_pre_due_at(next_expected_at):
        return HeartbeatReminderStage.PRE_DUE
    return None


async def _count_recovery_contacts(db: AsyncSession, user_id: str) -> int:
    result = await db.execute(
        select(func.count(TrustedContact.id)).where(
            TrustedContact.user_id == user_id,
            TrustedContact.role == TrustedContactRole.RECOVERY_ASSIST,
            TrustedContact.status == TrustedContactStatus.ACTIVE,
            TrustedContact.recovery_enabled.is_(True),
        )
    )
    return int(result.scalar_one())


async def _list_recovery_contacts(db: AsyncSession, user_id: str) -> list[TrustedContact]:
    result = await db.execute(
        select(TrustedContact).where(
            TrustedContact.user_id == user_id,
            TrustedContact.role == TrustedContactRole.RECOVERY_ASSIST,
            TrustedContact.status == TrustedContactStatus.ACTIVE,
            TrustedContact.recovery_enabled.is_(True),
        )
    )
    return list(result.scalars().all())


async def _build_response(db: AsyncSession, *, user_id: str, heartbeat: Heartbeat | None) -> HeartbeatResponse:
    recovery_contact_count = await _count_recovery_contacts(db, user_id)
    if heartbeat is None:
        return HeartbeatResponse(
            configured=False,
            enabled=False,
            cadence=None,
            status="unconfigured",
            recovery_contact_count=recovery_contact_count,
        )

    return HeartbeatResponse(
        configured=True,
        enabled=heartbeat.status != HeartbeatStatus.PAUSED,
        cadence=heartbeat.cadence,
        status=heartbeat.status.value,
        last_checked_in_at=as_utc(heartbeat.last_checked_in_at),
        next_expected_at=as_utc(heartbeat.next_expected_at),
        next_action_at=as_utc(heartbeat.next_action_at),
        escalation_level=heartbeat.escalation_level,
        executor_notified_at=as_utc(heartbeat.executor_notified_at),
        recovery_contact_count=recovery_contact_count,
    )


async def get_user_heartbeat(db: AsyncSession, user_id: str) -> Heartbeat | None:
    result = await db.execute(select(Heartbeat).where(Heartbeat.user_id == user_id))
    return result.scalars().first()


async def get_heartbeat_response(db: AsyncSession, user_id: str) -> HeartbeatResponse:
    heartbeat = await get_user_heartbeat(db, user_id)
    return await _build_response(db, user_id=user_id, heartbeat=heartbeat)


async def upsert_heartbeat(
    db: AsyncSession,
    *,
    user: User,
    payload: HeartbeatUpsertRequest,
    request_id: str | None,
    client_ip: str | None,
) -> HeartbeatResponse:
    heartbeat = await get_user_heartbeat(db, user.id)
    if heartbeat is None:
        heartbeat = Heartbeat(user_id=user.id, cadence=payload.cadence)
        db.add(heartbeat)
        await db.flush()

    heartbeat.cadence = payload.cadence
    if payload.enabled:
        _reset_schedule(heartbeat, reference_time=_utc_now())
    else:
        _pause_schedule(heartbeat)

    await create_audit_log(
        db,
        actor_id=user.id,
        action="heartbeat_configured",
        entity_type="heartbeat",
        entity_id=heartbeat.id,
        request_id=request_id,
        ip_hash=_hash_ip(client_ip),
        metadata={"cadence": payload.cadence.value, "enabled": payload.enabled},
    )
    await db.flush()
    return await _build_response(db, user_id=user.id, heartbeat=heartbeat)


async def check_in_heartbeat(
    db: AsyncSession,
    *,
    user: User,
    request_id: str | None,
    client_ip: str | None,
) -> HeartbeatResponse:
    heartbeat = await get_user_heartbeat(db, user.id)
    if heartbeat is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Heartbeat not configured")
    if heartbeat.status == HeartbeatStatus.PAUSED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Heartbeat is paused")

    _reset_schedule(heartbeat, reference_time=_utc_now())
    await create_audit_log(
        db,
        actor_id=user.id,
        action="heartbeat_checked_in",
        entity_type="heartbeat",
        entity_id=heartbeat.id,
        request_id=request_id,
        ip_hash=_hash_ip(client_ip),
        metadata={"cadence": heartbeat.cadence.value},
    )
    await db.flush()
    return await _build_response(db, user_id=user.id, heartbeat=heartbeat)


async def list_due_heartbeat_ids(db: AsyncSession, *, now: datetime | None = None, limit: int = 100) -> list[str]:
    effective_now = as_utc(now) or _utc_now()
    result = await db.execute(
        select(Heartbeat.id)
        .where(Heartbeat.next_action_at.is_not(None))
        .where(Heartbeat.next_action_at <= effective_now)
        .where(Heartbeat.status.in_(PROCESSABLE_HEARTBEAT_STATUSES))
        .order_by(Heartbeat.next_action_at.asc(), Heartbeat.id.asc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def _load_heartbeat_for_processing(db: AsyncSession, heartbeat_id: str) -> Heartbeat | None:
    statement = select(Heartbeat).where(Heartbeat.id == heartbeat_id)
    bind = db.get_bind()
    if bind is not None and bind.dialect.name == "postgresql":
        statement = statement.with_for_update(skip_locked=True)
    result = await db.execute(statement)
    return result.scalars().first()


async def _record_reminder_audit(
    db: AsyncSession,
    *,
    heartbeat: Heartbeat,
    stage: HeartbeatReminderStage,
    metadata: dict | None = None,
) -> None:
    await create_audit_log(
        db,
        actor_id=None,
        action="heartbeat_reminder_sent",
        entity_type="heartbeat",
        entity_id=heartbeat.id,
        request_id=None,
        ip_hash=None,
        metadata={"stage": stage.value, **(metadata or {})},
    )


async def _record_contact_audit(
    db: AsyncSession,
    *,
    heartbeat: Heartbeat,
    action: str,
    metadata: dict | None = None,
) -> None:
    await create_audit_log(
        db,
        actor_id=None,
        action=action,
        entity_type="heartbeat",
        entity_id=heartbeat.id,
        request_id=None,
        ip_hash=None,
        metadata=metadata,
    )


async def _send_owner_reminder(
    *,
    owner: User,
    heartbeat: Heartbeat,
    stage: HeartbeatReminderStage,
    next_expected_at: datetime,
) -> None:
    try:
        await get_email_client().send_heartbeat_owner_reminder(
            to_email=owner.email,
            cadence=heartbeat.cadence.value,
            next_expected_at=next_expected_at,
            stage=stage.value,
        )
    except Exception as exc:  # pragma: no cover
        logger.warning("heartbeat owner reminder dispatch failed for %s: %s", owner.email, exc)


async def _notify_recovery_contacts(
    *,
    owner: User,
    contacts: list[TrustedContact],
    next_expected_at: datetime,
) -> int:
    delivered = 0
    for contact in contacts:
        try:
            await get_email_client().send_heartbeat_recovery_contact_notification(
                to_email=contact.email,
                owner_email=owner.email,
                owner_name=owner.full_name,
                next_expected_at=next_expected_at,
            )
            delivered += 1
        except Exception as exc:  # pragma: no cover
            logger.warning("heartbeat recovery contact notification failed for %s: %s", contact.email, exc)
    return delivered


async def process_due_heartbeat(
    db: AsyncSession,
    *,
    heartbeat_id: str,
    now: datetime | None = None,
) -> Heartbeat | None:
    effective_now = as_utc(now) or _utc_now()
    heartbeat = await _load_heartbeat_for_processing(db, heartbeat_id)
    if heartbeat is None:
        return None
    if heartbeat.status not in PROCESSABLE_HEARTBEAT_STATUSES:
        return heartbeat
    if heartbeat.next_action_at is None or (as_utc(heartbeat.next_action_at) or effective_now) > effective_now:
        return heartbeat

    stage = _determine_due_stage(heartbeat, now=effective_now)
    if stage is None:
        return heartbeat

    owner = await db.get(User, heartbeat.user_id)
    if owner is None:
        return heartbeat

    next_expected_at = as_utc(heartbeat.next_expected_at)
    if next_expected_at is None:
        return heartbeat

    await _send_owner_reminder(owner=owner, heartbeat=heartbeat, stage=stage, next_expected_at=next_expected_at)
    await _record_reminder_audit(db, heartbeat=heartbeat, stage=stage)

    if stage == HeartbeatReminderStage.PRE_DUE:
        heartbeat.pre_due_notice_sent_at = effective_now
        heartbeat.last_reminder_sent_at = effective_now
        heartbeat.status = HeartbeatStatus.ACTIVE
        heartbeat.next_action_at = next_expected_at
        await db.flush()
        return heartbeat

    if stage == HeartbeatReminderStage.OVERDUE_DAY_0:
        heartbeat.status = HeartbeatStatus.OVERDUE
        heartbeat.escalation_level = 1
        heartbeat.last_reminder_sent_at = effective_now
        heartbeat.next_action_at = next_expected_at + timedelta(days=SECOND_OVERDUE_REMINDER_DAYS)
        await db.flush()
        return heartbeat

    if stage == HeartbeatReminderStage.OVERDUE_DAY_7:
        heartbeat.status = HeartbeatStatus.OVERDUE
        heartbeat.escalation_level = 2
        heartbeat.last_reminder_sent_at = effective_now
        heartbeat.next_action_at = next_expected_at + timedelta(days=FINAL_ESCALATION_DAYS)
        await db.flush()
        return heartbeat

    contacts = await _list_recovery_contacts(db, owner.id)
    delivered = await _notify_recovery_contacts(owner=owner, contacts=contacts, next_expected_at=next_expected_at)
    heartbeat.status = HeartbeatStatus.ESCALATED
    heartbeat.escalation_level = 3
    heartbeat.last_reminder_sent_at = effective_now
    heartbeat.next_action_at = None
    if delivered:
        heartbeat.executor_notified_at = effective_now
        await _record_contact_audit(
            db,
            heartbeat=heartbeat,
            action="heartbeat_contact_notified",
            metadata={"contact_count": delivered},
        )
    else:
        await _record_contact_audit(
            db,
            heartbeat=heartbeat,
            action="heartbeat_contact_notify_skipped",
            metadata={"contact_count": len(contacts), "reason": "no_deliverable_recovery_contacts"},
        )
    await db.flush()
    return heartbeat

