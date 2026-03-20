from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.models import HeartbeatCadence

HeartbeatResponseStatus = Literal["unconfigured", "active", "paused", "overdue", "escalated"]


class HeartbeatUpsertRequest(BaseModel):
    cadence: HeartbeatCadence
    enabled: bool


class HeartbeatResponse(BaseModel):
    configured: bool
    enabled: bool
    cadence: HeartbeatCadence | None = None
    status: HeartbeatResponseStatus
    last_checked_in_at: datetime | None = None
    next_expected_at: datetime | None = None
    next_action_at: datetime | None = None
    escalation_level: int = 0
    executor_notified_at: datetime | None = None
    recovery_contact_count: int = 0

