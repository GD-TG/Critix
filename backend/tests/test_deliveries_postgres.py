"""End-to-end event workflow against the disposable migrated PostgreSQL database."""
import copy
import os
from datetime import datetime, timedelta, timezone
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, delete
from sqlalchemy.orm import Session

from app import main, models
from app.db import session

pytestmark = pytest.mark.skipif(not os.getenv("TEST_DATABASE_URL"), reason="disposable PostgreSQL required")


def test_preview_decision_persistence_acceptance_history_and_legacy_client(monkeypatch):
    engine = create_engine(os.environ["TEST_DATABASE_URL"])
    def sessions():
        with Session(engine, expire_on_commit=False) as db:
            yield db
    main.app.dependency_overrides[session] = sessions
    monkeypatch.setenv("ADMIN_PASSWORD", "delivery-test-password")
    monkeypatch.setenv("COOKIE_SECURE", "false")
    main.attempts.clear()
    headers = {"X-Critix-Request": "1"}
    project_id = None
    try:
        c = TestClient(main.app)
        assert c.post("/api/login", headers=headers, json={"password": "delivery-test-password"}).status_code == 200
        response = c.post("/api/demo/deliveries", headers=headers)
        assert response.status_code == 201, response.text
        initial = response.json()
        project_id = initial["id"]
        url = f"/api/projects/{project_id}"
        catalog = c.get(url + "/delivery-cases")
        assert catalog.status_code == 200
        assert {a["kind"] for a in catalog.json()["deliveries"][0]["actions"]} == {"delay", "submit"}
        delivery = initial["project"]["deliveries"][0]
        event = dict(version=1, delivery_id=delivery["id"], kind="delay", reason="Подрядчик уточнил срок",
                     expected_at=(datetime.fromisoformat(delivery["expected_at"]) + timedelta(days=1)).isoformat())
        response = c.post(url + "/delivery-events/preview", headers=headers, json=event)
        assert response.status_code == 200, response.text
        preview = response.json()
        assert len(preview["variants"]) == 2
        assert c.get(url).json()["version"] == 1
        applied = c.post(url + "/delivery-events", headers=headers,
                         json={**event, "decision": "defer_optional", "decision_owner": "Владелец продукта"})
        assert applied.status_code == 200, applied.text
        saved = applied.json()
        assert saved["version"] == 2
        assert saved["project"]["deferred_task_ids"] == ["report"]
        assert saved["project"]["deliveries"][0]["promised_at"] == delivery["promised_at"]
        assert saved["analysis"]["forecast_finish"] == preview["variants"][1]["analysis"]["forecast_finish"]
        assert c.post(url + "/delivery-events", headers=headers,
                      json={**event, "decision_owner": "PM"}).status_code == 409
        history = c.get(url + "/history").json()
        assert history[0]["decision"]["choice"] == "defer_optional"
        assert history[0]["decision"]["external_approval_verified"] is False

        # A pre-delivery frontend sending only its known fields must not erase the new metadata.
        legacy = copy.deepcopy(saved["project"])
        for key in ("deliveries", "optional_task_ids", "deferred_task_ids"):
            legacy.pop(key)
        kept = c.put(url, headers=headers, json={"version": 2, "project": legacy})
        assert kept.status_code == 200, kept.text
        assert kept.json()["project"]["deliveries"] == saved["project"]["deliveries"]
        assert kept.json()["project"]["deferred_task_ids"] == ["report"]

        # No direct save can mark dependent work started before real acceptance.
        early = copy.deepcopy(kept.json()["project"])
        task = next(t for t in early["tasks"] if t["id"] == "integration")
        task.update(status="in_progress", actual_start=datetime.now(timezone.utc).replace(second=0, microsecond=0).isoformat())
        assert c.put(url, headers=headers, json={"version": 3, "project": early}).status_code == 422
        submit = dict(version=3, delivery_id=delivery["id"], kind="submit", reason="Получен результат", decision_owner="PM")
        assert c.post(url + "/delivery-events", headers=headers, json=submit).status_code == 200
        reject = dict(version=4, delivery_id=delivery["id"], kind="reject", reason="Проверка не пройдена", decision_owner="PM")
        rework = c.post(url + "/delivery-events", headers=headers, json=reject)
        assert rework.status_code == 200, rework.text
        assert rework.json()["impact"]["finish_after"] is None
        assert rework.json()["project"]["deliveries"][0]["status"] == "rework"
        submit["version"] = 5
        assert c.post(url + "/delivery-events", headers=headers, json=submit).status_code == 200
        accepted = c.post(url + "/delivery-events", headers=headers,
                          json={**submit, "version": 6, "kind": "accept", "reason": "Приёмка пройдена"})
        assert accepted.status_code == 200, accepted.text
        assert accepted.json()["project"]["deliveries"][0]["status"] == "accepted"
        reopened = c.get(url).json()
        assert reopened["version"] == 7
        assert not reopened["analysis"]["forecast_conditional"]
        assert c.get(url + "/delivery-cases").json()["deliveries"][0]["actions"] == []
    finally:
        main.app.dependency_overrides.pop(session, None)
        if project_id:
            with Session(engine) as db:
                db.execute(delete(models.Project).where(models.Project.id == UUID(project_id)))
                db.commit()
        engine.dispose()
