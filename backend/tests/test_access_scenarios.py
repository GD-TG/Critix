"""Authorization and scenario regressions, only on disposable PostgreSQL."""
import os
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app import main, models, service
from app.db import session
from app.demo import demo

pytestmark = pytest.mark.skipif(not os.getenv("TEST_DATABASE_URL"), reason="disposable PostgreSQL required")


def test_account_isolation_demo_and_scenario_validation(monkeypatch):
    engine = create_engine(os.environ["TEST_DATABASE_URL"])
    def sessions():
        with Session(engine, expire_on_commit=False) as db:
            yield db
    main.app.dependency_overrides[session] = sessions
    monkeypatch.setattr(main, "SessionLocal", lambda: Session(engine, expire_on_commit=False))
    monkeypatch.setenv("COOKIE_SECURE", "false")
    monkeypatch.setenv("ADMIN_PASSWORD", "integration-test-password")
    headers = {"X-Critix-Request": "1"}
    try:
        a, b = TestClient(main.app), TestClient(main.app)
        for client in (a, b):
            response = client.post("/api/auth/register", headers=headers, json={"email": f"{uuid4()}@test.invalid", "password": "test-password", "name": "Test"})
            assert response.status_code == 201, response.text
        project_id = a.get("/api/projects").json()[0]["id"]
        url = f"/api/projects/{project_id}"
        project = a.get(url).json()["project"]
        assert project_id not in [p["id"] for p in b.get("/api/projects").json()]
        payload = {"version": 1, "project": project}
        scenario = {"base_version": 1, "name": "Valid", "project": project}
        sc = a.post(url + "/scenarios", headers=headers, json=scenario)
        assert sc.status_code == 201, sc.text
        for method, suffix, body in [
            ("GET", "", None), ("PUT", "", payload), ("DELETE", "", None),
            ("GET", "/history", None), ("GET", "/scenarios", None),
            ("POST", "/scenarios", scenario), ("DELETE", "/scenarios/" + sc.json()["id"], None),
            ("POST", "/simulate", payload), ("POST", "/level", payload),
            ("POST", "/ai", None), ("POST", "/chat", {"messages": [{"role": "user", "content": "test"}]}),
        ]:
            response = b.request(method, url + suffix, headers=headers, json=body)
            assert response.status_code == 404, (method, suffix, response.text)
        # Invalid scenarios must never be committed.
        import copy
        invalid = copy.deepcopy(project)
        edge = invalid["dependencies"][0]
        invalid["dependencies"].append({**edge, "predecessor_id": edge["successor_id"], "successor_id": edge["predecessor_id"]})
        assert a.post(url + "/scenarios", headers=headers, json={**scenario, "project": invalid}).status_code == 422
        assert a.post(url + "/scenarios", headers=headers, json={**scenario, "base_version": 99}).status_code == 409
        oversized = copy.deepcopy(project)
        oversized["tasks"][0]["duration_minutes"] = 525600
        assert a.put(url, headers=headers, json={"version": 1, "project": oversized}).status_code == 422
        assert a.post(url + "/scenarios", headers=headers, json={**scenario, "project": oversized}).status_code == 422
        unchanged = a.get(url).json()
        assert unchanged["version"] == 1
        assert unchanged["project"] == project
        assert len(a.get(url + "/scenarios").json()) == 1
        # An old corrupt snapshot remains removable, without breaking other rows.
        from datetime import datetime, timezone
        from uuid import UUID
        with Session(engine) as db:
            db.add(models.Scenario(project_id=UUID(project_id), name="Old broken", base_version=1, snapshot=invalid, created_at=datetime.now(timezone.utc)))
            legacy = service.create(db, demo())
        listed = a.get(url + "/scenarios")
        assert listed.status_code == 200
        assert sum(bool(item.get("error")) for item in listed.json()) == 1
        assert a.get(f'/api/projects/{legacy["id"]}').status_code == 404
        admin = TestClient(main.app)
        assert admin.post("/api/login", headers=headers, json={"password": "integration-test-password"}).status_code == 200
        assert admin.get(f'/api/projects/{legacy["id"]}').status_code == 200
        assert admin.get(url).status_code == 404
        # Only authenticated users can create a demo project; ownership persists.
        c = TestClient(main.app)
        assert c.post("/api/auth/demo", headers=headers).status_code == 410
        assert c.post("/api/demo", headers=headers).status_code == 401
        created_demo = a.post("/api/demo", headers=headers)
        assert created_demo.status_code == 201, created_demo.text
        demo_id = created_demo.json()["id"]
        assert b.get(f"/api/projects/{demo_id}").status_code == 404
    finally:
        main.app.dependency_overrides.pop(session, None)
        engine.dispose()
