from datetime import datetime

from pydantic import BaseModel


class ExportJobResponse(BaseModel):
    id: str
    status: str


class ExportDownloadResponse(BaseModel):
    download_url: str
    expires_in_seconds: int
    one_time_token: str | None = None


class ExportTokenResponse(BaseModel):
    one_time_token: str
    expires_at: datetime
