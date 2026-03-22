from __future__ import annotations

from functools import lru_cache
from typing import TYPE_CHECKING, Any

from app.core.config import get_settings

if TYPE_CHECKING:
    from redis.asyncio import Redis as RedisClient
else:  # pragma: no cover
    RedisClient = Any


def _load_redis_runtime() -> Any | None:
    try:
        from redis.asyncio import Redis as redis_runtime  # type: ignore[import-untyped]
    except Exception:  # pragma: no cover
        return None
    return redis_runtime


RedisRuntime = _load_redis_runtime()


@lru_cache
def get_redis_client() -> RedisClient | None:
    if RedisRuntime is None:
        return None
    settings = get_settings()
    return RedisRuntime.from_url(settings.redis_url, encoding="utf-8", decode_responses=True)
