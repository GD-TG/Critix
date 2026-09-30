"""External deliveries, release scope and structured decision history."""
from alembic import op
import sqlalchemy as sa

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade():
    for name in ("deliveries", "optional_task_ids", "deferred_task_ids"):
        op.add_column("projects", sa.Column(name, sa.JSON(), nullable=False, server_default="[]"))
    op.add_column("changes", sa.Column("decision", sa.JSON(), nullable=True))


def downgrade():
    op.drop_column("changes", "decision")
    for name in ("deferred_task_ids", "optional_task_ids", "deliveries"):
        op.drop_column("projects", name)
