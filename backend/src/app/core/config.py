from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Varasaan API"
    env: Literal["local", "staging", "production"] = "local"
    api_prefix: str = "/api/v1"
    debug: bool = False
    openapi_contract_path: str = "packages/shared/openapi/openapi.generated.json"
    internal_api_key: str = "dev-internal-api-key"

    database_url: str = "postgresql+asyncpg://varasaan:varasaan@localhost:5432/varasaan"
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str | None = None
    celery_result_backend: str | None = None
    celery_task_always_eager: bool = False
    auto_create_schema: bool = False
    mock_external_services: bool = False

    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 7
    password_reset_token_ttl_minutes: int = 15
    invite_token_ttl_hours: int = 72
    upload_url_ttl_minutes: int = 15
    download_url_ttl_minutes: int = 5
    export_bundle_ttl_hours: int = 24
    export_download_token_ttl_minutes: int = 20

    max_upload_size_bytes: int = 50 * 1024 * 1024
    max_documents_per_user: int = 200
    daily_upload_quota_bytes: int = 500 * 1024 * 1024
    max_trusted_contacts: int = 10

    login_rate_limit_per_minute: int = 5
    signup_rate_limit_per_hour: int = 5
    reset_rate_limit_per_hour: int = 3
    export_rate_limit_per_day: int = 2

    jwt_algorithm: str = "HS256"
    jwt_secret_key: str = Field(default="dev-change-me-super-secret-key")

    csp_connect_src: str = "'self' http://localhost:8000"
    cors_allow_origins: str = "http://localhost:3000,http://localhost:5173,https://varasaan-staging.vercel.app,https://varasaan.vercel.app"
    access_cookie_name: str = "varasaan_access_token"
    refresh_cookie_name: str = "varasaan_refresh_token"
    csrf_cookie_name: str = "varasaan_csrf_token"
    csrf_header_name: str = "X-CSRF-Token"
    session_cookie_domain: str | None = None
    session_cookie_path: str = "/"
    session_cookie_secure: bool = False
    session_cookie_samesite: Literal["lax", "strict", "none"] = "lax"

    razorpay_webhook_secret: str = "dev-razorpay-secret"
    razorpay_key_id: str | None = None

    invoice_seller_name: str = "Varasaan Technologies Private Limited"
    invoice_seller_address: str = "Bengaluru, Karnataka, India"
    invoice_seller_gstin: str = "00AAAAA0000A1Z5"
    invoice_place_of_supply: str = "Karnataka"
    invoice_seller_state_code: str = "29"
    invoice_support_email: str = "support@varasaan.local"

    email_provider: Literal["log", "postmark"] = "log"
    email_from_address: str = "no-reply@varasaan.local"
    postmark_server_token: str | None = None
    frontend_base_url: str = "http://localhost:3000"
    api_base_url: str = "http://localhost:8000"

    sentry_dsn: str | None = None
    sentry_release: str | None = None
    sentry_traces_sample_rate: float = 0.0

    aws_region: str = "ap-south-1"
    s3_bucket_documents: str = "varasaan-documents"
    s3_bucket_exports: str = "varasaan-exports"
    kms_key_id: str = "alias/varasaan-documents"
    aws_access_key_id: str | None = None
    aws_secret_access_key: str | None = None
    aws_session_token: str | None = None
    aws_s3_endpoint_url: str | None = None
    aws_kms_endpoint_url: str | None = None

    malware_scan_api_url: str = "http://localhost:8085"
    malware_scan_api_key: str | None = None
    malware_scan_timeout_seconds: int = 20

    packet_job_timeout_seconds: int = 60
    celery_visibility_timeout_seconds: int = 120
    malware_scan_presign_ttl_seconds: int = 300

    scan_failed_purge_after_days: int = 7
    case_evidence_retention_days: int = 90
    recovery_token_ttl_minutes: int = 20
    recovery_request_cooldown_minutes: int = 15

    @field_validator("debug", mode="before")
    @classmethod
    def _coerce_debug(cls, value):
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"release", "prod", "production", "0", "false", "off", "no"}:
                return False
            if normalized in {"debug", "dev", "development", "1", "true", "on", "yes"}:
                return True
        return value

    @field_validator("celery_task_always_eager", mode="before")
    @classmethod
    def _coerce_bool(cls, value):
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"1", "true", "on", "yes"}:
                return True
            if normalized in {"0", "false", "off", "no"}:
                return False
        return value

    @field_validator("session_cookie_samesite", mode="before")
    @classmethod
    def _coerce_samesite(cls, value):
        if isinstance(value, str):
            return value.strip().lower()
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
