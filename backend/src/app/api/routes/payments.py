from __future__ import annotations

import json

from fastapi import APIRouter, Depends, Header, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session_dep, get_current_user
from app.core.config import get_settings
from app.models import User
from app.schemas.payments import (
    PaymentCheckoutRequest,
    PaymentCheckoutResponse,
    PaymentStatusResponse,
    PaymentWebhookRequest,
    PaymentWebhookResponse,
)
from app.services import payments as payment_service

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post("/checkout", response_model=PaymentCheckoutResponse, status_code=status.HTTP_201_CREATED)
async def create_checkout(
    payload: PaymentCheckoutRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dep),
) -> PaymentCheckoutResponse:
    payment = await payment_service.create_checkout_order(db, user.id, payload)
    settings = get_settings()
    return PaymentCheckoutResponse(
        order_id=payment.order_id,
        provider="razorpay",
        provider_order_id=payment.order_id,
        checkout_key_id=settings.razorpay_key_id,
        amount_paise=payment.amount_paise,
        currency=payment.currency,
        status=payment.latest_status.value,
    )


@router.get("/{order_id}", response_model=PaymentStatusResponse)
async def get_payment(order_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(db_session_dep)) -> PaymentStatusResponse:
    payment = await payment_service.get_payment_for_user(db, user.id, order_id)
    return PaymentStatusResponse(
        order_id=payment.order_id,
        payment_id=payment.payment_id,
        status=payment.latest_status.value,
        event_sequence=payment.event_sequence,
    )


@router.post("/webhook", response_model=PaymentWebhookResponse)
async def payment_webhook(
    request: Request,
    db: AsyncSession = Depends(db_session_dep),
    x_razorpay_signature: str | None = Header(default=None),
) -> PaymentWebhookResponse:
    raw = await request.body()
    payload = PaymentWebhookRequest.model_validate(json.loads(raw.decode("utf-8")))
    outcome = await payment_service.process_payment_webhook(
        db,
        payload_model=payload,
        payload_raw=raw,
        signature=x_razorpay_signature,
    )
    return PaymentWebhookResponse(
        accepted=bool(outcome.get("accepted", False)),
        processed=bool(outcome.get("processed", False)),
        reason=str(outcome.get("reason", "unknown")),
        status=str(outcome["status"]) if "status" in outcome and outcome["status"] else None,
    )
