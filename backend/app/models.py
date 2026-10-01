from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, ForeignKeyConstraint, Integer, JSON, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), server_default=func.now())


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(200))
    timezone: Mapped[str] = mapped_column(String(100))
    start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    baseline: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    calendar: Mapped[dict] = mapped_column(JSON)
    deliveries: Mapped[list] = mapped_column(JSON, default=list, server_default="[]", nullable=False)
    optional_task_ids: Mapped[list] = mapped_column(JSON, default=list, server_default="[]", nullable=False)
    deferred_task_ids: Mapped[list] = mapped_column(JSON, default=list, server_default="[]", nullable=False)
    version: Mapped[int] = mapped_column(default=1)
    owner_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    __table_args__ = (CheckConstraint("deadline > start"), CheckConstraint("version > 0"))


class Assignee(Base):
    __tablename__ = "assignees"
    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True)
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str | None] = mapped_column(String(120), nullable=True)
    skills: Mapped[list] = mapped_column(JSON, default=list, server_default="[]", nullable=False)
    calendar: Mapped[dict] = mapped_column(JSON)


class Task(Base):
    __tablename__ = "tasks"
    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True)
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    duration_minutes: Mapped[int]
    remaining_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    priority: Mapped[str] = mapped_column(String(20), default="medium")
    required_skills: Mapped[list] = mapped_column(JSON, default=list, server_default="[]", nullable=False)
    not_before: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    assignee_id: Mapped[str | None] = mapped_column(String(64))
    allocation_percent: Mapped[int] = mapped_column(default=100)
    status: Mapped[str] = mapped_column(String(20))
    actual_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    actual_finish: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (
        ForeignKeyConstraint(["project_id", "assignee_id"], ["assignees.project_id", "assignees.id"], ondelete="SET NULL"),
        CheckConstraint("duration_minutes >= 0"),
        CheckConstraint("remaining_minutes IS NULL OR (remaining_minutes BETWEEN 0 AND 525600 AND actual_start IS NOT NULL AND status IN ('in_progress', 'blocked'))", name="ck_tasks_remaining_work"),
        CheckConstraint("allocation_percent BETWEEN 1 AND 100"),
        CheckConstraint("status IN ('todo', 'in_progress', 'done', 'blocked')"),
    )


class Dependency(Base):
    __tablename__ = "dependencies"
    project_id: Mapped[UUID] = mapped_column(primary_key=True)
    predecessor_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    successor_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    kind: Mapped[str] = mapped_column(String(2))
    lag_minutes: Mapped[int] = mapped_column(Integer)
    lag_mode: Mapped[str] = mapped_column(String(10))
    __table_args__ = (
        ForeignKeyConstraint(["project_id", "predecessor_id"], ["tasks.project_id", "tasks.id"], ondelete="CASCADE"),
        ForeignKeyConstraint(["project_id", "successor_id"], ["tasks.project_id", "tasks.id"], ondelete="CASCADE"),
        CheckConstraint("predecessor_id <> successor_id"),
        CheckConstraint("kind IN ('FS', 'SS', 'FF', 'SF')"),
        CheckConstraint("lag_mode IN ('working', 'elapsed')"),
    )


class Change(Base):
    __tablename__ = "changes"
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    version: Mapped[int]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), server_default=func.now())
    snapshot: Mapped[dict] = mapped_column(JSON)
    analysis: Mapped[dict] = mapped_column(JSON)
    comment: Mapped[str | None] = mapped_column(String(512), nullable=True)
    decision: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    __table_args__ = (UniqueConstraint("project_id", "version"),)


class Scenario(Base):
    __tablename__ = "scenarios"
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(128))
    description: Mapped[str | None] = mapped_column(String(512), nullable=True)
    base_version: Mapped[int]
    snapshot: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), server_default=func.now())

