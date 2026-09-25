"""Initial normalized project aggregate."""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("projects", sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False), sa.Column("timezone", sa.String(100), nullable=False),
        sa.Column("start", sa.DateTime(timezone=True), nullable=False), sa.Column("deadline", sa.DateTime(timezone=True), nullable=False),
        sa.Column("calendar", sa.JSON(), nullable=False), sa.Column("version", sa.Integer(), nullable=False),
        sa.CheckConstraint("deadline > start"), sa.CheckConstraint("version > 0"))
    op.create_table("assignees", sa.Column("project_id", sa.Uuid(), sa.ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("id", sa.String(64), primary_key=True), sa.Column("name", sa.String(120), nullable=False), sa.Column("calendar", sa.JSON(), nullable=False))
    op.create_table("tasks", sa.Column("project_id", sa.Uuid(), sa.ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("id", sa.String(64), primary_key=True), sa.Column("name", sa.String(200), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False), sa.Column("not_before", sa.DateTime(timezone=True)),
        sa.Column("assignee_id", sa.String(64)), sa.Column("allocation_percent", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False), sa.Column("actual_start", sa.DateTime(timezone=True)), sa.Column("actual_finish", sa.DateTime(timezone=True)),
        sa.ForeignKeyConstraint(["project_id", "assignee_id"], ["assignees.project_id", "assignees.id"]),
        sa.CheckConstraint("duration_minutes > 0"), sa.CheckConstraint("allocation_percent BETWEEN 1 AND 100"),
        sa.CheckConstraint("status IN ('todo', 'in_progress', 'done', 'blocked')"))
    op.create_table("dependencies", sa.Column("project_id", sa.Uuid(), primary_key=True),
        sa.Column("predecessor_id", sa.String(64), primary_key=True), sa.Column("successor_id", sa.String(64), primary_key=True),
        sa.Column("kind", sa.String(2), nullable=False), sa.Column("lag_minutes", sa.Integer(), nullable=False), sa.Column("lag_mode", sa.String(10), nullable=False),
        sa.ForeignKeyConstraint(["project_id", "predecessor_id"], ["tasks.project_id", "tasks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id", "successor_id"], ["tasks.project_id", "tasks.id"], ondelete="CASCADE"),
        sa.CheckConstraint("predecessor_id <> successor_id"), sa.CheckConstraint("kind IN ('FS', 'SS', 'FF', 'SF')"),
        sa.CheckConstraint("lag_mode IN ('working', 'elapsed')"))
    op.create_table("changes", sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("project_id", sa.Uuid(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("snapshot", sa.JSON(), nullable=False), sa.Column("analysis", sa.JSON(), nullable=False), sa.UniqueConstraint("project_id", "version"))
    op.create_index("ix_changes_project_id", "changes", ["project_id"])


def downgrade():
    for table in ("changes", "dependencies", "tasks", "assignees", "projects"):
        op.drop_table(table)
