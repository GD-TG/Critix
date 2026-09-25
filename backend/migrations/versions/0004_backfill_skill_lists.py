"""Repair skill lists on projects created before migration 0002."""
from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade():
    for table, column in (("assignees", "skills"), ("tasks", "required_skills")):
        # SQL NULL and JSON null both decode to None; preserve populated lists.
        op.execute(sa.text(
            f"UPDATE {table} SET {column} = '[]'::json "
            f"WHERE {column} IS NULL OR json_typeof({column}) = 'null'"
        ))
        op.alter_column(table, column, existing_type=sa.JSON(),
                        nullable=False, server_default=sa.text("'[]'::json"))


def downgrade():
    for table, column in (("assignees", "skills"), ("tasks", "required_skills")):
        op.alter_column(table, column, existing_type=sa.JSON(),
                        nullable=True, server_default=None)
