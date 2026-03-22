from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.core.security import create_access_token
from app.core.datetime_utils import as_utc
from app.models import (
    AuditLog,
    Heartbeat,
    HeartbeatStatus,
    TrustedContact,
    TrustedContactRole,
    TrustedContactStatus,
    User,
)
from app.services import heartbeats as heartbeat_service

pytestmark = pytest.mark.integration


class RecordingEmailClient:
    def __init__(self) -> None:
        self.owner_reminders: list[dict[str, str]] = []
        self.contact_notifications: list[dict[str, str]] = []

    async def send_heartbeat_owner_reminder(
        self,
        *,
        to_email: str,
        cadence: str,
        next_expected_at: datetime,
        stage: str,
    ) -> None:
        self.owner_reminders.append(
            {
                "to_email": to_email,
                "cadence": cadence,
                "next_expected_at": next_expected_at.isoformat(),
                "stage": stage,
            }
        )

    async def send_heartbeat_recovery_contact_notification(
        self,
        *,
        to_email: str,
        owner_email: str,
        owner_name: str | None,
        next_expected_at: datetime,
    ) -> None:
        self.contact_notifications.append(
            {
                "to_email": to_email,
                "owner_email": owner_email,
                "owner_name": owner_name or "",
                "next_expected_at": next_expected_at.isoformat(),
            }
        )


