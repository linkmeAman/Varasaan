from __future__ import annotations

import logging
from datetime import datetime
from functools import lru_cache

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class EmailClient:
    def __init__(self) -> None:
        self._settings = get_settings()

    async def _send(self, *, to_email: str, subject: str, text_body: str) -> None:
        provider = self._settings.email_provider
        if provider == "postmark" and self._settings.postmark_server_token:
            payload = {
                "From": self._settings.email_from_address,
                "To": to_email,
                "Subject": subject,
                "TextBody": text_body,
            }
            headers = {
                "X-Postmark-Server-Token": self._settings.postmark_server_token,
                "Accept": "application/json",
                "Content-Type": "application/json",
            }
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post("https://api.postmarkapp.com/email", json=payload, headers=headers)
                response.raise_for_status()
            return

        logger.info("email_dispatch provider=%s to=%s subject=%s", provider, to_email, subject)

    async def send_verification_email(self, *, to_email: str, token: str) -> None:
        verify_url = f"{self._settings.frontend_base_url.rstrip('/')}/register?verify_token={token}"
        await self._send(
            to_email=to_email,
            subject="Verify your Varasaan account",
            text_body=f"Use this verification token: {token}\n\nOr open: {verify_url}",
        )

    async def send_password_reset_email(self, *, to_email: str, token: str) -> None:
        recovery_url = f"{self._settings.frontend_base_url.rstrip('/')}/recovery?reset_token={token}"
        await self._send(
            to_email=to_email,
            subject="Varasaan password reset request",
            text_body=f"Use this password reset token: {token}\n\nOr open: {recovery_url}",
        )

    async def send_recovery_email(self, *, to_email: str, token: str, mode: str) -> None:
        recovery_url = f"{self._settings.frontend_base_url.rstrip('/')}/recovery?recovery_token={token}"
        await self._send(
            to_email=to_email,
            subject="Varasaan account recovery request",
            text_body=(
                f"Recovery mode: {mode}\n"
                f"Recovery token: {token}\n\n"
                f"Complete recovery at: {recovery_url}"
            ),
        )

    async def send_recovery_approval_email(self, *, to_email: str, token: str) -> None:
        await self._send(
            to_email=to_email,
            subject="Varasaan trusted-contact recovery approval",
            text_body=f"Approve the recovery with this token: {token}",
        )

    async def send_trusted_contact_invite(self, *, to_email: str, token: str, inviter_email: str) -> None:
        accept_url = f"{self._settings.frontend_base_url.rstrip('/')}/dashboard/trusted-contacts?invite_token={token}"
        await self._send(
            to_email=to_email,
            subject="You were invited as a trusted contact",
            text_body=(
                f"{inviter_email} invited you as a trusted contact on Varasaan.\n"
                f"Invite token: {token}\n"
                f"Accept link: {accept_url}"
            ),
        )

    async def send_heartbeat_owner_reminder(
        self,
        *,
        to_email: str,
        cadence: str,
        next_expected_at: datetime,
        stage: str,
    ) -> None:
        heartbeat_url = f"{self._settings.frontend_base_url.rstrip('/')}/dashboard/heartbeat"
        if stage == "pre_due":
            subject = "Varasaan heartbeat reminder"
            status_line = "Your next heartbeat check-in is coming up soon."
        elif stage == "overdue_day_0":
            subject = "Varasaan heartbeat overdue"
            status_line = "Your heartbeat check-in is now overdue."
        elif stage == "overdue_day_7":
            subject = "Varasaan heartbeat overdue by 7 days"
            status_line = "Your heartbeat check-in is still overdue after 7 days."
        else:
            subject = "Urgent: Varasaan heartbeat escalation"
            status_line = "Your heartbeat check-in is overdue by 14 days and escalation is starting."

        await self._send(
            to_email=to_email,
            subject=subject,
            text_body=(
                f"{status_line}\n"
                f"Cadence: {cadence}\n"
                f"Next expected check-in: {next_expected_at.isoformat()}\n"
                f"Review or check in here: {heartbeat_url}"
            ),
        )

    async def send_heartbeat_recovery_contact_notification(
        self,
        *,
        to_email: str,
        owner_email: str,
        owner_name: str | None,
        next_expected_at: datetime,
    ) -> None:
        owner_label = owner_name or owner_email
        await self._send(
            to_email=to_email,
            subject="Varasaan recovery contact notification",
            text_body=(
                f"{owner_label} has missed their Varasaan heartbeat check-ins.\n"
                f"Last expected check-in: {next_expected_at.isoformat()}\n"
                f"Owner email: {owner_email}"
            ),
        )

    async def send_case_open_notification(
        self,
        *,
        to_email: str,
        owner_email: str,
        owner_name: str | None,
        activated_at: datetime,
        task_count: int,
    ) -> None:
        owner_label = owner_name or owner_email
        case_url = f"{self._settings.frontend_base_url.rstrip('/')}/executor"
        await self._send(
            to_email=to_email,
            subject="Varasaan case is now open",
            text_body=(
                f"A Varasaan after-loss case for {owner_label} is now active.\n"
                f"Owner email: {owner_email}\n"
                f"Activated at: {activated_at.isoformat()}\n"
                f"Task count: {task_count}\n"
                f"Open the executor workspace: {case_url}"
            ),
        )


@lru_cache
def get_email_client() -> EmailClient:
    return EmailClient()
