"""add case activation review fields

Revision ID: 20260322_0007
Revises: 20260322_0006
Create Date: 2026-03-22 13:15:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260322_0007"
down_revision: str | None = "20260322_0006"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


CASE_ACTIVATION_REVIEW_STATUS = sa.Enum(
    "not_requested",
    "pending_review",
    "approved",
    "rejected",
    name="caseactivationreviewstatus",
)


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        CASE_ACTIVATION_REVIEW_STATUS.create(bind, checkfirst=True)

    op.add_column(
        "cases",
        sa.Column(
            "activation_review_status",
            CASE_ACTIVATION_REVIEW_STATUS,
            nullable=False,
            server_default="not_requested",
        ),
    )
    op.add_column("cases", sa.Column("activation_review_reason", sa.String(length=120), nullable=True))
    op.add_column("cases", sa.Column("activation_review_note", sa.Text(), nullable=True))
    op.add_column("cases", sa.Column("activation_review_requested_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("cases", sa.Column("activation_review_updated_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("cases", sa.Column("death_certificate_sanitized_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "cases",
        sa.Column(
            "death_certificate_metadata_stripped",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.create_index(
        op.f("ix_cases_activation_review_status"),
        "cases",
        ["activation_review_status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_cases_activation_review_status"), table_name="cases")
    op.drop_column("cases", "death_certificate_metadata_stripped")
    op.drop_column("cases", "death_certificate_sanitized_at")
    op.drop_column("cases", "activation_review_updated_at")
    op.drop_column("cases", "activation_review_requested_at")
    op.drop_column("cases", "activation_review_note")
    op.drop_column("cases", "activation_review_reason")
    op.drop_column("cases", "activation_review_status")

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        CASE_ACTIVATION_REVIEW_STATUS.drop(bind, checkfirst=True)