def _auth_header(access_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {access_token}"}


async def _create_authenticated_user(test_context, *, email: str, full_name: str | None = None) -> dict:
    session_factory = test_context["session_factory"]
    async with session_factory() as db:
        user = User(
            email=email,
            password_hash="test-password-hash",
            full_name=full_name,
            email_verified=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    access_token, _expires_at, _jti = create_access_token(user.id)
    return {"id": user.id, "access_token": access_token}


async def _get_user_and_heartbeat(session_factory, email: str) -> tuple[User, Heartbeat]:
    async with session_factory() as db:
        user = (await db.execute(select(User).where(User.email == email))).scalars().one()
        heartbeat = (await db.execute(select(Heartbeat).where(Heartbeat.user_id == user.id))).scalars().one()
        return user, heartbeat


@pytest.mark.asyncio
async def test_heartbeat_configure_get_and_check_in_flow(test_context):
    client = test_context["client"]
    session_factory = test_context["session_factory"]
    user = await _create_authenticated_user(test_context, email="heartbeat-owner@example.com")

    configure_response = await client.put(
        "/api/v1/heartbeats/me",
        headers=_auth_header(user["access_token"]),
        json={"cadence": "monthly", "enabled": True},
    )
    assert configure_response.status_code == 200, configure_response.text
    configured = configure_response.json()
    assert configured["configured"] is True
    assert configured["enabled"] is True
    assert configured["cadence"] == "monthly"
    assert configured["status"] == "active"
    assert configured["recovery_contact_count"] == 0
    assert configured["next_expected_at"] is not None
    assert configured["next_action_at"] is not None

    get_response = await client.get("/api/v1/heartbeats/me", headers=_auth_header(user["access_token"]))
    assert get_response.status_code == 200, get_response.text
    assert get_response.json()["status"] == "active"

    async with session_factory() as db:
        heartbeat = (await db.execute(select(Heartbeat))).scalars().one()
        heartbeat.status = HeartbeatStatus.OVERDUE
        heartbeat.escalation_level = 2
        heartbeat.next_expected_at = datetime.now(UTC) - timedelta(days=1)
        heartbeat.next_action_at = datetime.now(UTC) - timedelta(hours=1)
        heartbeat.pre_due_notice_sent_at = datetime.now(UTC) - timedelta(days=8)
        heartbeat.last_reminder_sent_at = datetime.now(UTC) - timedelta(days=1)
        heartbeat.executor_notified_at = datetime.now(UTC) - timedelta(hours=2)
        await db.commit()

    check_in_response = await client.post(
        "/api/v1/heartbeats/me/check-in",
        headers=_auth_header(user["access_token"]),
    )
    assert check_in_response.status_code == 200, check_in_response.text
    checked_in = check_in_response.json()
    assert checked_in["status"] == "active"
    assert checked_in["enabled"] is True
    assert checked_in["escalation_level"] == 0
    assert checked_in["executor_notified_at"] is None

    async with session_factory() as db:
        heartbeat = (await db.execute(select(Heartbeat))).scalars().one()
        assert heartbeat.status == HeartbeatStatus.ACTIVE
        assert heartbeat.escalation_level == 0
        assert heartbeat.executor_notified_at is None
        audit_actions = [
            row.action
            for row in (await db.execute(select(AuditLog).where(AuditLog.entity_id == heartbeat.id).order_by(AuditLog.created_at.asc())))
            .scalars()
            .all()
        ]
        assert "heartbeat_configured" in audit_actions
        assert "heartbeat_checked_in" in audit_actions


@pytest.mark.asyncio
async def test_heartbeat_reminder_progression_and_contact_notification(test_context, monkeypatch: pytest.MonkeyPatch):
    client = test_context["client"]
    session_factory = test_context["session_factory"]
    user = await _create_authenticated_user(test_context, email="heartbeat-escalation@example.com")

    configure_response = await client.put(
        "/api/v1/heartbeats/me",
        headers=_auth_header(user["access_token"]),
        json={"cadence": "monthly", "enabled": True},
    )
    assert configure_response.status_code == 200, configure_response.text

    collector = RecordingEmailClient()
    monkeypatch.setattr("app.services.heartbeats.get_email_client", lambda: collector)

    due_at = datetime(2026, 1, 31, 9, 0, tzinfo=UTC)
    user_row, heartbeat = await _get_user_and_heartbeat(session_factory, "heartbeat-escalation@example.com")
    heartbeat_id = heartbeat.id

    async with session_factory() as db:
        tracked_heartbeat = await db.get(Heartbeat, heartbeat_id)
        tracked_heartbeat.last_checked_in_at = due_at - timedelta(days=31)
        tracked_heartbeat.next_expected_at = due_at
        tracked_heartbeat.next_action_at = due_at - timedelta(days=7)
        tracked_heartbeat.pre_due_notice_sent_at = None
        tracked_heartbeat.escalation_level = 0
        tracked_heartbeat.last_reminder_sent_at = None
        tracked_heartbeat.executor_notified_at = None
        tracked_heartbeat.status = HeartbeatStatus.ACTIVE
        db.add(
            TrustedContact(
                user_id=user_row.id,
                email="helper@example.com",
                name="Helper One",
                role=TrustedContactRole.RECOVERY_ASSIST,
                status=TrustedContactStatus.ACTIVE,
                recovery_enabled=True,
            )
        )
        await db.commit()

    async with session_factory() as db:
        await heartbeat_service.process_due_heartbeat(db, heartbeat_id=heartbeat_id, now=due_at - timedelta(days=6))
        await db.commit()

    async with session_factory() as db:
        tracked_heartbeat = await db.get(Heartbeat, heartbeat_id)
        assert tracked_heartbeat.pre_due_notice_sent_at is not None
        assert tracked_heartbeat.status == HeartbeatStatus.ACTIVE
        assert as_utc(tracked_heartbeat.next_action_at) == due_at

    async with session_factory() as db:
        await heartbeat_service.process_due_heartbeat(db, heartbeat_id=heartbeat_id, now=due_at + timedelta(minutes=5))
        await db.commit()

    async with session_factory() as db:
        tracked_heartbeat = await db.get(Heartbeat, heartbeat_id)
        assert tracked_heartbeat.status == HeartbeatStatus.OVERDUE
        assert tracked_heartbeat.escalation_level == 1
        assert as_utc(tracked_heartbeat.next_action_at) == due_at + timedelta(days=7)

    async with session_factory() as db:
        await heartbeat_service.process_due_heartbeat(
            db,
            heartbeat_id=heartbeat_id,
            now=due_at + timedelta(days=7, minutes=5),
        )
        await db.commit()

    async with session_factory() as db:
        tracked_heartbeat = await db.get(Heartbeat, heartbeat_id)
        assert tracked_heartbeat.status == HeartbeatStatus.OVERDUE
        assert tracked_heartbeat.escalation_level == 2
        assert as_utc(tracked_heartbeat.next_action_at) == due_at + timedelta(days=14)

    async with session_factory() as db:
        await heartbeat_service.process_due_heartbeat(
            db,
            heartbeat_id=heartbeat_id,
            now=due_at + timedelta(days=14, minutes=5),
        )
        await db.commit()

    async with session_factory() as db:
        tracked_heartbeat = await db.get(Heartbeat, heartbeat_id)
        assert tracked_heartbeat.status == HeartbeatStatus.ESCALATED
        assert tracked_heartbeat.escalation_level == 3
        assert tracked_heartbeat.next_action_at is None
        assert tracked_heartbeat.executor_notified_at is not None
        logs = (
            await db.execute(select(AuditLog).where(AuditLog.entity_id == heartbeat_id).order_by(AuditLog.created_at.asc()))
        ).scalars().all()
        reminder_count = sum(1 for log in logs if log.action == "heartbeat_reminder_sent")
        contact_actions = [log.action for log in logs if log.action.startswith("heartbeat_contact_")]
        assert reminder_count == 4
        assert contact_actions == ["heartbeat_contact_notified"]

    assert len(collector.owner_reminders) == 4
    assert [item["stage"] for item in collector.owner_reminders] == [
        "pre_due",
        "overdue_day_0",
        "overdue_day_7",
        "overdue_day_14",
    ]
    assert collector.contact_notifications == [
        {
            "to_email": "helper@example.com",
            "owner_email": "heartbeat-escalation@example.com",
            "owner_name": "",
            "next_expected_at": due_at.isoformat(),
        }
    ]

    heartbeat_response = await client.get("/api/v1/heartbeats/me", headers=_auth_header(user["access_token"]))
    assert heartbeat_response.status_code == 200, heartbeat_response.text
    assert heartbeat_response.json()["recovery_contact_count"] == 1


@pytest.mark.asyncio
async def test_heartbeat_escalation_without_recovery_contacts_records_skip_audit(
    test_context,
    monkeypatch: pytest.MonkeyPatch,
):
    client = test_context["client"]
    session_factory = test_context["session_factory"]
    user = await _create_authenticated_user(test_context, email="heartbeat-skip@example.com")

    configure_response = await client.put(
        "/api/v1/heartbeats/me",
        headers=_auth_header(user["access_token"]),
        json={"cadence": "quarterly", "enabled": True},
    )
    assert configure_response.status_code == 200, configure_response.text

    collector = RecordingEmailClient()
    monkeypatch.setattr("app.services.heartbeats.get_email_client", lambda: collector)

    due_at = datetime(2025, 12, 1, 9, 0, tzinfo=UTC)
    _user, heartbeat = await _get_user_and_heartbeat(session_factory, "heartbeat-skip@example.com")
    heartbeat_id = heartbeat.id

    async with session_factory() as db:
        tracked_heartbeat = await db.get(Heartbeat, heartbeat_id)
        tracked_heartbeat.status = HeartbeatStatus.OVERDUE
        tracked_heartbeat.last_checked_in_at = due_at - timedelta(days=90)
        tracked_heartbeat.next_expected_at = due_at
        tracked_heartbeat.next_action_at = due_at + timedelta(days=14)
        tracked_heartbeat.pre_due_notice_sent_at = due_at - timedelta(days=7)
        tracked_heartbeat.escalation_level = 2
        tracked_heartbeat.last_reminder_sent_at = due_at + timedelta(days=7)
        tracked_heartbeat.executor_notified_at = None
        await db.commit()

    async with session_factory() as db:
        await heartbeat_service.process_due_heartbeat(
            db,
            heartbeat_id=heartbeat_id,
            now=due_at + timedelta(days=14, minutes=5),
        )
        await db.commit()

    async with session_factory() as db:
        tracked_heartbeat = await db.get(Heartbeat, heartbeat_id)
        assert tracked_heartbeat.status == HeartbeatStatus.ESCALATED
        assert tracked_heartbeat.escalation_level == 3
        assert tracked_heartbeat.next_action_at is None
        assert tracked_heartbeat.executor_notified_at is None
        skip_logs = (
            await db.execute(
                select(AuditLog).where(
                    AuditLog.entity_id == heartbeat_id,
                    AuditLog.action == "heartbeat_contact_notify_skipped",
                )
            )
        ).scalars().all()
        assert len(skip_logs) == 1

    assert len(collector.owner_reminders) == 1
    assert collector.owner_reminders[0]["stage"] == "overdue_day_14"
    assert collector.contact_notifications == []
