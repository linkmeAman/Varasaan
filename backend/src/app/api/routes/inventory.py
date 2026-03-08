from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session_dep, get_current_user
from app.models import InventoryAccount, User
from app.schemas.inventory import InventoryCreateRequest, InventoryResponse

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.post("/accounts", response_model=InventoryResponse, status_code=status.HTTP_201_CREATED)
async def create_inventory_account(
    payload: InventoryCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dep),
) -> InventoryResponse:
    account = InventoryAccount(
        user_id=user.id,
        platform=payload.platform,
        category=payload.category,
        username_hint=payload.username_hint,
        importance_level=payload.importance_level,
    )
    db.add(account)
    await db.flush()
    return InventoryResponse(
        id=account.id,
        platform=account.platform,
        category=account.category,
        username_hint=account.username_hint,
        importance_level=account.importance_level,
    )


@router.get("/accounts", response_model=list[InventoryResponse])
async def list_inventory_accounts(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dep),
) -> list[InventoryResponse]:
    result = await db.execute(select(InventoryAccount).where(InventoryAccount.user_id == user.id))
    accounts = result.scalars().all()
    return [
        InventoryResponse(
            id=account.id,
            platform=account.platform,
            category=account.category,
            username_hint=account.username_hint,
            importance_level=account.importance_level,
        )
        for account in accounts
    ]
