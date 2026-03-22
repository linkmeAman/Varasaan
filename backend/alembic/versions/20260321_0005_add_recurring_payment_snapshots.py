"""add recurring payment inventory and case task snapshots

Revision ID: 20260321_0005
Revises: 20260321_0004
Create Date: 2026-03-21 00:05:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "20260321_0005"
down_revision = "20260321_0004"
branch_labels = None
depends_on = None


RECURRING_PAYMENT_RAIL = sa.Enum("card", "upi_autopay", "other", name="recurringpaymentrail")


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        RECURRING_PAYMENT_RAIL.create(bind, checkfirst=True)

    op.add_column(
        "inventory_accounts",
        sa.Column("is_recurring_payment", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("inventory_accounts", sa.Column("payment_rail", RECURRING_PAYMENT_RAIL, nullable=True))
    op.add_column("inventory_accounts", sa.Column("monthly_amount_paise", sa.Integer(), nullable=True))
    op.add_column("inventory_accounts", sa.Column("payment_reference_hint", sa.String(length=255), nullable=True))

    op.add_column(
        "case_tasks",
        sa.Column("is_recurring_payment", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("case_tasks", sa.Column("payment_rail", RECURRING_PAYMENT_RAIL, nullable=True))
    op.add_column("case_tasks", sa.Column("monthly_amount_paise", sa.Integer(), nullable=True))
    op.add_column("case_tasks", sa.Column("payment_reference_hint", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("case_tasks", "payment_reference_hint")
    op.drop_column("case_tasks", "monthly_amount_paise")
    op.drop_column("case_tasks", "payment_rail")
    op.drop_column("case_tasks", "is_recurring_payment")

    op.drop_column("inventory_accounts", "payment_reference_hint")
    op.drop_column("inventory_accounts", "monthly_amount_paise")
    op.drop_column("inventory_accounts", "payment_rail")
    op.drop_column("inventory_accounts", "is_recurring_payment")

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        RECURRING_PAYMENT_RAIL.drop(bind, checkfirst=True)
