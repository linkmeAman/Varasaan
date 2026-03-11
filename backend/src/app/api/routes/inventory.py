from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session_dep, get_current_user
from app.models import InventoryAccount, User
from app.schemas.common import ApiMessage
from app.schemas.inventory import InventoryCreateRequest, InventoryResponse, InventoryUpdateRequest

router = APIRouter(prefix="/inventory", tags=["inventory"])


def _to_inventory_response(account: InventoryAccount) -> InventoryResponse:
    return InventoryResponse(
        id=account.id,
        platform=account.platform,
        category=account.category,
        username_hint=account.username_hint,
        importance_level=account.importance_level,
    )


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
    return _to_inventory_response(account)


@router.get("/accounts", response_model=list[InventoryResponse])
async def list_inventory_accounts(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dep),
) -> list[InventoryResponse]:
    result = await db.execute(
        select(InventoryAccount)
        .where(InventoryAccount.user_id == user.id)
        .order_by(InventoryAccount.created_at.desc())
    )
    accounts = result.scalars().all()
    return [_to_inventory_response(account) for account in accounts]


@router.put("/accounts/{account_id}", response_model=InventoryResponse)
async def update_inventory_account(
    account_id: str,
    payload: InventoryUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dep),
) -> InventoryResponse:
    account = await db.get(InventoryAccount, account_id)
    if not account or account.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory account not found")

    account.platform = payload.platform
    account.category = payload.category
    account.username_hint = payload.username_hint
    account.importance_level = payload.importance_level
    await db.flush()
    return _to_inventory_response(account)


@router.delete("/accounts/{account_id}", response_model=ApiMessage)
async def delete_inventory_account(
    account_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dep),
) -> ApiMessage:
    account = await db.get(InventoryAccount, account_id)
    if not account or account.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory account not found")

    await db.delete(account)
    await db.flush()
    return ApiMessage(message="Inventory account deleted")
