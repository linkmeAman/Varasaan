from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session_dep, get_current_user
from app.models import TrustedContact, User
from app.schemas.common import ApiMessage
from app.schemas.trusted_contacts import (
    TrustedContactCreateRequest,
    TrustedContactInviteRequest,
    TrustedContactResponse,
)
from app.services import trusted_contacts as contact_service

router = APIRouter(prefix="/trusted-contacts", tags=["trusted-contacts"])


@router.post("", response_model=TrustedContactResponse, status_code=status.HTTP_201_CREATED)
async def create_contact(
    payload: TrustedContactCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dep),
) -> TrustedContactResponse:
    contact = await contact_service.create_trusted_contact(db, user.id, payload)
    return TrustedContactResponse(
        id=contact.id,
        name=contact.name,
        email=contact.email,
        role=contact.role,
        status=contact.status.value,
    )


@router.get("", response_model=list[TrustedContactResponse])
async def list_contacts(user: User = Depends(get_current_user), db: AsyncSession = Depends(db_session_dep)) -> list[TrustedContactResponse]:
    result = await db.execute(select(TrustedContact).where(TrustedContact.user_id == user.id))
    contacts = result.scalars().all()
    return [
        TrustedContactResponse(
            id=contact.id,
            name=contact.name,
            email=contact.email,
            role=contact.role,
            status=contact.status.value,
        )
        for contact in contacts
    ]


@router.post("/{trusted_contact_id}/invite", response_model=ApiMessage)
async def invite_contact(
    trusted_contact_id: str,
    payload: TrustedContactInviteRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dep),
) -> ApiMessage:
    message, _token = await contact_service.send_invite(db, user.id, trusted_contact_id, payload.force_reissue)
    return ApiMessage(message=message)


@router.post("/invite/accept", response_model=ApiMessage)
async def accept_invite(token: str, db: AsyncSession = Depends(db_session_dep)) -> ApiMessage:
    await contact_service.accept_invite(db, token)
    return ApiMessage(message="Invite accepted")


@router.delete("/{trusted_contact_id}", response_model=ApiMessage)
async def revoke_contact(
    trusted_contact_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dep),
) -> ApiMessage:
    await contact_service.revoke_contact(db, user.id, trusted_contact_id)
    return ApiMessage(message="Trusted contact revoked")
