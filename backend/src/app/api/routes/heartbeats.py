from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session_dep, get_current_user, get_request_id
from app.models import User
from app.schemas.heartbeats import HeartbeatResponse, HeartbeatUpsertRequest
from app.services import heartbeats as heartbeat_service

router = APIRouter(prefix="/heartbeats", tags=["heartbeats"])


@router.get("/me", response_model=HeartbeatResponse, operation_id="getHeartbeat")
async def get_heartbeat(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dep),
) -> HeartbeatResponse:
    return await heartbeat_service.get_heartbeat_response(db, user.id)


@router.put("/me", response_model=HeartbeatResponse, operation_id="upsertHeartbeat")
async def upsert_heartbeat(
    payload: HeartbeatUpsertRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dep),
    request_id: str | None = Depends(get_request_id),
) -> HeartbeatResponse:
    client_ip = request.client.host if request.client else None
    return await heartbeat_service.upsert_heartbeat(
        db,
        user=user,
        payload=payload,
        request_id=request_id,
        client_ip=client_ip,
    )


@router.post("/me/check-in", response_model=HeartbeatResponse, operation_id="checkInHeartbeat")
async def check_in_heartbeat(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dep),
    request_id: str | None = Depends(get_request_id),
) -> HeartbeatResponse:
    client_ip = request.client.host if request.client else None
    return await heartbeat_service.check_in_heartbeat(
        db,
        user=user,
        request_id=request_id,
        client_ip=client_ip,
    )
