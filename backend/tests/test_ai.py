import asyncio
import json
from datetime import datetime
from types import SimpleNamespace

from app import ai
from app.demo import demo
from app.engine.analysis import analyze


def test_explanation_sends_engine_facts_without_changing_project(monkeypatch):
    project = demo()
    original = project.model_dump_json()
    analysis = analyze(project)
    captured = {}

    async def create(**kwargs):
        captured.update(kwargs)
        return SimpleNamespace(choices=[SimpleNamespace(
            message=SimpleNamespace(content="Проверить навык Architecture у исполнителя задачи 2.")
        )])

    monkeypatch.setenv("LLM_API_KEY", "test-key-never-sent")
    monkeypatch.setenv("LLM_MODEL", "test-model")
    monkeypatch.setattr(ai, "AsyncOpenAI", lambda **kwargs: SimpleNamespace(
        chat=SimpleNamespace(completions=SimpleNamespace(create=create))
    ))
    result = asyncio.run(ai.explain(project, analysis))
    assert result["available"] is True
    payload = json.loads(captured["messages"][1]["content"])
    assert datetime.fromisoformat(payload["project"]["calculated_finish"]) == analysis["finish"]
    assert payload["project"]["delay_minutes"] == analysis["delay_minutes"]
    assert payload["project"]["timezone"] == project.timezone
    rows = {row["id"]: row for row in analysis["tasks"]}
    assert payload["critical_tasks"]
    for task in payload["critical_tasks"]:
        assert rows[task["id"]]["critical"]
        assert task["slack_minutes"] == rows[task["id"]]["slack_minutes"]
        assert datetime.fromisoformat(task["finish"]) == rows[task["id"]]["finish"]
    architecture = next(item for item in payload["skills_mismatch"] if item["task_id"] == "2")
    assert architecture["missing_skills"] == ["Architecture"]
    assert architecture["status"] == "todo"
    assert "test-key-never-sent" not in captured["messages"][1]["content"]
    assert project.model_dump_json() == original
