"""Verify upgrades using an isolated schema in the disposable test database."""
import json
import os
from pathlib import Path
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app import service
from app.schemas import Calendar


@pytest.mark.skipif(not os.getenv("TEST_DATABASE_URL"), reason="TEST_DATABASE_URL is not configured")
def test_upgrade_old_project_repairs_nulls_preserves_skills_and_is_idempotent():
    engine = create_engine(os.environ["TEST_DATABASE_URL"])
    schema = "migration_test_" + uuid4().hex
    project_id = uuid4()
    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    config.set_main_option("script_location", str(Path(__file__).parents[1] / "migrations"))
    with engine.connect() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        connection.execute(text(f'SET search_path TO "{schema}"'))
        connection.commit()
        config.attributes["connection"] = connection
        try:
            command.upgrade(config, "0001")
            connection.execute(text("""
                INSERT INTO projects (id, name, timezone, start, deadline, calendar, version)
                VALUES (:id, 'Existing project', 'Asia/Yekaterinburg',
                        '2026-09-21 09:00:00+05', '2026-09-30 18:00:00+05', CAST(:calendar AS json), 1)
            """), dict(id=project_id, calendar=Calendar().model_dump_json()))
            connection.execute(text("""
                INSERT INTO assignees (project_id, id, name, calendar)
                VALUES (:id, 'person', 'Existing assignee', CAST(:calendar AS json))
            """), dict(id=project_id, calendar=Calendar().model_dump_json()))
            connection.execute(text("""
                INSERT INTO tasks (project_id, id, name, duration_minutes, allocation_percent, status, assignee_id)
                VALUES (:id, 'task', 'Existing task', 60, 100, 'todo', 'person')
            """), dict(id=project_id))
            connection.commit()
            command.upgrade(config, "0003")
            assert connection.scalar(text("SELECT skills IS NULL FROM assignees"))
            # Both SQL NULL (old row) and explicit JSON null must be repaired.
            connection.execute(text("UPDATE tasks SET required_skills = 'null'::json"))
            connection.execute(text("""
                INSERT INTO assignees (project_id, id, name, calendar, skills)
                VALUES (:id, 'skilled', 'Skilled person', CAST(:calendar AS json), CAST(:skills AS json))
            """), dict(id=project_id, calendar=Calendar().model_dump_json(),
                       skills=json.dumps([dict(name="Python", level="expert")])))
            connection.commit()
            command.upgrade(config, "head")
            command.upgrade(config, "head")
            with Session(bind=connection) as db:
                project = service.snapshot(db, service.load(db, project_id))
                assert project.tasks[0].required_skills == []
                assert project.tasks[0].name == "Existing task"
                people = {p.id: p for p in project.assignees}
                assert people["person"].skills == []
                assert people["skilled"].skills[0].name == "Python"
                assert people["skilled"].skills[0].level == "expert"
            assert connection.scalar(text("""
                SELECT is_nullable FROM information_schema.columns
                WHERE table_schema = :schema AND table_name = 'assignees' AND column_name = 'skills'
            """), dict(schema=schema)) == "NO"
        finally:
            connection.rollback()
            connection.execute(text("SET search_path TO public"))
            # Only the UUID-named schema created by this test is removed.
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
            connection.commit()
    engine.dispose()
