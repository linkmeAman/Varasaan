from typing import Literal

from pydantic import BaseModel, EmailStr, Field

from app.models import PolicyType


class ConsentInput(BaseModel):
    policy_type: PolicyType
    policy_version: str


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12)
    full_name: str | None = None
    phone: str | None = None
    jurisdiction_code: str = "IN"
    consents: list[ConsentInput]


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class EmailVerificationRequest(BaseModel):
    token: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirmRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=12)


class RecoveryRequest(BaseModel):
    email: EmailStr
    mode: Literal["primary_email", "backup_email", "trusted_contact"]
    trusted_contact_email: EmailStr | None = None


class RecoveryAssistRequest(BaseModel):
    approval_token: str


class RecoveryConfirmRequest(BaseModel):
    recovery_token: str
    new_password: str = Field(min_length=12)


class JurisdictionConfirmRequest(BaseModel):
    jurisdiction_code: str


class SignupResponse(BaseModel):
    message: str
    verification_token: str | None = None


class PasswordResetRequestResponse(BaseModel):
    message: str
    reset_token: str | None = None


class UserSessionResponse(BaseModel):
    id: str
    email: EmailStr
    email_verified: bool


class RecoveryRequestResponse(BaseModel):
    message: str
    recovery_token: str | None = None
    approval_token: str | None = None


class RecoveryAssistResponse(BaseModel):
    message: str
