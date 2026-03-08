from __future__ import annotations

from functools import lru_cache

from app.core.config import get_settings

try:
    from redis.asyncio import Redis
except Exception:  # pragma: no cover
    Redis = None


@lru_cache
def get_redis_client() -> Redis | None:
    if Redis is None:
        return None
    settings = get_settings()
    return Redis.from_url(settings.redis_url, encoding="utf-8", decode_responses=True)
