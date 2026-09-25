"""Add skills to assignees and priority/required_skills to tasks."""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("assignees", sa.Column("skills", sa.JSON(), nullable=True))
    op.add_column("tasks", sa.Column("priority", sa.String(20), server_default="medium", nullable=False))
    op.add_column("tasks", sa.Column("required_skills", sa.JSON(), nullable=True))


def downgrade():
    op.drop_column("tasks", "required_skills")
    op.drop_column("tasks", "priority")
    op.drop_column("assignees", "skills")
