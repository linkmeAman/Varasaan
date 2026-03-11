from pydantic import BaseModel


class PaymentCheckoutRequest(BaseModel):
    amount_paise: int
    currency: str = "INR"


class PaymentCheckoutResponse(BaseModel):
    order_id: str
    provider: str
    provider_order_id: str
    checkout_key_id: str | None = None
    amount_paise: int
    currency: str
    status: str


class PaymentWebhookRequest(BaseModel):
    event_id: str | None = None
    order_id: str
    payment_id: str | None = None
    status: str
    event_sequence: int = 0


class PaymentWebhookResponse(BaseModel):
    accepted: bool
    processed: bool
    reason: str
    status: str | None = None


class PaymentStatusResponse(BaseModel):
    order_id: str
    payment_id: str | None = None
    status: str
    event_sequence: int
