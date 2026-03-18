from __future__ import annotations

import pytest
from sqlalchemy import select

from app.core.config import get_settings
from app.models import Document, DocumentState
from helpers import mark_user_verified, seed_active_policies, sign_webhook

pytestmark = pytest.mark.integration


def _auth_header(access_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {access_token}"}


def _csrf_header(test_context: dict) -> dict[str, str]:
    settings = get_settings()
    token = test_context["client"].cookies.get(settings.csrf_cookie_name)
    assert token
    return {settings.csrf_header_name: token}

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
async def test_cookie_auth_and_csrf_flow(test_context):
    client = test_context["client"]
    settings = get_settings()

    await _signup_and_login(test_context, email="cookie-user@example.com", password="StrongPassw0rd!!123")

    assert client.cookies.get(settings.access_cookie_name)
    assert client.cookies.get(settings.refresh_cookie_name)
    assert client.cookies.get(settings.csrf_cookie_name)

    me_with_cookie = await client.get("/api/v1/auth/me")
    assert me_with_cookie.status_code == 200, me_with_cookie.text

    create_without_csrf = await client.post(
        "/api/v1/inventory/accounts",
        json={
            "platform": "Dropbox",
            "category": "storage",
            "username_hint": "cookie-user@example.com",
            "importance_level": 2,
        },
    )
    assert create_without_csrf.status_code == 403, create_without_csrf.text

    create_with_csrf = await client.post(
        "/api/v1/inventory/accounts",
        headers=_csrf_header(test_context),
        json={
            "platform": "Dropbox",
            "category": "storage",
            "username_hint": "cookie-user@example.com",
            "importance_level": 2,
        },
    )
    assert create_with_csrf.status_code == 201, create_with_csrf.text

    old_csrf = client.cookies.get(settings.csrf_cookie_name)
    refresh_with_cookie = await client.post(
        "/api/v1/auth/refresh",
        headers=_csrf_header(test_context),
        json={},
    )
    assert refresh_with_cookie.status_code == 200, refresh_with_cookie.text
    assert client.cookies.get(settings.csrf_cookie_name)
    assert client.cookies.get(settings.csrf_cookie_name) != old_csrf

    logout_with_cookie = await client.post(
        "/api/v1/auth/logout",
        headers=_csrf_header(test_context),
        json={},
    )
    assert logout_with_cookie.status_code == 200, logout_with_cookie.text

    assert client.cookies.get(settings.access_cookie_name) is None
    assert client.cookies.get(settings.refresh_cookie_name) is None

    me_after_logout = await client.get("/api/v1/auth/me")
    assert me_after_logout.status_code == 401, me_after_logout.text

@pytest.mark.asyncio
async def test_auth_signup_and_password_reset_debug_tokens(test_context):
    client = test_context["client"]
    session_factory = test_context["session_factory"]

    async with session_factory() as db:
        await seed_active_policies(db)

    signup_response = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": "debugger@example.com",
            "password": "StrongPassw0rd!!123",
            "consents": [
                {"policy_type": "privacy", "policy_version": "2026.03"},
                {"policy_type": "terms", "policy_version": "2026.03"},
            ],
        },
    )
    assert signup_response.status_code == 201, signup_response.text
    verification_token = signup_response.json().get("verification_token")
    assert verification_token

    verify_response = await client.post("/api/v1/auth/verify-email", json={"token": verification_token})
    assert verify_response.status_code == 200, verify_response.text

    login_response = await client.post(
        "/api/v1/auth/login",
        json={"email": "debugger@example.com", "password": "StrongPassw0rd!!123"},
    )
    assert login_response.status_code == 200, login_response.text

    reset_response = await client.post(
        "/api/v1/auth/password-reset/request",
        json={"email": "debugger@example.com"},
    )
    assert reset_response.status_code == 200, reset_response.text
    reset_token = reset_response.json().get("reset_token")
    assert reset_token

    confirm_response = await client.post(
        "/api/v1/auth/password-reset/confirm",
        json={"token": reset_token, "new_password": "AnotherStrongPass!123"},
    )
    assert confirm_response.status_code == 200, confirm_response.text


