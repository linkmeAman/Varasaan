from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, LargeBinary, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def generate_id() -> str:
    return str(uuid4())


def utcnow() -> datetime:
    return datetime.now(UTC)


class PolicyType(StrEnum):
    PRIVACY = "privacy"
    TERMS = "terms"


class TrustedContactRole(StrEnum):
    VIEWER = "viewer"
    PACKET_ACCESS = "packet_access"
    RECOVERY_ASSIST = "recovery_assist"


class TrustedContactStatus(StrEnum):
    PENDING = "pending"
    ACTIVE = "active"
    REVOKED = "revoked"


class DocumentState(StrEnum):
    UPLOAD_PENDING = "upload_pending"
    QUARANTINED = "quarantined"
    SCAN_FAILED = "scan_failed"
    ACTIVE = "active"
    SOFT_DELETED = "soft_deleted"
    PURGED = "purged"


class PacketJobStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    READY = "ready"
    FAILED = "failed"


class ExportJobStatus(StrEnum):
    QUEUED = "queued"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"
    EXPIRED = "expired"


class PaymentStatus(StrEnum):
    CREATED = "created"
    AUTHORIZED = "authorized"
    CAPTURED = "captured"
    FAILED = "failed"
    REFUNDED = "refunded"


class MalwareScanStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    CLEAN = "clean"
    INFECTED = "infected"
    ERROR = "error"


class RecoveryMode(StrEnum):
    PRIMARY_EMAIL = "primary_email"
    BACKUP_EMAIL = "backup_email"
    TRUSTED_CONTACT = "trusted_contact"


class RecoveryRequestStatus(StrEnum):
    PENDING = "pending"
    APPROVAL_PENDING = "approval_pending"
    APPROVED = "approved"
    COMPLETED = "completed"
    EXPIRED = "expired"


class HeartbeatCadence(StrEnum):
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"


