from __future__ import annotations

import logging
from hmac import compare_digest

from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.rate_limit import InMemoryRateLimiter, RedisRateLimiter
from app.core.redis_client import get_redis_client
from app.core.security import TokenError
from app.db.session import get_db_session
from app.models import User
from app.services.auth import resolve_access_token_subject

bearer_scheme = HTTPBearer(auto_error=False)
_memory_rate_limiter = InMemoryRateLimiter()
_logger = logging.getLogger(__name__)
CSRF_MUTATING_METHODS = {'POST', 'PUT', 'PATCH', 'DELETE'}


async def db_session_dep(session: AsyncSession = Depends(get_db_session)) -> AsyncSession:
    return session


def _validate_csrf(request: Request) -> None:
    settings = get_settings()
    csrf_cookie = request.cookies.get(settings.csrf_cookie_name)
    csrf_header = request.headers.get(settings.csrf_header_name)

    if not csrf_cookie or not csrf_header or not compare_digest(csrf_cookie, csrf_header):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='CSRF token validation failed')


def enforce_csrf(request: Request) -> None:
    if request.method.upper() not in CSRF_MUTATING_METHODS:
        return
    _validate_csrf(request)


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(db_session_dep),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> User:
    settings = get_settings()

    token: str | None = None
    token_source: str | None = None

    if credentials and credentials.credentials:
        token = credentials.credentials
        token_source = 'bearer'
    else:
        access_cookie = request.cookies.get(settings.access_cookie_name)
        if access_cookie:
            token = access_cookie
            token_source = 'cookie'

    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Missing auth token')

    if token_source == 'cookie' and request.method.upper() in CSRF_MUTATING_METHODS:
        _validate_csrf(request)

    try:
        return await resolve_access_token_subject(db, token)
    except HTTPException as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc.detail)) from exc
    except TokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


async def get_optional_current_user(
    request: Request,
    db: AsyncSession = Depends(db_session_dep),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> User | None:
    settings = get_settings()

    if credentials and credentials.credentials:
        token = credentials.credentials
    else:
        token = request.cookies.get(settings.access_cookie_name)

    if not token:
        return None

    try:
        return await resolve_access_token_subject(db, token)
    except (TokenError, HTTPException):
        return None


def get_request_id(x_request_id: str | None = Header(default=None)) -> str | None:
    return x_request_id


async def check_rate_limit(*, key: str, limit: int, window_seconds: int) -> bool:
    redis_client = get_redis_client()
    if redis_client is not None:
        try:
            limiter = RedisRateLimiter(redis_client)
            return await limiter.allow(key=key, limit=limit, window_seconds=window_seconds)
        except Exception as exc:  # pragma: no cover - exercised in environments without Redis
            _logger.warning('Redis rate limiter unavailable, falling back to in-memory limiter: %s', exc)
    return await _memory_rate_limiter.allow(key=key, limit=limit, window_seconds=window_seconds)
