"""Add baseline column to projects table."""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("projects", sa.Column("baseline", sa.JSON(), nullable=True))


def downgrade():
    op.drop_column("projects", "baseline")