class HeartbeatStatus(StrEnum):
    ACTIVE = "active"
    PAUSED = "paused"
    OVERDUE = "overdue"
    ESCALATED = "escalated"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    email_verification_token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    email_verification_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    password_reset_token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    password_reset_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    backup_recovery_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    backup_recovery_email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    jurisdiction_code: Mapped[str] = mapped_column(String(8), default="IN")
    jurisdiction_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    password_changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    refresh_token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    access_jti: Mapped[str] = mapped_column(String(36), nullable=False)
    parent_session_id: Mapped[str | None] = mapped_column(ForeignKey("sessions.id"), nullable=True)
    replaced_by_session_id: Mapped[str | None] = mapped_column(ForeignKey("sessions.id"), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class LegalPolicyVersion(Base):
    __tablename__ = "legal_policy_versions"
    __table_args__ = (UniqueConstraint("policy_type", "version", name="uq_policy_type_version"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    policy_type: Mapped[PolicyType] = mapped_column(Enum(PolicyType), index=True)
    version: Mapped[str] = mapped_column(String(40), nullable=False)
    effective_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    checksum: Mapped[str] = mapped_column(String(128), nullable=False)
    created_by: Mapped[str | None] = mapped_column(String(36), nullable=True)


class Consent(Base):
    __tablename__ = "consents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    policy_type: Mapped[PolicyType] = mapped_column(Enum(PolicyType), index=True)
    policy_version: Mapped[str] = mapped_column(String(40), nullable=False)
    accepted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    ip_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)


class TrustedContact(Base):
    __tablename__ = "trusted_contacts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[TrustedContactRole] = mapped_column(Enum(TrustedContactRole), nullable=False)
    status: Mapped[TrustedContactStatus] = mapped_column(Enum(TrustedContactStatus), default=TrustedContactStatus.PENDING)
    recovery_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Heartbeat(Base):
    __tablename__ = "heartbeats"
    __table_args__ = (UniqueConstraint("user_id", name="uq_heartbeats_user_id"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True)
    cadence: Mapped[HeartbeatCadence] = mapped_column(Enum(HeartbeatCadence), nullable=False)
    status: Mapped[HeartbeatStatus] = mapped_column(Enum(HeartbeatStatus), default=HeartbeatStatus.ACTIVE, index=True)
    last_checked_in_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_expected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_action_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    pre_due_notice_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    escalation_level: Mapped[int] = mapped_column(Integer, default=0)
    last_reminder_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    executor_notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class InviteToken(Base):
    __tablename__ = "invite_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    trusted_contact_id: Mapped[str] = mapped_column(ForeignKey("trusted_contacts.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    send_count: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class InventoryAccount(Base):
    __tablename__ = "inventory_accounts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    platform: Mapped[str] = mapped_column(String(120), nullable=False)
    category: Mapped[str] = mapped_column(String(80), nullable=False)
    username_hint: Mapped[str | None] = mapped_column(String(255), nullable=True)
    importance_level: Mapped[int] = mapped_column(Integer, default=2)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    doc_type: Mapped[str] = mapped_column(String(80), nullable=False)
    state: Mapped[DocumentState] = mapped_column(Enum(DocumentState), default=DocumentState.UPLOAD_PENDING, index=True)
    current_version_id: Mapped[str | None] = mapped_column(ForeignKey("document_versions.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class DocumentVersion(Base):
    __tablename__ = "document_versions"
    __table_args__ = (UniqueConstraint("document_id", "version_no", name="uq_doc_version_number"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    version_no: Mapped[int] = mapped_column(Integer, nullable=False)
    state: Mapped[DocumentState] = mapped_column(Enum(DocumentState), default=DocumentState.UPLOAD_PENDING)
    object_key: Mapped[str] = mapped_column(String(500), nullable=False)
    encrypted_dek: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    kms_key_id: Mapped[str] = mapped_column(String(200), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    scan_failed_purge_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class MalwareScan(Base):
    __tablename__ = "malware_scans"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    version_id: Mapped[str] = mapped_column(ForeignKey("document_versions.id", ondelete="CASCADE"), unique=True)
    status: Mapped[MalwareScanStatus] = mapped_column(Enum(MalwareScanStatus), default=MalwareScanStatus.PENDING)
    provider_scan_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    last_error: Mapped[str | None] = mapped_column(String(500), nullable=True)
    result_summary: Mapped[str | None] = mapped_column(String(500), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class DocumentAccessGrant(Base):
    __tablename__ = "document_access_grants"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    granted_to_contact_id: Mapped[str] = mapped_column(ForeignKey("trusted_contacts.id", ondelete="CASCADE"), index=True)
    granted_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class TemplateVersion(Base):
    __tablename__ = "template_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    platform: Mapped[str] = mapped_column(String(120), index=True)
    version: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="draft")
    jurisdiction_required: Mapped[str] = mapped_column(String(8), default="IN")
    last_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class TemplateSource(Base):
    __tablename__ = "template_sources"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    template_version_id: Mapped[str] = mapped_column(ForeignKey("template_versions.id", ondelete="CASCADE"), index=True)
    source_url: Mapped[str] = mapped_column(String(1000), nullable=False)
    legal_citation: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    jurisdiction: Mapped[str] = mapped_column(String(8), nullable=False)
    last_checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class PacketJob(Base):
    __tablename__ = "packet_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    platform: Mapped[str] = mapped_column(String(120), nullable=False)
    status: Mapped[PacketJobStatus] = mapped_column(Enum(PacketJobStatus), default=PacketJobStatus.QUEUED)
    worker_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_heartbeat: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    timeout_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    artifact_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    order_id: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    payment_id: Mapped[str | None] = mapped_column(String(100), unique=True, index=True, nullable=True)
    amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(12), nullable=False, default="INR")
    latest_status: Mapped[PaymentStatus] = mapped_column(Enum(PaymentStatus), default=PaymentStatus.CREATED)
    event_sequence: Mapped[int] = mapped_column(Integer, default=0)
    last_event_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    unlocked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    invoice_issued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ExportJob(Base):
    __tablename__ = "export_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    status: Mapped[ExportJobStatus] = mapped_column(Enum(ExportJobStatus), default=ExportJobStatus.QUEUED)
    artifact_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    download_token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    download_token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    download_consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    actor_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    action: Mapped[str] = mapped_column(String(120), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(80), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(36), nullable=False)
    request_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    ip_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AccountRecoveryRequest(Base):
    __tablename__ = "account_recovery_requests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    mode: Mapped[RecoveryMode] = mapped_column(Enum(RecoveryMode), nullable=False)
    status: Mapped[RecoveryRequestStatus] = mapped_column(Enum(RecoveryRequestStatus), default=RecoveryRequestStatus.PENDING, index=True)
    trusted_contact_id: Mapped[str | None] = mapped_column(ForeignKey("trusted_contacts.id", ondelete="SET NULL"), nullable=True)
    recovery_token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    approval_token_hash: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
