"""Bound adversarial inputs without allocating adversarial amounts of memory."""
from datetime import datetime, timedelta, time, timezone

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app import main
from app.db import session
from app.engine import analysis, calendar, leveling
from app.engine.analysis import analyze
from app.engine.calendar import CalculationBudget, ResourceLimitError, WorkCalendar
from app.schemas import Assignee, Calendar, ProjectInput, Shift, Task


START = datetime(2026, 10, 5, 9, tzinfo=timezone.utc)


def project(tasks=None, **kwargs):
    return ProjectInput(name="Budget", timezone="UTC", start=START,
                        deadline=START + timedelta(days=20),
                        tasks=tasks or [Task(id="a", name="A", duration_minutes=60)], **kwargs)


@pytest.mark.parametrize("kind", ["durations", "early_fact", "late_fact", "far_not_before", "year1", "year9999"])
def test_extreme_horizon_rejected_before_calendar_allocation(monkeypatch, kind):
    p = project()
    if kind == "durations":
        p.tasks = [Task(id=str(i), name="A", duration_minutes=525600) for i in range(200)]
    elif kind in ("early_fact", "late_fact"):
        actual = START.replace(year=1900 if kind == "early_fact" else 2200)
        p.tasks = [Task(id="a", name="A", duration_minutes=60, status="done",
                        actual_start=actual, actual_finish=actual + timedelta(hours=1))]
    else:
        p.tasks[0].not_before = START.replace(year={"far_not_before": 2200, "year1": 1, "year9999": 9999}[kind])
    def forbidden(*args, **kwargs):
        pytest.fail("calendar allocation started before horizon validation")
    monkeypatch.setattr(analysis, "WorkCalendar", forbidden)
    with pytest.raises(ResourceLimitError):
        analyze(p)


def test_single_calendar_checks_limit_before_extending_grid():
    with pytest.raises(ResourceLimitError, match="бюджет календарей"):
        WorkCalendar([Calendar()], "UTC", START, START + timedelta(days=7), max_minutes=60)


def test_different_calendars_share_one_limit_and_cache_is_included(monkeypatch):
    first = Assignee(id="p", name="P")
    second = Assignee(id="q", name="Q", calendar=Calendar(week={0: [Shift(start=time(10), end=time(12))]}))
    p = project(tasks=[Task(id="a", name="A", duration_minutes=60, assignee_id="p")], assignees=[first, second])
    cache = {}
    analyze(p, calendar_cache=cache)
    retained = sum(len(c.slots) for c in cache.values())
    monkeypatch.setattr(analysis, "MAX_CALENDAR_MINUTES", retained)
    # Identical definitions remain reusable without charging them twice.
    analyze(p, calendar_cache=cache)
    p.tasks[0].assignee_id = "q"
    with pytest.raises(ResourceLimitError, match="бюджет календарей"):
        analyze(p, calendar_cache=cache)
    assert sum(len(c.slots) for c in cache.values()) == retained


def test_overload_processing_has_work_and_segment_budgets(monkeypatch):
    p = project(tasks=[Task(id="a", name="A", duration_minutes=480, assignee_id="p")],
                assignees=[Assignee(id="p", name="P")])
    monkeypatch.setattr(calendar, "MAX_WORK_MINUTES", 60)
    with pytest.raises(ResourceLimitError, match="рабочих минут"):
        analyze(p)
    monkeypatch.setattr(calendar, "MAX_WORK_MINUTES", 4_000_000)
    monkeypatch.setattr(analysis, "MAX_RESOURCE_SEGMENTS", 1)
    with pytest.raises(ResourceLimitError, match="рабочих интервалов"):
        analyze(p)  # Lunch splits an ordinary 480-minute workday.


def test_time_budget_and_leveling_do_not_return_partial_success(monkeypatch):
    budget = CalculationBudget()
    budget.deadline = -1
    with pytest.raises(ResourceLimitError, match="время"):
        analyze(project(), budget=budget)
    p = project(tasks=[Task(id=str(i), name="A", duration_minutes=60, assignee_id="p") for i in range(2)],
                assignees=[Assignee(id="p", name="P")])
    original = p.model_dump_json()
    calls = []
    def bounded(*args, **kwargs):
        calls.append(kwargs["budget"])
        if len(calls) > 1:
            raise ResourceLimitError("test limit")
        return analyze(*args, **kwargs)
    monkeypatch.setattr(leveling, "analyze", bounded)
    with pytest.raises(ResourceLimitError, match="test limit"):
        leveling.level_resources(p)
    assert calls[0] is calls[1]
    assert p.model_dump_json() == original


def test_normal_results_and_late_constraint_within_supported_horizon():
    p = project(tasks=[Task(id=str(i), name="A", duration_minutes=480) for i in range(10)])
    result = analyze(p, as_of=START)
    assert result["finish"] == START.replace(hour=18)
    assert all(row["slack_minutes"] == 0 for row in result["tasks"])
    p.tasks[0].not_before = START + timedelta(days=330)
    later = analyze(p, as_of=START)
    assert later["finish"] > p.deadline


def test_calendar_structure_is_bounded():
    shifts = [Shift(start=time(0, i * 2), end=time(0, i * 2 + 1)) for i in range(17)]
    with pytest.raises(ValidationError, match="16 смен"):
        Calendar(week={0: shifts})
    with pytest.raises(ValidationError):
        Calendar(exceptions={START.date() + timedelta(days=i): [] for i in range(1097)})


def test_public_demo_is_gone_without_accessing_database_or_setting_cookie():
    def forbidden_session():
        pytest.fail("disabled demo must not access the database")
        yield
    main.app.dependency_overrides[session] = forbidden_session
    try:
        client = TestClient(main.app)
        for _ in range(12):
            response = client.post("/api/auth/demo", headers={"X-Critix-Request": "1"})
            assert response.status_code == 410
            assert "set-cookie" not in response.headers
    finally:
        main.app.dependency_overrides.pop(session, None)


def test_resource_failure_is_422_before_create_writes(monkeypatch):
    main.app.dependency_overrides[main.project_session] = lambda: None
    main.app.dependency_overrides[main.current_user] = lambda: main.TransientAdmin()
    main.app.dependency_overrides[main.authenticated] = lambda: None
    try:
        p = project(tasks=[Task(id=str(i), name="A", duration_minutes=525600) for i in range(200)])
        response = TestClient(main.app).post("/api/projects", json=p.model_dump(mode="json"),
                                            headers={"X-Critix-Request": "1"})
        assert response.status_code == 422, response.text
        assert "Горизонт" in response.json()["detail"]
        # Failure must return both calculation permits, allowing subsequent work.
        assert main.calculation_slots.acquire(blocking=False)
        assert main.calculation_slots.acquire(blocking=False)
        main.calculation_slots.release()
        main.calculation_slots.release()
    finally:
        for dependency in (main.project_session, main.current_user, main.authenticated):
            main.app.dependency_overrides.pop(dependency, None)
