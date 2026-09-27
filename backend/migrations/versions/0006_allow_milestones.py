"""Allow zero-duration milestones without changing existing task data."""
from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade():
    # 0001 used an unnamed constraint: discover its PostgreSQL-generated name.
    for constraint in sa.inspect(op.get_bind()).get_check_constraints("tasks"):
        expression = constraint["sqltext"].replace("(", "").replace(")", "").replace(" ", "")
        if expression in ("duration_minutes>0", "duration_minutes>=0"):
            op.drop_constraint(constraint["name"], "tasks", type_="check")
    op.create_check_constraint("ck_tasks_duration_nonnegative", "tasks", "duration_minutes >= 0")


def downgrade():
    # Refuse lossy rollback instead of deleting milestones or changing their duration.
    if op.get_bind().scalar(sa.text("SELECT EXISTS (SELECT 1 FROM tasks WHERE duration_minutes = 0)")):
        raise RuntimeError("Нельзя откатить миграцию: в базе есть вехи нулевой длительности")
    op.drop_constraint("ck_tasks_duration_nonnegative", "tasks", type_="check")
    op.create_check_constraint("ck_tasks_duration_positive", "tasks", "duration_minutes > 0")
