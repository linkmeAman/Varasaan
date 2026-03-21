from __future__ import annotations

import pytest
from sqlalchemy import select

from app.models import Case, CaseParticipant, CaseStatus, CaseTask, CaseTaskStatus
from helpers import mark_user_verified, seed_active_policies

pytestmark = pytest.mark.integration


def _auth_header(access_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {access_token}"}


async def _signup_and_login(test_context, *, email: str, password: str) -> dict:
    client = test_context["client"]
    session_factory = test_context["session_factory"]

    async with session_factory() as db:
        await seed_active_policies(db)

    signup_response = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": email,
            "password": password,
            "consents": [
                {"policy_type": "privacy", "policy_version": "2026.03"},
                {"policy_type": "terms", "policy_version": "2026.03"},
            ],
        },
    )
    assert signup_response.status_code == 201, signup_response.text

    async with session_factory() as db:
        await mark_user_verified(db, email)

    login_response = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert login_response.status_code == 200, login_response.text
    return login_response.json()


async def _create_executor_case(
    test_context,
    *,
    owner_email: str = "case-owner@example.com",
    executor_email: str = "case-executor@example.com",
):
    client = test_context["client"]
    owner = await _signup_and_login(test_context, email=owner_email, password="StrongPassw0rd!!123")
    executor = await _signup_and_login(test_context, email=executor_email, password="StrongPassw0rd!!456")

    created = await client.post(
        "/api/v1/trusted-contacts",
        headers=_auth_header(owner["access_token"]),
        json={
            "name": "Executor User",
            "email": executor_email,
            "role": "executor",
            "recovery_enabled": False,
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
    invite_token = invite_response.json()["invite_token"]
    assert invite_token

    accept_response = await client.post("/api/v1/trusted-contacts/invite/accept", params={"token": invite_token})
    assert accept_response.status_code == 200, accept_response.text

    list_cases = await client.get("/api/v1/cases", headers=_auth_header(executor["access_token"]))
    assert list_cases.status_code == 200, list_cases.text
    cases = list_cases.json()
    assert len(cases) == 1

    return {
        "owner": owner,
        "executor": executor,
        "contact_id": contact_id,
        "case_id": cases[0]["id"],
    }


@pytest.mark.asyncio
async def test_executor_contact_creates_pending_case(test_context):
    client = test_context["client"]
    session_factory = test_context["session_factory"]
    owner = await _signup_and_login(test_context, email="pending-owner@example.com", password="StrongPassw0rd!!123")

    created = await client.post(
        "/api/v1/trusted-contacts",
        headers=_auth_header(owner["access_token"]),
        json={
            "name": "Pending Executor",
            "email": "pending-executor@example.com",
            "role": "executor",
            "recovery_enabled": False,
        },
    )
    assert created.status_code == 201, created.text
    contact_id = created.json()["id"]

    async with session_factory() as db:
        case = (await db.execute(select(Case))).scalars().one()
        participant = (await db.execute(select(CaseParticipant))).scalars().one()

        assert case.status == CaseStatus.ACTIVATION_PENDING
        assert participant.case_id == case.id
        assert participant.trusted_contact_id == contact_id


@pytest.mark.asyncio
async def test_case_activation_upload_validation_rejects_non_pdf_and_oversize_payloads(test_context):
    client = test_context["client"]
    context = await _create_executor_case(
        test_context,
        owner_email="validation-owner@example.com",
        executor_email="validation-executor@example.com",
    )

    non_pdf = await client.post(
        f"/api/v1/cases/{context['case_id']}/death-certificate/uploads/init",
        headers=_auth_header(context["executor"]["access_token"]),
        json={
            "size_bytes": 2048,
            "content_type": "image/png",
            "sha256": None,
        },
    )
    assert non_pdf.status_code == 422, non_pdf.text

    oversize = await client.post(
        f"/api/v1/cases/{context['case_id']}/death-certificate/uploads/init",
        headers=_auth_header(context["executor"]["access_token"]),
        json={
            "size_bytes": (10 * 1024 * 1024) + 1,
            "content_type": "application/pdf",
            "sha256": None,
        },
    )
    assert oversize.status_code == 422, oversize.text


@pytest.mark.asyncio
async def test_non_executor_users_cannot_access_case_routes(test_context):
    client = test_context["client"]
    context = await _create_executor_case(
        test_context,
        owner_email="guard-owner@example.com",
        executor_email="guard-executor@example.com",
    )
    outsider = await _signup_and_login(test_context, email="guard-outsider@example.com", password="StrongPassw0rd!!789")

    owner_list = await client.get("/api/v1/cases", headers=_auth_header(context["owner"]["access_token"]))
    assert owner_list.status_code == 403, owner_list.text

    outsider_list = await client.get("/api/v1/cases", headers=_auth_header(outsider["access_token"]))
    assert outsider_list.status_code == 403, outsider_list.text

    owner_summary = await client.get(
        f"/api/v1/cases/{context['case_id']}",
        headers=_auth_header(context["owner"]["access_token"]),
    )
    assert owner_summary.status_code == 403, owner_summary.text


@pytest.mark.asyncio
async def test_case_activation_generates_one_task_per_inventory_account_and_is_idempotent(test_context):
    client = test_context["client"]
    session_factory = test_context["session_factory"]
    context = await _create_executor_case(
        test_context,
        owner_email="activation-owner@example.com",
        executor_email="activation-executor@example.com",
    )

    for platform, category, priority in [("Gmail", "communication", 5), ("Dropbox", "storage", 2)]:
        response = await client.post(
            "/api/v1/inventory/accounts",
            headers=_auth_header(context["owner"]["access_token"]),
            json={
                "platform": platform,
                "category": category,
                "username_hint": None,
                "importance_level": priority,
            },
        )
        assert response.status_code == 201, response.text

    init_upload = await client.post(
        f"/api/v1/cases/{context['case_id']}/death-certificate/uploads/init",
        headers=_auth_header(context["executor"]["access_token"]),
        json={
            "size_bytes": 2048,
            "content_type": "application/pdf",
            "sha256": None,
        },
    )
    assert init_upload.status_code == 201, init_upload.text
    upload_payload = init_upload.json()

    activate = await client.post(
        f"/api/v1/cases/{context['case_id']}/activate",
        headers=_auth_header(context["executor"]["access_token"]),
        json={
            "document_id": upload_payload["document_id"],
            "version_id": upload_payload["version_id"],
        },
    )
    assert activate.status_code == 200, activate.text
    assert activate.json()["status"] == "active"
    assert activate.json()["task_count"] == 2

    third_account = await client.post(
        "/api/v1/inventory/accounts",
        headers=_auth_header(context["owner"]["access_token"]),
        json={
            "platform": "Slack",
            "category": "work",
            "username_hint": None,
            "importance_level": 4,
        },
    )
    assert third_account.status_code == 201, third_account.text

    reactivate = await client.post(
        f"/api/v1/cases/{context['case_id']}/activate",
        headers=_auth_header(context["executor"]["access_token"]),
        json={
            "document_id": upload_payload["document_id"],
            "version_id": upload_payload["version_id"],
        },
    )
    assert reactivate.status_code == 200, reactivate.text
    assert reactivate.json()["task_count"] == 2

    list_tasks = await client.get(
        f"/api/v1/cases/{context['case_id']}/tasks",
        headers=_auth_header(context["executor"]["access_token"]),
    )
    assert list_tasks.status_code == 200, list_tasks.text
    tasks = list_tasks.json()
    assert len(tasks) == 2
    assert {task["platform"] for task in tasks} == {"Gmail", "Dropbox"}

    async with session_factory() as db:
        stored_tasks = (await db.execute(select(CaseTask).where(CaseTask.case_id == context["case_id"]))).scalars().all()
        assert len(stored_tasks) == 2


@pytest.mark.asyncio
async def test_case_task_patching_persists_editable_fields(test_context):
    client = test_context["client"]
    session_factory = test_context["session_factory"]
    context = await _create_executor_case(
        test_context,
        owner_email="patch-owner@example.com",
        executor_email="patch-executor@example.com",
    )

    inventory = await client.post(
        "/api/v1/inventory/accounts",
        headers=_auth_header(context["owner"]["access_token"]),
        json={
            "platform": "LinkedIn",
            "category": "social",
            "username_hint": "patch-owner@example.com",
            "importance_level": 3,
        },
    )
    assert inventory.status_code == 201, inventory.text

    init_upload = await client.post(
        f"/api/v1/cases/{context['case_id']}/death-certificate/uploads/init",
        headers=_auth_header(context["executor"]["access_token"]),
        json={
            "size_bytes": 2048,
            "content_type": "application/pdf",
            "sha256": None,
        },
    )
    assert init_upload.status_code == 201, init_upload.text
    upload_payload = init_upload.json()

    activate = await client.post(
        f"/api/v1/cases/{context['case_id']}/activate",
        headers=_auth_header(context["executor"]["access_token"]),
        json={
            "document_id": upload_payload["document_id"],
            "version_id": upload_payload["version_id"],
        },
    )
    assert activate.status_code == 200, activate.text

    list_tasks = await client.get(
        f"/api/v1/cases/{context['case_id']}/tasks",
        headers=_auth_header(context["executor"]["access_token"]),
    )
    assert list_tasks.status_code == 200, list_tasks.text
    task_id = list_tasks.json()[0]["id"]

    patch_response = await client.patch(
        f"/api/v1/cases/{context['case_id']}/tasks/{task_id}",
        headers=_auth_header(context["executor"]["access_token"]),
        json={
            "notes": "Submitted through support portal",
            "status": "submitted",
            "reference_number": "REF-2026-001",
            "submitted_date": "2026-03-21",
        },
    )
    assert patch_response.status_code == 200, patch_response.text
    body = patch_response.json()
    assert body["notes"] == "Submitted through support portal"
    assert body["status"] == "submitted"
    assert body["reference_number"] == "REF-2026-001"
    assert body["submitted_date"] == "2026-03-21"

    async with session_factory() as db:
        task = await db.get(CaseTask, task_id)
        assert task is not None
        assert task.status == CaseTaskStatus.SUBMITTED
        assert task.notes == "Submitted through support portal"
        assert task.reference_number == "REF-2026-001"
        assert str(task.submitted_date) == "2026-03-21"
