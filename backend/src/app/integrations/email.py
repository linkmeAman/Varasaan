from __future__ import annotations

import logging
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


@lru_cache
def get_email_client() -> EmailClient:
    return EmailClient()
