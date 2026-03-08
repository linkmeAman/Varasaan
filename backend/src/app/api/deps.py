from __future__ import annotations

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rate_limit import InMemoryRateLimiter, RedisRateLimiter
from app.core.redis_client import get_redis_client
from app.core.security import TokenError
from app.db.session import get_db_session
from app.models import User
from app.services.auth import resolve_access_token_subject

bearer_scheme = HTTPBearer(auto_error=False)
_memory_rate_limiter = InMemoryRateLimiter()


async def db_session_dep(session: AsyncSession = Depends(get_db_session)) -> AsyncSession:
    return session


async def get_current_user(
    db: AsyncSession = Depends(db_session_dep),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> User:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    try:
        return await resolve_access_token_subject(db, credentials.credentials)
    except TokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


async def get_optional_current_user(
    db: AsyncSession = Depends(db_session_dep),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> User | None:
    if not credentials:
        return None
    try:
        return await resolve_access_token_subject(db, credentials.credentials)
    except TokenError:
        return None


def get_request_id(x_request_id: str | None = Header(default=None)) -> str | None:
    return x_request_id


async def check_rate_limit(*, key: str, limit: int, window_seconds: int) -> bool:
    redis_client = get_redis_client()
    if redis_client is not None:
        limiter = RedisRateLimiter(redis_client)
        return await limiter.allow(key=key, limit=limit, window_seconds=window_seconds)
    return await _memory_rate_limiter.allow(key=key, limit=limit, window_seconds=window_seconds)
