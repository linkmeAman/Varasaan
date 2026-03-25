"""add phase b billing entitlement fields

Revision ID: 20260326_0008
Revises: 20260322_0007
Create Date: 2026-03-26 16:30:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260326_0008"
down_revision: str | None = "20260322_0007"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


ENTITLEMENT_TIER = sa.Enum("free", "essential", "executor", name="entitlementtier")


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        ENTITLEMENT_TIER.create(bind, checkfirst=True)

    op.add_column(
        "users",
        sa.Column("entitlement_tier", ENTITLEMENT_TIER, nullable=False, server_default="free"),
    )
    op.add_column("users", sa.Column("entitlement_updated_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("payments", sa.Column("tier", ENTITLEMENT_TIER, nullable=True))
    op.add_column("payments", sa.Column("invoice_number", sa.String(length=80), nullable=True))
    op.add_column("payments", sa.Column("invoice_artifact_key", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("payments", "invoice_artifact_key")
    op.drop_column("payments", "invoice_number")
    op.drop_column("payments", "tier")
    op.drop_column("users", "entitlement_updated_at")
    op.drop_column("users", "entitlement_tier")

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        ENTITLEMENT_TIER.drop(bind, checkfirst=True)
