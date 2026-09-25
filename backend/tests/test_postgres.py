"""Run only against a disposable migrated PostgreSQL database."""
import os

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, delete, select
from sqlalchemy.orm import Session

from app import models, service
from app.demo import demo
from app.schemas import SaveProject


@pytest.mark.skipif(not os.getenv("TEST_DATABASE_URL"), reason="TEST_DATABASE_URL is not configured")
def test_http_login_demo_simulation_save_and_reopen(monkeypatch):
    from fastapi.testclient import TestClient
    from app.db import session
    from app.main import app, attempts

    engine = create_engine(os.environ["TEST_DATABASE_URL"])
    project_id = None
    def test_session():
        with Session(engine, expire_on_commit=False) as db:
            yield db
    app.dependency_overrides[session] = test_session
    monkeypatch.setenv("ADMIN_PASSWORD", "integration-test-password")
    monkeypatch.setenv("SESSION_SECRET", "integration-only-session-secret-32-characters")
    monkeypatch.setenv("COOKIE_SECURE", "false")
    attempts.clear()
    headers = {"X-Critix-Request": "1"}
    try:
        with TestClient(app) as client:
            assert client.post("/api/login", headers=headers, json={"password": "integration-test-password"}).status_code == 200
            created = client.post("/api/demo", headers=headers)
            assert created.status_code == 201, created.text
            data = created.json()
            project_id = data["id"]
            original = data["project"]
            import copy
            changed = copy.deepcopy(original)
            task = next(t for t in changed["tasks"] if t["id"] == "5")
            task["duration_minutes"] += 480
            url = f"/api/projects/{project_id}"
            request = {"version": 1, "project": changed}
            preview = client.post(url + "/simulate", headers=headers, json=request)
            assert preview.status_code == 200, preview.text
            assert preview.json()["changes"]["finish_delta_minutes"] > 0
            unchanged = client.get(url).json()
            assert next(t for t in unchanged["project"]["tasks"] if t["id"] == "5")["duration_minutes"] == 1440
            saved = client.put(url, headers=headers, json=request)
            assert saved.status_code == 200, saved.text
            assert saved.json()["version"] == 2
            assert client.put(url, headers=headers, json=request).status_code == 409
            reopened = client.get(url)
            assert reopened.status_code == 200
            assert reopened.json()["analysis"]["finish"] == preview.json()["analysis"]["finish"]
            # Actual dates cleared in the form must be accepted by the API.
            changed = reopened.json()["project"]
            first = next(t for t in changed["tasks"] if t["id"] == "1")
            first.update(status="todo", actual_start=None, actual_finish=None)
            result = client.put(url, headers=headers, json={"version": 2, "project": changed})
            assert result.status_code == 200, result.text
    finally:
        app.dependency_overrides.pop(session, None)
        if project_id:
            from uuid import UUID
            with Session(engine) as db:
                db.execute(delete(models.Project).where(models.Project.id == UUID(project_id)))
                db.commit()
        engine.dispose()


@pytest.mark.skipif(not os.getenv("TEST_DATABASE_URL"), reason="TEST_DATABASE_URL is not configured")
def test_save_simulate_conflict_and_rollback():
    engine = create_engine(os.environ["TEST_DATABASE_URL"])
    project_id = None
    try:
        with Session(engine, expire_on_commit=False) as db:
            created = service.create(db, demo())
            project_id = created["id"]
            data = service.snapshot(db, service.load(db, project_id))
            assert len(data.tasks) == 10
            changed_task = next(t for t in data.tasks if t.id == "5")
            changed_task.duration_minutes += 480
            request = SaveProject(version=1, project=data)
            preview = service.update(db, project_id, request, simulate=True)
            assert preview["changes"]["changed_task_ids"]
            unchanged = service.snapshot(db, service.load(db, project_id))
            assert next(t for t in unchanged.tasks if t.id == "5").duration_minutes != changed_task.duration_minutes
            updated = service.update(db, project_id, request)
            assert updated["version"] == 2
            with pytest.raises(HTTPException) as error:
                service.update(db, project_id, request)
            assert error.value.status_code == 409
            db.rollback()
            assert len(list(db.scalars(select(models.Change).where(models.Change.project_id == project_id)))) == 2
    finally:
        if project_id:
            with Session(engine) as db:
                db.execute(delete(models.Project).where(models.Project.id == project_id))
                db.commit()
        engine.dispose()
