from __future__ import annotations

import base64
import importlib
import shutil
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient


class FakeAwsService:
    def __init__(self) -> None:
        self.uploaded: dict[tuple[str, str], bytes] = {}

    async def generate_data_key(self, *, encryption_context: dict[str, str]):
        _ = encryption_context
        plaintext = b"0" * 32
        encrypted = b"encrypted-dek"
        return SimpleNamespace(
            plaintext_key_b64=base64.b64encode(plaintext).decode("ascii"),
            encrypted_key_b64=base64.b64encode(encrypted).decode("ascii"),
            kms_key_id="alias/test-kms",
        )

    async def presign_upload(self, *, object_key: str, expires_seconds: int, content_type: str, bucket: str | None = None) -> str:
        target_bucket = bucket or "documents"
        return f"https://s3.local/{target_bucket}/{object_key}?upload=1&expires={expires_seconds}&content_type={content_type}"

    async def presign_download(self, *, object_key: str, expires_seconds: int, bucket: str | None = None) -> str:
        target_bucket = bucket or "documents"
        return f"https://s3.local/{target_bucket}/{object_key}?download=1&expires={expires_seconds}"

    async def download_bytes(self, *, bucket: str, object_key: str) -> bytes | None:
        return self.uploaded.get((bucket, object_key))

    async def upload_bytes(self, *, bucket: str, object_key: str, payload: bytes, content_type: str = "application/octet-stream") -> None:
        _ = content_type
        self.uploaded[(bucket, object_key)] = payload

    async def delete_object(self, *, bucket: str, object_key: str) -> None:
        self.uploaded.pop((bucket, object_key), None)

    def get_mock_object(self, *, bucket: str, object_key: str) -> bytes | None:
        return self.uploaded.get((bucket, object_key))


class FakeMalwareClient:
    def __init__(self) -> None:
        self._queued_outcomes: list[object] = []

    def queue_result(self, *, scan_passed: bool, summary: str, provider_scan_id: str = "scan_test_queued") -> None:
        self._queued_outcomes.append(
            SimpleNamespace(
                scan_passed=scan_passed,
                summary=summary,
                provider_scan_id=provider_scan_id,
            )
        )

    def queue_error(self, error: Exception) -> None:
        self._queued_outcomes.append(error)

    async def scan_object(self, *, object_url: str, object_key: str, version_id: str):
        _ = (object_url, object_key, version_id)
        if self._queued_outcomes:
            outcome = self._queued_outcomes.pop(0)
            if isinstance(outcome, Exception):
                raise outcome
            return outcome
        return SimpleNamespace(scan_passed=True, summary="clean", provider_scan_id="scan_test_1")


@pytest.fixture()
async def test_context(monkeypatch: pytest.MonkeyPatch):
    tests_root = Path(__file__).resolve().parent
    runtime_root = tests_root / ".tmp"
    runtime_root.mkdir(parents=True, exist_ok=True)

    runtime_dir = runtime_root / f"ctx-{uuid4().hex}"
    runtime_dir.mkdir(parents=False, exist_ok=False)

    db_url_path = runtime_dir / "test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_url_path.as_posix()}")
    monkeypatch.setenv("DEBUG", "true")
    monkeypatch.setenv("JWT_SECRET_KEY", "test-secret-key")
    monkeypatch.setenv("CELERY_TASK_ALWAYS_EAGER", "true")
    monkeypatch.setenv("RAZORPAY_WEBHOOK_SECRET", "whsec_test")
    monkeypatch.setenv("OPENAPI_CONTRACT_PATH", "packages/shared/openapi/openapi.yaml")
    monkeypatch.setenv("SIGNUP_RATE_LIMIT_PER_HOUR", "200")
    monkeypatch.setenv("LOGIN_RATE_LIMIT_PER_MINUTE", "200")
    monkeypatch.setenv("RESET_RATE_LIMIT_PER_HOUR", "200")

    from app.core.config import get_settings
    from app.db.session import get_engine, get_session_factory
    from app.integrations.aws import get_aws_storage_crypto_service
    from app.integrations.malware_scan import get_malware_scan_client

    get_settings.cache_clear()
    get_engine.cache_clear()
    get_session_factory.cache_clear()
    get_aws_storage_crypto_service.cache_clear()
    get_malware_scan_client.cache_clear()

    import app.main as app_main

    app_main = importlib.reload(app_main)
    app = app_main.app

    from app.db.base import Base

    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    fake_aws = FakeAwsService()
    fake_malware = FakeMalwareClient()
    monkeypatch.setattr("app.api.deps.get_redis_client", lambda: None)
    monkeypatch.setattr("app.services.documents.get_aws_storage_crypto_service", lambda: fake_aws)
    monkeypatch.setattr("app.services.cases.get_aws_storage_crypto_service", lambda: fake_aws)
    monkeypatch.setattr("app.services.exports.get_aws_storage_crypto_service", lambda: fake_aws)
    monkeypatch.setattr("app.services.packets.get_aws_storage_crypto_service", lambda: fake_aws)
    monkeypatch.setattr("app.services.documents.get_malware_scan_client", lambda: fake_malware)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield {
            "client": client,
            "session_factory": get_session_factory(),
            "fake_aws": fake_aws,
            "fake_malware": fake_malware,
            "webhook_secret": "whsec_test",
        }

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

    shutil.rmtree(runtime_dir, ignore_errors=True)
