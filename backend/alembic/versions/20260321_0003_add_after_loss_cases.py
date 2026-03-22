"""add after-loss cases

Revision ID: 20260321_0003
Revises: 20260320_0002
Create Date: 2026-03-21 00:03:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "20260321_0003"
down_revision = "20260320_0002"
branch_labels = None
depends_on = None


def _add_executor_to_trusted_contact_role() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.execute("ALTER TYPE trustedcontactrole ADD VALUE IF NOT EXISTS 'executor'")


def upgrade() -> None:
    _add_executor_to_trusted_contact_role()

    op.create_table(
        "cases",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("owner_user_id", sa.String(length=36), nullable=False),
        sa.Column(
            "status",
            sa.Enum("activation_pending", "active", "closed", name="casestatus"),
            nullable=False,
            server_default="activation_pending",
        ),
        sa.Column("death_certificate_document_id", sa.String(length=36), nullable=True),
        sa.Column("death_certificate_version_id", sa.String(length=36), nullable=True),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["death_certificate_document_id"], ["documents.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["death_certificate_version_id"], ["document_versions.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("owner_user_id", name="uq_cases_owner_user_id"),
    )
    op.create_index(op.f("ix_cases_death_certificate_document_id"), "cases", ["death_certificate_document_id"], unique=False)
    op.create_index(op.f("ix_cases_death_certificate_version_id"), "cases", ["death_certificate_version_id"], unique=False)
    op.create_index(op.f("ix_cases_status"), "cases", ["status"], unique=False)

    op.create_table(
        "case_participants",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("case_id", sa.String(length=36), nullable=False),
        sa.Column("trusted_contact_id", sa.String(length=36), nullable=False),
        sa.Column("role", sa.Enum("executor", name="caseparticipantrole"), nullable=False, server_default="executor"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["trusted_contact_id"], ["trusted_contacts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("case_id", "trusted_contact_id", name="uq_case_participants_case_contact"),
    )
    op.create_index(op.f("ix_case_participants_case_id"), "case_participants", ["case_id"], unique=False)
    op.create_index(op.f("ix_case_participants_trusted_contact_id"), "case_participants", ["trusted_contact_id"], unique=False)

    op.create_table(
        "case_tasks",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("case_id", sa.String(length=36), nullable=False),
        sa.Column("inventory_account_id", sa.String(length=36), nullable=True),
        sa.Column("platform", sa.String(length=120), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=False),
        sa.Column("priority", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "not_started",
                "in_progress",
                "submitted",
                "waiting",
                "resolved",
                "escalated",
                name="casetaskstatus",
            ),
            nullable=False,
            server_default="not_started",
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("reference_number", sa.String(length=120), nullable=True),
        sa.Column("submitted_date", sa.Date(), nullable=True),
        sa.Column("evidence_document_id", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["evidence_document_id"], ["documents.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["inventory_account_id"], ["inventory_accounts.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("case_id", "inventory_account_id", name="uq_case_tasks_case_inventory_account"),
    )
    op.create_index(op.f("ix_case_tasks_case_id"), "case_tasks", ["case_id"], unique=False)
    op.create_index(op.f("ix_case_tasks_inventory_account_id"), "case_tasks", ["inventory_account_id"], unique=False)
    op.create_index(op.f("ix_case_tasks_status"), "case_tasks", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_case_tasks_status"), table_name="case_tasks")
    op.drop_index(op.f("ix_case_tasks_inventory_account_id"), table_name="case_tasks")
    op.drop_index(op.f("ix_case_tasks_case_id"), table_name="case_tasks")
    op.drop_table("case_tasks")

    op.drop_index(op.f("ix_case_participants_trusted_contact_id"), table_name="case_participants")
    op.drop_index(op.f("ix_case_participants_case_id"), table_name="case_participants")
    op.drop_table("case_participants")

    op.drop_index(op.f("ix_cases_status"), table_name="cases")
    op.drop_index(op.f("ix_cases_death_certificate_version_id"), table_name="cases")
    op.drop_index(op.f("ix_cases_death_certificate_document_id"), table_name="cases")
    op.drop_table("cases")
