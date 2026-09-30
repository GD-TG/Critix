"""Optional remaining work estimate for an unfinished task with an actual start."""
from alembic import op
import sqlalchemy as sa

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("tasks", sa.Column("remaining_minutes", sa.Integer(), nullable=True))
    op.create_check_constraint(
        "ck_tasks_remaining_work", "tasks",
        "remaining_minutes IS NULL OR (remaining_minutes BETWEEN 0 AND 525600 "
        "AND actual_start IS NOT NULL AND status IN ('in_progress', 'blocked'))",
    )


def downgrade():
    op.drop_constraint("ck_tasks_remaining_work", "tasks", type_="check")
    op.drop_column("tasks", "remaining_minutes")
