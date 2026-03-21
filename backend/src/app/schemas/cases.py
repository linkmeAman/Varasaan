from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models import CaseStatus, CaseTaskStatus

DEATH_CERTIFICATE_CONTENT_TYPE = "application/pdf"
DEATH_CERTIFICATE_DOC_TYPE = "death_certificate"
DEATH_CERTIFICATE_MAX_BYTES = 10 * 1024 * 1024


class CaseTaskStatusCounts(BaseModel):
    not_started: int = 0
    in_progress: int = 0
    submitted: int = 0
    waiting: int = 0
    resolved: int = 0
    escalated: int = 0


class CaseSummaryResponse(BaseModel):
    id: str
    owner_user_id: str
    owner_name: str
    owner_email: str
    status: CaseStatus
    death_certificate_document_id: str | None = None
    death_certificate_version_id: str | None = None
    activated_at: datetime | None = None
    closed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    task_count: int
    task_status_counts: CaseTaskStatusCounts


class CaseActivationUploadInitRequest(BaseModel):
    size_bytes: int = Field(gt=0, le=DEATH_CERTIFICATE_MAX_BYTES)
    content_type: Literal[DEATH_CERTIFICATE_CONTENT_TYPE]
    sha256: str | None = None


class CaseActivationUploadInitResponse(BaseModel):
    document_id: str
    version_id: str
    version_no: int
    object_key: str
    upload_url: str
    upload_url_expires_in_seconds: int
    plaintext_dek_b64: str
    kms_key_id: str
    doc_type: Literal[DEATH_CERTIFICATE_DOC_TYPE] = DEATH_CERTIFICATE_DOC_TYPE


class CaseActivationConfirmRequest(BaseModel):
    document_id: str
    version_id: str


class CaseTaskResponse(BaseModel):
    id: str
    case_id: str
    inventory_account_id: str | None = None
    platform: str
    category: str
    priority: int
    status: CaseTaskStatus
    notes: str | None = None
    reference_number: str | None = None
    submitted_date: date | None = None
    evidence_document_id: str | None = None
    created_at: datetime
    updated_at: datetime


class CaseTaskPatchRequest(BaseModel):
    notes: str | None = None
    status: CaseTaskStatus | None = None
    reference_number: str | None = None
    submitted_date: date | None = None
