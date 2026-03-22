from __future__ import annotations

from collections import defaultdict, deque
from datetime import UTC, datetime, timedelta
from threading import Lock
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from redis.asyncio import Redis as RedisClient
else:  # pragma: no cover
    RedisClient = Any


class InMemoryRateLimiter:
    def __init__(self) -> None:
        self._events: dict[str, deque[datetime]] = defaultdict(deque)
        self._lock = Lock()

    async def allow(self, key: str, limit: int, window_seconds: int) -> bool:
        now = datetime.now(UTC)
        window_start = now - timedelta(seconds=window_seconds)
        with self._lock:
            queue = self._events[key]
            while queue and queue[0] < window_start:
                queue.popleft()
            if len(queue) >= limit:
                return False
            queue.append(now)
        return True


class RedisRateLimiter:
    def __init__(self, redis_client: RedisClient) -> None:
        self.redis_client = redis_client

    async def allow(self, key: str, limit: int, window_seconds: int) -> bool:
        pipe = self.redis_client.pipeline()
        pipe.incr(key)
        pipe.expire(key, window_seconds)
        count, _ = await pipe.execute()
        return int(count) <= limit
