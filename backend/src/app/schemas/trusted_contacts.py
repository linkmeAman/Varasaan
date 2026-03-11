from pydantic import BaseModel, EmailStr

from app.models import TrustedContactRole


class TrustedContactCreateRequest(BaseModel):
    name: str
    email: EmailStr
    role: TrustedContactRole
    recovery_enabled: bool = False


class TrustedContactInviteRequest(BaseModel):
    force_reissue: bool = False


class TrustedContactInviteResponse(BaseModel):
    message: str
    invite_token: str | None = None


class TrustedContactResponse(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: TrustedContactRole
    status: str
