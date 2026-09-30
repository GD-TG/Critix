import asyncio
from datetime import timedelta

import pytest
from pydantic import ValidationError

from app import ai, main
from app.engine.analysis import analyze, compare
from app.engine.recommendations import evaluate_recommendations
from app.schemas import Assignee, Calendar, Dependency, ProjectInput, Task
from test_engine import dt, project, rows


@pytest.mark.parametrize("factory", [
    lambda: Task(id="x", name=" \t", duration_minutes=60),
    lambda: Assignee(id="x", name="  "),
    lambda: ProjectInput(name="\n", start=dt(), deadline=dt(30)),
])
def test_blank_names_rejected(factory):
    with pytest.raises(ValidationError):
        factory()


def test_remaining_work_requires_unfinished_actual_start():
    for values in ({}, {"status": "in_progress"},
                   {"status": "done", "actual_start": dt(), "actual_finish": dt(21, 10)}):
        with pytest.raises(ValidationError):
            Task(id="a", name="A", duration_minutes=60, remaining_minutes=30, **values)
    assert Task(id="a", name=" A ", duration_minutes=60).name == "A"


def test_started_task_criticality_and_remaining_follow_personal_calendar():
    p = project(
        tasks=[Task(id="a", name="A", duration_minutes=480, remaining_minutes=120,
                    status="in_progress", actual_start=dt(), assignee_id="p"),
               Task(id="b", name="B", duration_minutes=60)],
        deps=[Dependency(predecessor_id="a", successor_id="b")],
        assignees=[Assignee(id="p", name="P", calendar=Calendar(exceptions={dt(22).date(): []}))],
    )
    result = analyze(p, as_of=dt(21, 17))
    r = rows(result)
    assert r["a"]["start"] == dt()
    assert r["a"]["finish"] == dt(23, 10)
    assert r["b"]["start"] == dt(23, 10)
    assert r["a"]["critical"] and r["a"]["slack_minutes"] == 0
    assert r["a"]["latest_start"] == dt()
    assert not result["forecast_stale"]
    assert len(result["critical_dependencies"]) == 1


@pytest.mark.parametrize("kind", ["FS", "SS", "FF", "SF"])
def test_remaining_work_respects_each_dependency_and_preserves_facts(kind):
    p = project(tasks=[Task(id="a", name="A", duration_minutes=480, remaining_minutes=120,
                            status="in_progress", actual_start=dt()),
                       Task(id="b", name="B", duration_minutes=60)],
                deps=[Dependency(predecessor_id="a", successor_id="b", kind=kind)])
    original = p.model_dump_json()
    r = rows(analyze(p, as_of=dt(21, 11)))
    assert r["a"]["start"] == dt()
    assert r["a"]["finish"] == dt(21, 13)
    left = r["a"]["start" if kind[0] == "S" else "finish"]
    right = r["b"]["start" if kind[1] == "S" else "finish"]
    assert right >= left
    assert p.model_dump_json() == original


def test_started_without_remaining_is_critical_if_current_unknown_if_stale():
    p = project(tasks=[Task(id="a", name="A", duration_minutes=480,
                            status="in_progress", actual_start=dt())])
    current = rows(analyze(p, as_of=dt(21, 10)))["a"]
    assert current["critical"] and current["criticality_known"]
    stale = analyze(p, as_of=dt(22))
    assert not rows(stale)["a"]["criticality_known"]
    assert stale["health"] == "stale" and stale["intervention_required"]


def test_remaining_work_does_not_book_already_elapsed_hours():
    p = project(assignees=[Assignee(id="p", name="P")])
    p.tasks[0] = Task(id="a", name="A", duration_minutes=480, remaining_minutes=60,
                       actual_start=dt(), status="in_progress", assignee_id="p")
    p.tasks[1].duration_minutes = 60
    p.tasks[1].assignee_id = "p"
    assert not analyze(p, as_of=dt(21, 15))["overloads"]


