from __future__ import annotations

import pytest
from sqlalchemy import select

from app.models import Document, DocumentState
from tests.helpers import mark_user_verified, seed_active_policies, sign_webhook


def _auth_header(access_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {access_token}"}


async def _signup_and_login(test_context, *, email: str, password: str) -> dict:
    client = test_context["client"]
    session_factory = test_context["session_factory"]

    async with session_factory() as db:
        await seed_active_policies(db)

    signup_payload = {
        "email": email,
        "password": password,
        "consents": [
            {"policy_type": "privacy", "policy_version": "2026.03"},
            {"policy_type": "terms", "policy_version": "2026.03"},
        ],
    }
    signup_response = await client.post("/api/v1/auth/signup", json=signup_payload)
    assert signup_response.status_code == 201, signup_response.text

    async with session_factory() as db:
        await mark_user_verified(db, email)

    login_response = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert login_response.status_code == 200, login_response.text
    return login_response.json()


@pytest.mark.asyncio
async def test_auth_session_rotation_and_revocation(test_context):
    client = test_context["client"]
    password = "StrongPassw0rd!!123"
    first_login = await _signup_and_login(test_context, email="alice@example.com", password=password)

    refresh_1 = first_login["refresh_token"]
    access_1 = first_login["access_token"]

    rotate_response = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_1})
    assert rotate_response.status_code == 200, rotate_response.text
    refresh_2 = rotate_response.json()["refresh_token"]

    reused_response = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_1})
    assert reused_response.status_code == 401, reused_response.text

    logout_response = await client.post("/api/v1/auth/logout", json={"refresh_token": refresh_2})
    assert logout_response.status_code == 200, logout_response.text

    after_logout_refresh = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_2})
    assert after_logout_refresh.status_code == 401, after_logout_refresh.text

    login_again = await client.post("/api/v1/auth/login", json={"email": "alice@example.com", "password": password})
    assert login_again.status_code == 200, login_again.text
    access_3 = login_again.json()["access_token"]
    refresh_3 = login_again.json()["refresh_token"]

    logout_all = await client.post("/api/v1/auth/logout-all", headers=_auth_header(access_3))
    assert logout_all.status_code == 200, logout_all.text

    refresh_after_logout_all = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_3})
    assert refresh_after_logout_all.status_code == 401, refresh_after_logout_all.text

    me_response = await client.get("/api/v1/auth/me", headers=_auth_header(access_1))
    assert me_response.status_code == 200, me_response.text


@pytest.mark.asyncio
async def test_document_upload_scan_download_authorization(test_context):
    client = test_context["client"]
    owner = await _signup_and_login(test_context, email="owner@example.com", password="StrongPassw0rd!!123")
    intruder = await _signup_and_login(test_context, email="intruder@example.com", password="StrongPassw0rd!!456")

    upload_payload = {
        "doc_type": "passport",
        "size_bytes": 2048,
        "content_type": "application/pdf",
        "sha256": "a" * 64,
    }
    init_upload = await client.post(
        "/api/v1/documents/uploads/init",
        headers=_auth_header(owner["access_token"]),
        json=upload_payload,
    )
    assert init_upload.status_code == 201, init_upload.text
    upload_data = init_upload.json()
    document_id = upload_data["document_id"]
    version_id = upload_data["version_id"]

    queue_scan = await client.post(
        f"/api/v1/documents/versions/{version_id}/scan",
        headers=_auth_header(owner["access_token"]),
    )
    assert queue_scan.status_code == 200, queue_scan.text

    owner_download = await client.get(
        f"/api/v1/documents/{document_id}/download",
        headers=_auth_header(owner["access_token"]),
    )
    assert owner_download.status_code == 200, owner_download.text
    assert "download_url" in owner_download.json()

    denied_download = await client.get(
        f"/api/v1/documents/{document_id}/download",
        headers=_auth_header(intruder["access_token"]),
    )
    assert denied_download.status_code == 403, denied_download.text

    async with test_context["session_factory"]() as db:
        result = await db.execute(select(Document).where(Document.id == document_id))
        stored = result.scalars().first()
        assert stored is not None
        assert stored.state == DocumentState.ACTIVE


