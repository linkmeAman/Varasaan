"""add heartbeats

Revision ID: 20260320_0002
Revises: 20260308_0001
Create Date: 2026-03-20 00:02:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "20260320_0002"
down_revision = "20260308_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "heartbeats",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("cadence", sa.Enum("monthly", "quarterly", name="heartbeatcadence"), nullable=False),
        sa.Column("status", sa.Enum("active", "paused", "overdue", "escalated", name="heartbeatstatus"), nullable=False),
        sa.Column("last_checked_in_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_expected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_action_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("pre_due_notice_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("escalation_level", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_reminder_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("executor_notified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_heartbeats_user_id"),
    )
    op.create_index(op.f("ix_heartbeats_next_action_at"), "heartbeats", ["next_action_at"], unique=False)
    op.create_index(op.f("ix_heartbeats_status"), "heartbeats", ["status"], unique=False)
    op.create_index(op.f("ix_heartbeats_user_id"), "heartbeats", ["user_id"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_heartbeats_user_id"), table_name="heartbeats")
    op.drop_index(op.f("ix_heartbeats_status"), table_name="heartbeats")
    op.drop_index(op.f("ix_heartbeats_next_action_at"), table_name="heartbeats")
    op.drop_table("heartbeats")

