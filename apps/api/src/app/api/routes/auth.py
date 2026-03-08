from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import check_rate_limit, db_session_dep, get_current_user
from app.core.config import get_settings
from app.models import User
from app.schemas.auth import (
    EmailVerificationRequest,
    JurisdictionConfirmRequest,
    LoginRequest,
    LogoutRequest,
    PasswordResetConfirmRequest,
    PasswordResetRequest,
    RecoveryAssistRequest,
    RecoveryAssistResponse,
    RecoveryConfirmRequest,
    RecoveryRequest,
    RecoveryRequestResponse,
    RefreshRequest,
    SignupRequest,
    SignupResponse,
    UserSessionResponse,
)
from app.schemas.common import ApiMessage, TokenPair
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
async def signup(payload: SignupRequest, request: Request, db: AsyncSession = Depends(db_session_dep)) -> SignupResponse:
    settings = get_settings()
    limit_key = f"signup:{request.client.host if request.client else 'unknown'}"
    allowed = await check_rate_limit(
        key=limit_key,
        limit=settings.signup_rate_limit_per_hour,
        window_seconds=3600,
    )
    if not allowed:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Signup rate limit exceeded")

    await auth_service.create_user(db, payload, request.client.host if request.client else None)
    return SignupResponse(message="Signup successful. Verify your email to continue.")


@router.post("/verify-email", response_model=ApiMessage)
async def verify_email(payload: EmailVerificationRequest, db: AsyncSession = Depends(db_session_dep)) -> ApiMessage:
    await auth_service.verify_email(db, payload.token)
    return ApiMessage(message="Email verified")


@router.post("/login", response_model=TokenPair)
async def login(payload: LoginRequest, request: Request, db: AsyncSession = Depends(db_session_dep)) -> TokenPair:
    settings = get_settings()
    limit_key = f"login:{payload.email.lower()}:{request.client.host if request.client else 'unknown'}"
    allowed = await check_rate_limit(
        key=limit_key,
        limit=settings.login_rate_limit_per_minute,
        window_seconds=60,
    )
    if not allowed:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Login rate limit exceeded")

    access_token, access_expires, refresh_token, refresh_expires = await auth_service.login(
        db, payload.email, payload.password
    )
    return TokenPair(
        access_token=access_token,
        access_token_expires_at=access_expires,
        refresh_token=refresh_token,
        refresh_token_expires_at=refresh_expires,
    )


@router.post("/refresh", response_model=TokenPair)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(db_session_dep)) -> TokenPair:
    access_token, access_expires, refresh_token, refresh_expires = await auth_service.refresh_session(
        db,
        payload.refresh_token,
    )
    return TokenPair(
        access_token=access_token,
        access_token_expires_at=access_expires,
        refresh_token=refresh_token,
        refresh_token_expires_at=refresh_expires,
    )


@router.post("/logout", response_model=ApiMessage)
async def logout(payload: LogoutRequest, db: AsyncSession = Depends(db_session_dep)) -> ApiMessage:
    await auth_service.revoke_session(db, payload.refresh_token)
    return ApiMessage(message="Logged out")


@router.post("/logout-all", response_model=ApiMessage)
async def logout_all(user: User = Depends(get_current_user), db: AsyncSession = Depends(db_session_dep)) -> ApiMessage:
    await auth_service.revoke_all_sessions(db, user.id)
    return ApiMessage(message="All sessions revoked")


@router.post("/password-reset/request", response_model=ApiMessage)
async def password_reset_request(
    payload: PasswordResetRequest,
    request: Request,
    db: AsyncSession = Depends(db_session_dep),
) -> ApiMessage:
    settings = get_settings()
    limit_key = f"password-reset:{payload.email.lower()}:{request.client.host if request.client else 'unknown'}"
    allowed = await check_rate_limit(
        key=limit_key,
        limit=settings.reset_rate_limit_per_hour,
        window_seconds=3600,
    )
    if not allowed:
        return ApiMessage(message="If the account exists, reset instructions will be sent")
    await auth_service.password_reset_request(db, payload.email)
    return ApiMessage(message="If the account exists, reset instructions will be sent")


@router.post("/password-reset/confirm", response_model=ApiMessage)
async def password_reset_confirm(payload: PasswordResetConfirmRequest, db: AsyncSession = Depends(db_session_dep)) -> ApiMessage:
    await auth_service.password_reset_confirm(db, payload.token, payload.new_password)
    return ApiMessage(message="Password reset completed")


@router.post("/recovery/request", response_model=RecoveryRequestResponse)
async def request_recovery(payload: RecoveryRequest, db: AsyncSession = Depends(db_session_dep)) -> RecoveryRequestResponse:
    request_record, recovery_token, approval_token = await auth_service.request_account_recovery(
        db,
        email=payload.email,
        mode=payload.mode,
        trusted_contact_email=payload.trusted_contact_email,
    )
    settings = get_settings()
    if not request_record:
        return RecoveryRequestResponse(message="If the account exists, recovery instructions will be sent")
    return RecoveryRequestResponse(
        message="If the account exists, recovery instructions will be sent",
        recovery_token=recovery_token if settings.debug else None,
        approval_token=approval_token if settings.debug else None,
    )


@router.post("/recovery/assist", response_model=RecoveryAssistResponse)
async def assist_recovery(payload: RecoveryAssistRequest, db: AsyncSession = Depends(db_session_dep)) -> RecoveryAssistResponse:
    await auth_service.approve_trusted_contact_recovery(db, payload.approval_token)
    return RecoveryAssistResponse(message="Recovery request approved")


@router.post("/recovery/confirm", response_model=ApiMessage)
async def confirm_recovery(payload: RecoveryConfirmRequest, db: AsyncSession = Depends(db_session_dep)) -> ApiMessage:
    await auth_service.complete_account_recovery(db, payload.recovery_token, payload.new_password)
    return ApiMessage(message="Account recovery completed")


@router.post("/jurisdiction/confirm", response_model=ApiMessage)
async def confirm_jurisdiction(
    payload: JurisdictionConfirmRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dep),
) -> ApiMessage:
    user.jurisdiction_code = payload.jurisdiction_code
    user.jurisdiction_confirmed_at = datetime.now(UTC)
    await db.flush()
    return ApiMessage(message="Jurisdiction confirmed")


@router.get("/me", response_model=UserSessionResponse)
async def me(user: User = Depends(get_current_user)) -> UserSessionResponse:
    return UserSessionResponse(id=user.id, email=user.email, email_verified=user.email_verified)