@pytest.mark.asyncio
async def test_export_one_time_token_behavior(test_context):
    client = test_context["client"]
    user = await _signup_and_login(test_context, email="exporter@example.com", password="StrongPassw0rd!!123")

    create_export = await client.post("/api/v1/exports", headers=_auth_header(user["access_token"]))
    assert create_export.status_code == 202, create_export.text
    export_job_id = create_export.json()["id"]

    status_response = await client.get(f"/api/v1/exports/{export_job_id}", headers=_auth_header(user["access_token"]))
    assert status_response.status_code == 200, status_response.text
    assert status_response.json()["status"] == "ready"

    token_response = await client.post(f"/api/v1/exports/{export_job_id}/token", headers=_auth_header(user["access_token"]))
    assert token_response.status_code == 200, token_response.text
    one_time_token = token_response.json()["one_time_token"]

    first_download = await client.get(f"/api/v1/exports/{export_job_id}/download-by-token", params={"token": one_time_token})
    assert first_download.status_code == 200, first_download.text

    replay_download = await client.get(f"/api/v1/exports/{export_job_id}/download-by-token", params={"token": one_time_token})
    assert replay_download.status_code == 410, replay_download.text


@pytest.mark.asyncio
async def test_payment_webhook_replay_and_out_of_order_handling(test_context):
    client = test_context["client"]
    user = await _signup_and_login(test_context, email="payer@example.com", password="StrongPassw0rd!!123")

    create_checkout = await client.post(
        "/api/v1/payments/checkout",
        headers=_auth_header(user["access_token"]),
        json={"amount_paise": 99900, "currency": "INR"},
    )
    assert create_checkout.status_code == 201, create_checkout.text
    order_id = create_checkout.json()["order_id"]

    captured_event = {
        "event_id": "evt_001",
        "order_id": order_id,
        "payment_id": "pay_001",
        "status": "captured",
        "event_sequence": 1,
    }
    raw, sig = sign_webhook(captured_event, test_context["webhook_secret"])
    captured_resp = await client.post(
        "/api/v1/payments/webhook",
        content=raw,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": sig},
    )
    assert captured_resp.status_code == 200, captured_resp.text
    assert captured_resp.json()["processed"] is True

    replay_resp = await client.post(
        "/api/v1/payments/webhook",
        content=raw,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": sig},
    )
    assert replay_resp.status_code == 200, replay_resp.text
    assert replay_resp.json()["reason"] == "replay"

    stale_event = {
        "event_id": "evt_000",
        "order_id": order_id,
        "payment_id": "pay_001",
        "status": "failed",
        "event_sequence": 0,
    }
    raw_stale, sig_stale = sign_webhook(stale_event, test_context["webhook_secret"])
    stale_resp = await client.post(
        "/api/v1/payments/webhook",
        content=raw_stale,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": sig_stale},
    )
    assert stale_resp.status_code == 200, stale_resp.text
    assert stale_resp.json()["reason"] == "out_of_order"

    regression_event = {
        "event_id": "evt_002",
        "order_id": order_id,
        "payment_id": "pay_001",
        "status": "authorized",
        "event_sequence": 2,
    }
    raw_reg, sig_reg = sign_webhook(regression_event, test_context["webhook_secret"])
    regression_resp = await client.post(
        "/api/v1/payments/webhook",
        content=raw_reg,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": sig_reg},
    )
    assert regression_resp.status_code == 200, regression_resp.text
    assert regression_resp.json()["reason"] == "status_regression"

    payment_status = await client.get(f"/api/v1/payments/{order_id}", headers=_auth_header(user["access_token"]))
    assert payment_status.status_code == 200, payment_status.text
    body = payment_status.json()
    assert body["status"] == "captured"
    assert body["event_sequence"] == 1
