"""Add users table and owner_id to projects table."""
from alembic import op
import sqlalchemy as sa

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "users",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.add_column("projects", sa.Column("owner_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_projects_owner_id_users",
        "projects",
        "users",
        ["owner_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_projects_owner_id", "projects", ["owner_id"])


def downgrade():
    op.drop_index("ix_projects_owner_id", table_name="projects")
    op.drop_constraint("fk_projects_owner_id_users", "projects", type_="foreignkey")
    op.drop_column("projects", "owner_id")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
