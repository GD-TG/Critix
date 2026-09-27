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
def test_two_concurrent_saves_do_not_hold_locks_during_analysis_or_lose_updates(monkeypatch):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier, local
    engine = create_engine(os.environ["TEST_DATABASE_URL"])
    with Session(engine, expire_on_commit=False) as db:
        created = service.create(db, demo())
        project_id = created["id"]
        original = created["project"]
    barrier, thread_state = Barrier(2), local()
    real_analyze = service.analyze
    def synchronized_analyze(*args, **kwargs):
        if not getattr(thread_state, "entered", False):
            thread_state.entered = True
            barrier.wait(timeout=10)
        return real_analyze(*args, **kwargs)
    monkeypatch.setattr(service, "analyze", synchronized_analyze)
    def save(name):
        data = original.model_copy(deep=True)
        data.name = name
        with Session(engine, expire_on_commit=False) as db:
            try:
                return service.update(db, project_id, SaveProject(version=1, project=data))["version"]
            except HTTPException as exc:
                return exc.status_code
    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            assert sorted(pool.map(save, ["writer one", "writer two"])) == [2, 409]
        with Session(engine) as db:
            assert service.load(db, project_id).version == 2
            assert len(list(db.scalars(select(models.Change).where(models.Change.project_id == project_id)))) == 2
    finally:
        with Session(engine) as db:
            db.execute(delete(models.Project).where(models.Project.id == project_id))
            db.commit()
        engine.dispose()


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
            assert any(t["duration_minutes"] == 0 for t in original["tasks"])
            leveled = client.post(f"/api/projects/{project_id}/level", headers=headers, json={"version": 1, "project": original})
            assert leveled.status_code == 200, leveled.text
            assert leveled.json()["project"]["dependencies"] == original["dependencies"]
            assert client.get(f"/api/projects/{project_id}").json()["version"] == 1
            assert client.post(f"/api/projects/{project_id}/level", headers=headers, json={"version": 2, "project": original}).status_code == 409
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
            history = client.get(url + "/history")
            assert history.status_code == 200
            assert [entry["version"] for entry in history.json()] == [3, 2, 1]
            assert history.json()[0]["task_count"] == len(demo().tasks)
            assert client.delete(url, headers=headers).status_code == 200
            assert client.get(url).status_code == 404
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
            assert len(data.tasks) == len(demo().tasks)
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
