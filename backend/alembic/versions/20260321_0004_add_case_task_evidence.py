"""add case task evidence

Revision ID: 20260321_0004
Revises: 20260321_0003
Create Date: 2026-03-21 00:04:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "20260321_0004"
down_revision = "20260321_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "case_task_evidence",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("case_task_id", sa.String(length=36), nullable=False),
        sa.Column("document_id", sa.String(length=36), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["case_task_id"], ["case_tasks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_case_task_evidence_case_task_id"), "case_task_evidence", ["case_task_id"], unique=False)
    op.create_index(op.f("ix_case_task_evidence_document_id"), "case_task_evidence", ["document_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_case_task_evidence_document_id"), table_name="case_task_evidence")
    op.drop_index(op.f("ix_case_task_evidence_case_task_id"), table_name="case_task_evidence")
    op.drop_table("case_task_evidence")