def test_status_and_resource_changes_have_separate_impacts():
    p = project(deps=[Dependency(predecessor_id="a", successor_id="b")])
    blocked = p.model_copy(deep=True)
    blocked.tasks[0].status = "blocked"
    before, after = analyze(p, as_of=dt()), analyze(blocked, as_of=dt())
    delta = compare(before, after, p, blocked)
    assert delta["changed_task_ids"] == []
    assert delta["date_changed_task_ids"] == []
    assert delta["edited_task_ids"] == ["a"]
    assert delta["risk_changed_task_ids"] == ["a"]
    assert delta["downstream_task_ids"] == ["b"]
    assert any(a["code"] == "blocked" for a in delta["new_alerts"])
    assert after["intervention_required"]
    assert compare(after, before, blocked, p)["resolved_alert_ids"] == ["blocked:a"]


def test_snapshot_identifies_inputs_and_clock():
    p = project()
    a = analyze(p, as_of=dt())
    assert a["snapshot_id"] == analyze(p, as_of=dt())["snapshot_id"]
    assert a["snapshot_id"] != analyze(p, as_of=dt(22))["snapshot_id"]
    p.tasks[0].name = "Changed"
    assert a["snapshot_id"] != analyze(p, as_of=dt())["snapshot_id"]


def test_verified_alternatives_report_tradeoff_without_mutation():
    p = project(assignees=[Assignee(id="p", name="P")])
    for t in p.tasks:
        t.assignee_id = "p"
    original = p.model_dump_json()
    result = evaluate_recommendations(p, as_of=dt())
    proposal = result["proposals"][0]
    assert proposal["verified"]
    assert proposal["overload_after_minutes"] == 0
    assert proposal["finish_gain_minutes"] < 0  # Do not claim leveling always accelerates.
    assert p.model_dump_json() == original
    assert proposal["analysis"]["as_of"] == result["analysis"]["as_of"]


def test_invalid_alternative_is_reported_and_other_alternatives_continue():
    p = project(deps=[Dependency(predecessor_id="a", successor_id="b")])
    cyclic = p.model_copy(deep=True)
    cyclic.dependencies.append(Dependency(predecessor_id="b", successor_id="a"))
    result = evaluate_recommendations(p, [cyclic, p], False, as_of=dt())
    assert not result["proposals"][0]["verified"]
    assert result["proposals"][1]["verified"]


def test_recommendation_cannot_gain_time_by_inventing_completed_work():
    p = project()
    candidate = p.model_copy(deep=True)
    candidate.tasks[0] = Task(id="a", name="A", duration_minutes=480, status="done",
                             actual_start=dt(), actual_finish=dt(21, 10))
    result = evaluate_recommendations(p, [candidate], False, as_of=dt())
    assert not result["proposals"][0]["verified"]
    assert "фактические" in result["proposals"][0]["error"]


@pytest.mark.parametrize("mode", ["unconfigured", "queue", "provider"])
def test_ai_fallback_is_useful_bounded_and_releases_semaphore(monkeypatch, mode):
    p = project()
    analysis = analyze(p, as_of=dt())
    analysis.update(version=7, scope="draft")
    monkeypatch.setattr(main, "configuration_error", lambda: "missing_model" if mode == "unconfigured" else None)
    monkeypatch.setattr(main, "AI_QUEUE_SECONDS", 0.01)
    monkeypatch.setattr(main, "AI_RESPONSE_SECONDS", 0.01)

    async def hung(*args):
        await asyncio.Event().wait()

    monkeypatch.setattr(main, "chat", hung)

    async def run():
        semaphore = asyncio.Semaphore(0 if mode == "queue" else 1)
        monkeypatch.setattr(main, "ai_concurrency", semaphore)
        result = await main.ai_response(p, analysis, [{"role": "user", "content": "Что проверить?"}])
        assert result["source"] == "engine" and not result["available"]
        assert "Расчётный финиш" in result["reply"]
        assert result["context"]["version"] == 7
        assert result["context"]["snapshot_id"] == analysis["snapshot_id"]
        if mode != "queue":
            await asyncio.wait_for(semaphore.acquire(), timeout=0.1)
            semaphore.release()

    asyncio.run(run())


def test_configuration_does_not_silently_choose_provider(monkeypatch):
    monkeypatch.setenv("LLM_API_KEY", "not-a-real-key")
    monkeypatch.setenv("LLM_MODEL", "")
    assert ai.configuration_error() == "missing_model"
    monkeypatch.setenv("LLM_MODEL", "test")
    monkeypatch.delenv("LLM_BASE_URL", raising=False)
    assert ai.configuration_error() == "missing_base_url"
