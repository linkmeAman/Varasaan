from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models import CaseStatus, CaseTaskStatus

DEATH_CERTIFICATE_CONTENT_TYPE = "application/pdf"
DEATH_CERTIFICATE_DOC_TYPE = "death_certificate"
DEATH_CERTIFICATE_MAX_BYTES = 10 * 1024 * 1024
CASE_TASK_EVIDENCE_DOC_TYPE = "case_task_evidence"
CASE_TASK_EVIDENCE_CONTENT_TYPES = (
    "application/pdf",
    "image/png",
    "image/jpeg",
)


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
    evidence_count: int
    evidence_document_id: str | None = Field(default=None, deprecated=True)
    created_at: datetime
    updated_at: datetime


class CaseTaskPatchRequest(BaseModel):
    notes: str | None = None
    status: CaseTaskStatus | None = None
    reference_number: str | None = None
    submitted_date: date | None = None


class CaseTaskEvidenceUploadInitRequest(BaseModel):
    file_name: str = Field(min_length=1, max_length=255)
    size_bytes: int = Field(gt=0)
    content_type: Literal["application/pdf", "image/png", "image/jpeg"]
    sha256: str | None = None


class CaseTaskEvidenceUploadInitResponse(BaseModel):
    evidence_id: str
    document_id: str
    version_id: str
    version_no: int
    object_key: str
    upload_url: str
    upload_url_expires_in_seconds: int
    plaintext_dek_b64: str
    kms_key_id: str
    doc_type: Literal[CASE_TASK_EVIDENCE_DOC_TYPE] = CASE_TASK_EVIDENCE_DOC_TYPE


class CaseTaskEvidenceResponse(BaseModel):
    id: str
    document_id: str
    file_name: str
    content_type: str
    document_state: str
    scan_status: str | None = None
    scan_summary: str | None = None
    created_at: datetime
    download_available: bool


class CaseActivityEventResponse(BaseModel):
    timestamp: datetime
    event_type: str
    task_id: str | None = None
    evidence_id: str | None = None
    actor_label: str
    message: str


class CaseReportSummaryResponse(BaseModel):
    case_id: str
    owner_name: str
    owner_email: str
    status: CaseStatus
    activated_at: datetime | None = None
    generated_at: datetime
    total_tasks: int
    resolved_task_count: int
    escalated_task_count: int
    clean_evidence_count: int


class CaseReportTaskRowResponse(BaseModel):
    id: str
    platform: str
    category: str
    priority: int
    status: CaseTaskStatus
    notes: str | None = None
    reference_number: str | None = None
    submitted_date: date | None = None
    evidence_count: int
    clean_evidence_count: int


class CaseReportEvidenceReferenceResponse(BaseModel):
    evidence_id: str
    task_id: str
    platform: str
    category: str
    file_name: str
    content_type: str
    created_at: datetime


class CaseReportResponse(BaseModel):
    summary: CaseReportSummaryResponse
    task_rows: list[CaseReportTaskRowResponse]
    clean_evidence_references: list[CaseReportEvidenceReferenceResponse]
    activity_timeline: list[CaseActivityEventResponse]
    report_ready: bool
    warnings: list[str]
