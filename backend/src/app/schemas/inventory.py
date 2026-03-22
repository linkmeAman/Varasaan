from pydantic import BaseModel, Field, model_validator

from app.models import RecurringPaymentRail


class InventoryRequestBase(BaseModel):
    platform: str
    category: str
    username_hint: str | None = None
    is_recurring_payment: bool = False
    payment_rail: RecurringPaymentRail | None = None
    monthly_amount_paise: int | None = Field(default=None, ge=1)
    payment_reference_hint: str | None = None

    @model_validator(mode="after")
    def validate_recurring_payment_fields(self) -> "InventoryRequestBase":
        if self.is_recurring_payment:
            if self.payment_rail is None:
                raise ValueError("payment_rail is required when is_recurring_payment is true")
            if self.monthly_amount_paise is None:
                raise ValueError("monthly_amount_paise is required when is_recurring_payment is true")
        return self


class InventoryCreateRequest(InventoryRequestBase):
    importance_level: int = 2


class InventoryResponse(BaseModel):
    id: str
    platform: str
    category: str
    username_hint: str | None = None
    importance_level: int
    is_recurring_payment: bool = False
    payment_rail: RecurringPaymentRail | None = None
    monthly_amount_paise: int | None = None
    payment_reference_hint: str | None = None


class InventoryUpdateRequest(InventoryRequestBase):
    importance_level: int
