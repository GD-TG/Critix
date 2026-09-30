"""API persistence and versioning for backend rescue, disposable PostgreSQL only."""
import copy
import os
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, delete
from sqlalchemy.orm import Session

from app import main, models
from app.db import session

pytestmark = pytest.mark.skipif(not os.getenv("TEST_DATABASE_URL"), reason="disposable PostgreSQL required")


def test_task_add_remaining_save_reopen_ai_and_recommendations(monkeypatch):
    engine = create_engine(os.environ["TEST_DATABASE_URL"])
    def sessions():
        with Session(engine, expire_on_commit=False) as db:
            yield db
    monkeypatch.setattr(main, "SessionLocal", lambda: Session(engine, expire_on_commit=False))
    main.app.dependency_overrides[session] = sessions
    monkeypatch.setenv("ADMIN_PASSWORD", "integration-test-password")
    monkeypatch.setenv("COOKIE_SECURE", "false")
    monkeypatch.setenv("LLM_API_KEY", "")
    main.attempts.clear()
    headers = {"X-Critix-Request": "1"}
    project_id = None
    try:
        client = TestClient(main.app)
        assert client.post("/api/login", headers=headers, json={"password": "integration-test-password"}).status_code == 200
        initial = client.post("/api/demo", headers=headers).json()
        project_id = initial["id"]
        url = f"/api/projects/{project_id}"
        draft = copy.deepcopy(initial["project"])
        draft["tasks"].append(dict(id="new-check", name=" Проверка API ", duration_minutes=60))
        draft["dependencies"].append(dict(predecessor_id="5", successor_id="new-check"))
        payload = {"version": 1, "project": draft}
        preview = client.post(url + "/simulate", headers=headers, json=payload)
        assert preview.status_code == 200, preview.text
        assert "new-check" in preview.json()["changes"]["edited_task_ids"]
        assert client.get(url).json()["version"] == 1
        saved = client.put(url, headers=headers, json=payload)
        assert saved.status_code == 200, saved.text
        assert any(t["name"] == "Проверка API" for t in client.get(url).json()["project"]["tasks"])
        assert client.put(url, headers=headers, json=payload).status_code == 409

        draft = saved.json()["project"]
        task = next(t for t in draft["tasks"] if t["id"] == "5")
        task.update(status="in_progress", actual_start=draft["start"], remaining_minutes=120)
        saved = client.put(url, headers=headers, json={"version": 2, "project": draft})
        assert saved.status_code == 200, saved.text
        reopened = client.get(url).json()
        assert next(t for t in reopened["project"]["tasks"] if t["id"] == "5")["remaining_minutes"] == 120
        assert reopened["version"] == 3
        invalid = copy.deepcopy(draft)
        invalid["tasks"][-1]["name"] = "   "
        assert client.put(url, headers=headers, json={"version": 3, "project": invalid}).status_code == 422
        report = client.post(url + "/recommendations", headers=headers,
                             json={"version": 3, "project": draft, "include_leveling": False, "alternatives": [draft]})
        assert report.status_code == 200, report.text
        assert report.json()["proposals"][0]["finish_gain_minutes"] == 0
        assert client.get(url).json()["version"] == 3
        assert client.post(url + "/recommendations", headers=headers,
                           json={"version": 2, "project": draft}).status_code == 409
        message = {"role": "user", "content": "Что проверить первым?"}
        chat = client.post(url + "/chat", headers=headers, json={"version": 3, "messages": [message]})
        assert chat.status_code == 200, chat.text
        assert chat.json()["source"] == "engine"
        assert chat.json()["context"]["version"] == 3
        assert chat.json()["context"]["scope"] == "saved"
        assert client.post(url + "/chat", headers=headers, json={"version": 2, "messages": [message]}).status_code == 409
    finally:
        main.app.dependency_overrides.pop(session, None)
        if project_id:
            with Session(engine) as db:
                db.execute(delete(models.Project).where(models.Project.id == UUID(project_id)))
                db.commit()
        engine.dispose()


def test_concurrent_scenarios_cannot_exceed_limit(monkeypatch):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier, local
    from fastapi import HTTPException
    from sqlalchemy import func, select
    from app import service
    from app.demo import demo
    from app.schemas import CreateScenario

    engine = create_engine(os.environ["TEST_DATABASE_URL"])
    with Session(engine, expire_on_commit=False) as db:
        created = service.create(db, demo())
    project_id = created["id"]
    barrier, thread_state = Barrier(2), local()
    original_analyze = service.analyze

    def together(*args, **kwargs):
        if not getattr(thread_state, "entered", False):
            thread_state.entered = True
            barrier.wait(timeout=10)
        return original_analyze(*args, **kwargs)

    monkeypatch.setattr(service, "MAX_SCENARIOS_PER_PROJECT", 1)
    monkeypatch.setattr(service, "analyze", together)

    def save(name):
        with Session(engine, expire_on_commit=False) as db:
            try:
                service.create_scenario(db, project_id, CreateScenario(name=name, base_version=1, project=created["project"]))
                return 201
            except HTTPException as exc:
                return exc.status_code
    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            assert sorted(pool.map(save, ["One", "Two"])) == [201, 400]
        with Session(engine) as db:
            assert db.scalar(select(func.count()).select_from(models.Scenario).where(models.Scenario.project_id == project_id)) == 1
    finally:
        with Session(engine) as db:
            db.execute(delete(models.Project).where(models.Project.id == project_id))
            db.commit()
        engine.dispose()
