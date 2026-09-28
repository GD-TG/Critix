from datetime import date

import pytest

from app.engine.analysis import analyze
from app.schemas import Assignee, Calendar, Dependency, Task
from test_engine import dt, project, rows


@pytest.mark.parametrize("kind,lag", [("FS", 0), ("SS", 120), ("FF", 120), ("SF", 600), ("FS", -120)])
def test_driving_dependency_is_evidence_for_the_computed_start(kind, lag):
    p = project(deps=[Dependency(predecessor_id="a", successor_id="b", kind=kind, lag_minutes=lag)])
    row = rows(analyze(p))["b"]
    reason = next(c for c in row["explanation"]["constraints"] if c["source"] == "dependency")
    assert reason["driving"]
    assert reason["candidate_start"] == row["start"]
    assert reason["dependency"]["kind"] == kind
    assert not reason["violated"]


def test_tied_constraints_and_personal_calendar_are_preserved():
    p = project(tasks=[Task(id="a", name="A", duration_minutes=60, not_before=dt(22), assignee_id="p")],
                assignees=[Assignee(id="p", name="P", calendar=Calendar(exceptions={date(2026, 9, 21): [], date(2026, 9, 22): []}))])
    row = rows(analyze(p))["a"]
    assert row["start"] == dt(23)
    reasons = row["explanation"]["constraints"]
    assert len(reasons) == 2
    assert all(c["driving"] and c["calendar_adjusted"] for c in reasons)


def test_nonbinding_finish_constraint_is_not_presented_as_a_cause():
    p = project(tasks=[Task(id="a", name="A", duration_minutes=60), Task(id="b", name="B", duration_minutes=480)],
                deps=[Dependency(predecessor_id="a", successor_id="b", kind="FF")])
    reasons = rows(analyze(p))["b"]["explanation"]["constraints"]
    assert reasons[0]["driving"]
    assert not reasons[1]["driving"]


def test_actual_dates_explain_conflict_without_claiming_to_schedule_facts():
    p = project(tasks=[Task(id="a", name="A", duration_minutes=60, status="done", actual_start=dt(), actual_finish=dt(21, 10), not_before=dt(22))])
    row = rows(analyze(p))["a"]
    assert row["start"] == dt()
    assert row["explanation"]["mode"] == "actual"
    assert row["explanation"]["actual_finish"] == dt(21, 10)
    reasons = row["explanation"]["constraints"]
    assert not any(c["driving"] for c in reasons)
    assert reasons[1]["violated"]


def test_elapsed_lag_weekend_and_milestone():
    p = project(tasks=[Task(id="a", name="A", duration_minutes=0, not_before=dt(25, 18)), Task(id="b", name="B", duration_minutes=0)],
                deps=[Dependency(predecessor_id="a", successor_id="b", lag_minutes=60, lag_mode="elapsed")])
    result = rows(analyze(p))
    reason = result["b"]["explanation"]["constraints"][1]
    assert reason["bound"] == dt(28, 10)
    assert reason["driving"]
    assert result["b"]["start"] == result["b"]["finish"] == dt(28, 10)
