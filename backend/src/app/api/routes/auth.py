from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import check_rate_limit, db_session_dep, enforce_csrf, get_current_user
from app.core.config import Settings, get_settings
from app.core.security import generate_token_secret
from app.models import User
from app.schemas.auth import (
    CsrfTokenResponse,
    EmailVerificationRequest,
    JurisdictionConfirmRequest,
    LoginRequest,
    LogoutRequest,
    PasswordResetConfirmRequest,
    PasswordResetRequest,
    PasswordResetRequestResponse,
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


def _cookie_max_age(expires_at: datetime) -> int:
    return max(0, int((expires_at - datetime.now(UTC)).total_seconds()))


def _set_cookie(response: Response, settings: Settings, *, name: str, value: str, max_age: int, http_only: bool) -> None:
    response.set_cookie(
        key=name,
        value=value,
        max_age=max_age,
        httponly=http_only,
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_samesite,
        domain=settings.session_cookie_domain,
        path=settings.session_cookie_path,
    )


def _set_session_cookies(
    response: Response,
    settings: Settings,
    *,
    access_token: str,
    access_expires_at: datetime,
    refresh_token: str,
    refresh_expires_at: datetime,
    csrf_token: str,
) -> None:
    _set_cookie(
        response,
        settings,
        name=settings.access_cookie_name,
        value=access_token,
        max_age=_cookie_max_age(access_expires_at),
        http_only=True,
    )
    _set_cookie(
        response,
        settings,
        name=settings.refresh_cookie_name,
        value=refresh_token,
        max_age=_cookie_max_age(refresh_expires_at),
        http_only=True,
    )
    _set_cookie(
        response,
        settings,
        name=settings.csrf_cookie_name,
        value=csrf_token,
        max_age=_cookie_max_age(refresh_expires_at),
        http_only=False,
    )


def _clear_session_cookies(response: Response, settings: Settings) -> None:
    for cookie_name in (settings.access_cookie_name, settings.refresh_cookie_name, settings.csrf_cookie_name):
        response.delete_cookie(
            key=cookie_name,
            domain=settings.session_cookie_domain,
            path=settings.session_cookie_path,
        )


@router.get("/csrf", response_model=CsrfTokenResponse)
async def csrf(request: Request) -> Response:
    settings = get_settings()
    token = request.cookies.get(settings.csrf_cookie_name) or generate_token_secret()
    response = JSONResponse(content=CsrfTokenResponse(csrf_token=token).model_dump())
    _set_cookie(
        response,
        settings,
        name=settings.csrf_cookie_name,
        value=token,
        max_age=24 * 60 * 60,
        http_only=False,
    )
    return response


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

    _user, verification_token = await auth_service.create_user(db, payload, request.client.host if request.client else None)
    return SignupResponse(
        message="Signup successful. Verify your email to continue.",
        verification_token=verification_token if settings.debug else None,
    )


@router.post("/verify-email", response_model=ApiMessage)
async def verify_email(payload: EmailVerificationRequest, db: AsyncSession = Depends(db_session_dep)) -> ApiMessage:
    await auth_service.verify_email(db, payload.token)
    return ApiMessage(message="Email verified")


@router.post("/login", response_model=TokenPair)
async def login(payload: LoginRequest, request: Request, db: AsyncSession = Depends(db_session_dep)) -> Response:
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
    token_pair = TokenPair(
        access_token=access_token,
        access_token_expires_at=access_expires,
        refresh_token=refresh_token,
        refresh_token_expires_at=refresh_expires,
    )

    response = JSONResponse(content=token_pair.model_dump(mode="json"))
    _set_session_cookies(
        response,
        settings,
        access_token=access_token,
        access_expires_at=access_expires,
        refresh_token=refresh_token,
        refresh_expires_at=refresh_expires,
        csrf_token=generate_token_secret(),
    )
    return response


@router.post("/refresh", response_model=TokenPair)
async def refresh(
    request: Request,
    payload: RefreshRequest | None = None,
    db: AsyncSession = Depends(db_session_dep),
) -> Response:
    settings = get_settings()

    body_refresh_token = payload.refresh_token if payload and payload.refresh_token else None
    cookie_refresh_token = request.cookies.get(settings.refresh_cookie_name)

    refresh_token = body_refresh_token or cookie_refresh_token
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing refresh token")

    if body_refresh_token is None and cookie_refresh_token:
        enforce_csrf(request)

    access_token, access_expires, new_refresh_token, refresh_expires = await auth_service.refresh_session(
        db,
        refresh_token,
    )
    token_pair = TokenPair(
        access_token=access_token,
        access_token_expires_at=access_expires,
        refresh_token=new_refresh_token,
        refresh_token_expires_at=refresh_expires,
    )

    response = JSONResponse(content=token_pair.model_dump(mode="json"))
    _set_session_cookies(
        response,
        settings,
        access_token=access_token,
        access_expires_at=access_expires,
        refresh_token=new_refresh_token,
        refresh_expires_at=refresh_expires,
        csrf_token=generate_token_secret(),
    )
    return response


@router.post("/logout", response_model=ApiMessage)
async def logout(
    request: Request,
    payload: LogoutRequest | None = None,
    db: AsyncSession = Depends(db_session_dep),
) -> Response:
    settings = get_settings()

    body_refresh_token = payload.refresh_token if payload and payload.refresh_token else None
    cookie_refresh_token = request.cookies.get(settings.refresh_cookie_name)
    refresh_token = body_refresh_token or cookie_refresh_token

    if body_refresh_token is None and cookie_refresh_token:
        enforce_csrf(request)

    if refresh_token:
        await auth_service.revoke_session(db, refresh_token)

    response = JSONResponse(content=ApiMessage(message="Logged out").model_dump())
    _clear_session_cookies(response, settings)
    return response


@router.post("/logout-all", response_model=ApiMessage)
async def logout_all(user: User = Depends(get_current_user), db: AsyncSession = Depends(db_session_dep)) -> Response:
    settings = get_settings()
    await auth_service.revoke_all_sessions(db, user.id)
    response = JSONResponse(content=ApiMessage(message="All sessions revoked").model_dump())
    _clear_session_cookies(response, settings)
    return response


@router.post("/password-reset/request", response_model=PasswordResetRequestResponse)
async def password_reset_request(
    payload: PasswordResetRequest,
    request: Request,
    db: AsyncSession = Depends(db_session_dep),
) -> PasswordResetRequestResponse:
    settings = get_settings()
    limit_key = f"password-reset:{payload.email.lower()}:{request.client.host if request.client else 'unknown'}"
    allowed = await check_rate_limit(
        key=limit_key,
        limit=settings.reset_rate_limit_per_hour,
        window_seconds=3600,
    )
    if not allowed:
        return PasswordResetRequestResponse(message="If the account exists, reset instructions will be sent")

    token = await auth_service.password_reset_request(db, payload.email)
    return PasswordResetRequestResponse(
        message="If the account exists, reset instructions will be sent",
        reset_token=token if settings.debug else None,
    )


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
    return UserSessionResponse(
        id=user.id,
        email=user.email,
        email_verified=user.email_verified,
        entitlement_tier=user.entitlement_tier,
        entitlement_updated_at=user.entitlement_updated_at,
    )
