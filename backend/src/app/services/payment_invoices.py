from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from io import BytesIO

from reportlab.lib.pagesizes import A4  # type: ignore[import-untyped]
from reportlab.pdfgen import canvas  # type: ignore[import-untyped]

from app.core.config import get_settings
from app.models import Payment, User

GST_DIVISOR = Decimal("1.18")


@dataclass(slots=True)
class InvoiceArtifact:
    invoice_number: str
    artifact_key: str
    payload: bytes


@dataclass(slots=True)
class InvoiceBreakdown:
    taxable_amount_paise: int
    gst_amount_paise: int
    total_amount_paise: int


def _format_inr_from_paise(amount_paise: int) -> str:
    return f"INR {Decimal(amount_paise) / Decimal(100):.2f}"


def _derive_breakdown(total_amount_paise: int) -> InvoiceBreakdown:
    taxable_amount_paise = int((Decimal(total_amount_paise) / GST_DIVISOR).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    gst_amount_paise = total_amount_paise - taxable_amount_paise
    return InvoiceBreakdown(
        taxable_amount_paise=taxable_amount_paise,
        gst_amount_paise=gst_amount_paise,
        total_amount_paise=total_amount_paise,
    )


def _build_invoice_number(payment: Payment) -> str:
    created_at = payment.created_at.strftime("%Y%m%d")
    return f"INV-{created_at}-{payment.id[:8].upper()}"


def _line_items(payment: Payment, user: User, breakdown: InvoiceBreakdown, invoice_number: str) -> list[str]:
    settings = get_settings()
    tier_label = payment.tier.value if payment.tier is not None else "unknown"
    lines = [
        "Varasaan Tax Invoice",
        "",
        f"Invoice Number: {invoice_number}",
        f"Invoice Date: {payment.created_at.date().isoformat()}",
        f"Order ID: {payment.order_id}",
        f"Payment ID: {payment.payment_id or 'pending'}",
        "",
        f"Seller: {settings.invoice_seller_name}",
        f"Seller Address: {settings.invoice_seller_address}",
        f"Seller GSTIN: {settings.invoice_seller_gstin}",
        f"Place of Supply: {settings.invoice_place_of_supply}",
        f"Seller State Code: {settings.invoice_seller_state_code}",
        f"Support Email: {settings.invoice_support_email}",
        "",
        f"Bill To: {user.full_name or user.email}",
        f"Customer Email: {user.email}",
        "",
        f"Plan Tier: {tier_label}",
        f"Taxable Value: {_format_inr_from_paise(breakdown.taxable_amount_paise)}",
        f"GST 18%: {_format_inr_from_paise(breakdown.gst_amount_paise)}",
        f"Total Charged: {_format_inr_from_paise(breakdown.total_amount_paise)}",
    ]
    return lines


def build_invoice_artifact(payment: Payment, user: User) -> InvoiceArtifact:
    invoice_number = _build_invoice_number(payment)
    artifact_key = f"billing-invoices/{user.id}/{payment.order_id}.pdf"
    breakdown = _derive_breakdown(payment.amount_paise)

    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    _, height = A4
    y = height - 72

    for line in _line_items(payment, user, breakdown, invoice_number):
        pdf.drawString(72, y, line)
        y -= 18
        if y < 72:
            pdf.showPage()
            y = height - 72

    pdf.save()
    return InvoiceArtifact(invoice_number=invoice_number, artifact_key=artifact_key, payload=buffer.getvalue())
