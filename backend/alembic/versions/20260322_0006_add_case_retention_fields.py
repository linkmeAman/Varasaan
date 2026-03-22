"""add case retention fields

Revision ID: 20260322_0006
Revises: 20260321_0005
Create Date: 2026-03-22 09:10:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260322_0006"
down_revision: str | None = "20260321_0005"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("cases", sa.Column("evidence_retention_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("case_task_evidence", sa.Column("retention_purge_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("case_task_evidence", sa.Column("retention_purged_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index(
        op.f("ix_case_task_evidence_retention_purge_at"),
        "case_task_evidence",
        ["retention_purge_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_case_task_evidence_retention_purge_at"), table_name="case_task_evidence")
    op.drop_column("case_task_evidence", "retention_purged_at")
    op.drop_column("case_task_evidence", "retention_purge_at")
    op.drop_column("cases", "evidence_retention_expires_at")
