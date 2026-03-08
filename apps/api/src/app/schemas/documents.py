from pydantic import BaseModel, Field


class UploadInitRequest(BaseModel):
    doc_type: str
    size_bytes: int = Field(gt=0)
    content_type: str = "application/octet-stream"
    sha256: str | None = None


class UploadInitResponse(BaseModel):
    document_id: str
    version_id: str
    version_no: int
    object_key: str
    upload_url: str
    upload_url_expires_in_seconds: int
    plaintext_dek_b64: str
    kms_key_id: str


class ScanResultRequest(BaseModel):
    version_id: str
    scan_passed: bool


class DocumentDownloadResponse(BaseModel):
    download_url: str
    expires_in_seconds: int


class GrantCreateRequest(BaseModel):
    trusted_contact_id: str
    granted_reason: str | None = None
    expires_in_hours: int | None = None


class ScanDispatchResponse(BaseModel):
    version_id: str
    status: str
