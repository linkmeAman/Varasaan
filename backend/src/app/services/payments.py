from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import verify_webhook_signature
from app.models import Payment, PaymentStatus
from app.schemas.payments import PaymentCheckoutRequest, PaymentWebhookRequest

STATUS_RANK: dict[PaymentStatus, int] = {
    PaymentStatus.CREATED: 0,
    PaymentStatus.AUTHORIZED: 1,
    PaymentStatus.FAILED: 2,
    PaymentStatus.CAPTURED: 3,
    PaymentStatus.REFUNDED: 4,
}

TIER_PRICE_PAISE: dict[str, int] = {
    "essential": 99900,
    "executor": 249900,
}


def _normalize_status(value: str) -> PaymentStatus:
    normalized = value.lower().strip()
    if normalized in {"created", "order_created"}:
        return PaymentStatus.CREATED
    if normalized in {"authorized", "payment_authorized"}:
        return PaymentStatus.AUTHORIZED
    if normalized in {"captured", "payment_captured", "paid"}:
        return PaymentStatus.CAPTURED
    if normalized in {"failed", "payment_failed"}:
        return PaymentStatus.FAILED
    if normalized in {"refunded", "payment_refunded"}:
        return PaymentStatus.REFUNDED
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported payment status")


async def create_checkout_order(db: AsyncSession, user_id: str, payload: PaymentCheckoutRequest) -> Payment:
    amount_paise = TIER_PRICE_PAISE.get(payload.tier)
    if amount_paise is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported tier")

    order_id = f"order_{uuid4().hex[:20]}"
    payment = Payment(
        user_id=user_id,
        order_id=order_id,
        amount_paise=amount_paise,
        currency="INR",
        latest_status=PaymentStatus.CREATED,
        event_sequence=0,
    )
    db.add(payment)
    await db.flush()
    return payment


async def get_payment_for_user(db: AsyncSession, user_id: str, order_id: str) -> Payment:
    result = await db.execute(select(Payment).where(Payment.order_id == order_id, Payment.user_id == user_id))
    payment = result.scalars().first()
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    return payment


async def _resolve_payment(db: AsyncSession, payload: PaymentWebhookRequest) -> Payment | None:
    if payload.order_id:
        result = await db.execute(select(Payment).where(Payment.order_id == payload.order_id))
        payment = result.scalars().first()
        if payment:
            return payment

    if payload.payment_id:
        result = await db.execute(select(Payment).where(Payment.payment_id == payload.payment_id))
        return result.scalars().first()
    return None


async def process_payment_webhook(
    db: AsyncSession,
    *,
    payload_model: PaymentWebhookRequest,
    payload_raw: bytes,
    signature: str | None,
) -> dict[str, str | bool | int]:
    settings = get_settings()
    if not signature:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing webhook signature")
    if not verify_webhook_signature(payload_raw, signature, settings.razorpay_webhook_secret):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature")

    payment = await _resolve_payment(db, payload_model)
    if not payment:
        return {"accepted": True, "processed": False, "reason": "payment_not_found"}

    incoming_status = _normalize_status(payload_model.status)
    incoming_sequence = int(payload_model.event_sequence)
    event_id = payload_model.event_id

    if incoming_sequence < payment.event_sequence:
        return {"accepted": True, "processed": False, "reason": "out_of_order"}

    if incoming_sequence == payment.event_sequence:
        if event_id and payment.last_event_id == event_id:
            return {"accepted": True, "processed": False, "reason": "replay"}
        return {"accepted": True, "processed": False, "reason": "duplicate_sequence"}

    if STATUS_RANK[incoming_status] < STATUS_RANK[payment.latest_status]:
        return {"accepted": True, "processed": False, "reason": "status_regression"}

    if payload_model.payment_id:
        if payment.payment_id and payment.payment_id != payload_model.payment_id:
            return {"accepted": True, "processed": False, "reason": "payment_id_conflict"}
        payment.payment_id = payload_model.payment_id

    payment.latest_status = incoming_status
    payment.event_sequence = incoming_sequence
    payment.last_event_id = event_id
    if incoming_status == PaymentStatus.CAPTURED and payment.unlocked_at is None:
        payment.unlocked_at = datetime.now(UTC)
        payment.invoice_issued_at = datetime.now(UTC)

    await db.flush()
    return {"accepted": True, "processed": True, "reason": "updated", "status": payment.latest_status.value}
