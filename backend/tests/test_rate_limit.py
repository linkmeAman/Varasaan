from __future__ import annotations

from uuid import uuid4

import pytest

from app.api import deps


@pytest.mark.asyncio
async def test_check_rate_limit_falls_back_to_in_memory_when_redis_fails(monkeypatch) -> None:
    class BrokenRedisRateLimiter:
        def __init__(self, redis_client) -> None:
            self.redis_client = redis_client

        async def allow(self, key: str, limit: int, window_seconds: int) -> bool:
            _ = (key, limit, window_seconds)
            raise RuntimeError('redis unavailable')

    monkeypatch.setattr(deps, 'get_redis_client', lambda: object())
    monkeypatch.setattr(deps, 'RedisRateLimiter', BrokenRedisRateLimiter)

    allowed = await deps.check_rate_limit(
        key=f'rate-limit-fallback-{uuid4()}',
        limit=1,
        window_seconds=60,
    )

    assert allowed is True