@pytest.mark.asyncio
async def test_inventory_crud_flow(test_context):
    client = test_context["client"]
    user = await _signup_and_login(test_context, email="inventory@example.com", password="StrongPassw0rd!!123")

    create_response = await client.post(
        "/api/v1/inventory/accounts",
        headers=_auth_header(user["access_token"]),
        json={
            "platform": "Gmail",
            "category": "communication",
            "username_hint": "inventory@example.com",
            "importance_level": 3,
        },
    )
    assert create_response.status_code == 201, create_response.text
    created = create_response.json()

    update_response = await client.put(
        f"/api/v1/inventory/accounts/{created['id']}",
        headers=_auth_header(user["access_token"]),
        json={
            "platform": "Google Workspace",
            "category": "communication",
            "username_hint": "workspace@example.com",
            "importance_level": 5,
        },
    )
    assert update_response.status_code == 200, update_response.text
    assert update_response.json()["importance_level"] == 5

    list_response = await client.get("/api/v1/inventory/accounts", headers=_auth_header(user["access_token"]))
    assert list_response.status_code == 200, list_response.text
    listed = list_response.json()
    assert len(listed) == 1
    assert listed[0]["platform"] == "Google Workspace"

    delete_response = await client.delete(
        f"/api/v1/inventory/accounts/{created['id']}",
        headers=_auth_header(user["access_token"]),
    )
    assert delete_response.status_code == 200, delete_response.text

    after_delete = await client.get("/api/v1/inventory/accounts", headers=_auth_header(user["access_token"]))
    assert after_delete.status_code == 200, after_delete.text
    assert after_delete.json() == []


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
async def test_document_listing_and_version_status_endpoints(test_context):
    client = test_context["client"]
    owner = await _signup_and_login(test_context, email="docs-reader@example.com", password="StrongPassw0rd!!123")

    init_upload = await client.post(
        "/api/v1/documents/uploads/init",
        headers=_auth_header(owner["access_token"]),
        json={
            "doc_type": "death_certificate",
            "size_bytes": 1024,
            "content_type": "application/pdf",
            "sha256": "b" * 64,
        },
    )
    assert init_upload.status_code == 201, init_upload.text
    document_id = init_upload.json()["document_id"]
    version_id = init_upload.json()["version_id"]

    queue_scan = await client.post(
        f"/api/v1/documents/versions/{version_id}/scan",
        headers=_auth_header(owner["access_token"]),
    )
    assert queue_scan.status_code == 200, queue_scan.text

    list_docs = await client.get("/api/v1/documents", headers=_auth_header(owner["access_token"]))
    assert list_docs.status_code == 200, list_docs.text
    documents = list_docs.json()
    assert len(documents) == 1
    assert documents[0]["id"] == document_id

    get_doc = await client.get(f"/api/v1/documents/{document_id}", headers=_auth_header(owner["access_token"]))
    assert get_doc.status_code == 200, get_doc.text
    detail = get_doc.json()
    assert detail["id"] == document_id
    assert len(detail["versions"]) == 1

    get_version = await client.get(f"/api/v1/documents/versions/{version_id}", headers=_auth_header(owner["access_token"]))
    assert get_version.status_code == 200, get_version.text
    version_body = get_version.json()
    assert version_body["id"] == version_id
    assert version_body["scan_status"] == "clean"


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
async def test_payment_checkout_response_contains_provider_metadata(test_context):
    client = test_context["client"]
    user = await _signup_and_login(test_context, email="checkout@example.com", password="StrongPassw0rd!!123")

    create_checkout = await client.post(
        "/api/v1/payments/checkout",
        headers=_auth_header(user["access_token"]),
        json={"amount_paise": 49900, "currency": "INR"},
    )
    assert create_checkout.status_code == 201, create_checkout.text
    body = create_checkout.json()
    assert body["provider"] == "razorpay"
    assert body["provider_order_id"] == body["order_id"]
    assert "checkout_key_id" in body


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


@pytest.mark.asyncio
async def test_trusted_contact_invite_debug_token_acceptance(test_context):
    client = test_context["client"]
    owner = await _signup_and_login(test_context, email="owner-tc@example.com", password="StrongPassw0rd!!123")

    created = await client.post(
        "/api/v1/trusted-contacts",
        headers=_auth_header(owner["access_token"]),
        json={
            "name": "Helper One",
            "email": "helper@example.com",
            "role": "recovery_assist",
            "recovery_enabled": True,
        },
    )
    assert created.status_code == 201, created.text
    contact_id = created.json()["id"]

    invite_response = await client.post(
        f"/api/v1/trusted-contacts/{contact_id}/invite",
        headers=_auth_header(owner["access_token"]),
        json={"force_reissue": True},
    )
    assert invite_response.status_code == 200, invite_response.text
    invite_token = invite_response.json().get("invite_token")
    assert invite_token

    accept_response = await client.post(
        "/api/v1/trusted-contacts/invite/accept",
        params={"token": invite_token},
    )
    assert accept_response.status_code == 200, accept_response.text

    contacts = await client.get("/api/v1/trusted-contacts", headers=_auth_header(owner["access_token"]))
    assert contacts.status_code == 200, contacts.text
    assert contacts.json()[0]["status"] == "active"
