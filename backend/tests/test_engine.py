from datetime import datetime, date, time, timedelta
from zoneinfo import ZoneInfo

import pytest
from pydantic import ValidationError

from app.engine.analysis import analyze, compare
from app.engine.calendar import PlanningError, WorkCalendar
from app.schemas import Assignee, Calendar, Dependency, ProjectInput, Shift, Task

ZONE = ZoneInfo("Asia/Yekaterinburg")


def dt(day=21, hour=9, minute=0):
    return datetime(2026, 9, day, hour, minute, tzinfo=ZONE)


def project(tasks=None, deps=None, **kwargs):
    return ProjectInput(name="Тест", start=dt(), deadline=dt(30, 18),
                        tasks=tasks or [Task(id="a", name="A", duration_minutes=480),
                                        Task(id="b", name="B", duration_minutes=480)],
                        dependencies=deps or [], **kwargs)


def rows(result):
    return {r["id"]: r for r in result["tasks"]}


def test_milestone_is_instantaneous_and_has_no_resource_load():
    p = project(tasks=[Task(id="a", name="Milestone", duration_minutes=0, assignee_id="p")],
                assignees=[Assignee(id="p", name="P")])
    result = analyze(p)
    assert result["tasks"][0]["start"] == result["tasks"][0]["finish"] == dt()
    assert result["tasks"][0]["slack_minutes"] == 0
    assert not result["overloads"]
    p.tasks[0] = Task(id="a", name="Done milestone", duration_minutes=0, status="done", actual_start=dt(), actual_finish=dt())
    assert analyze(p)["finish"] == dt()
    with pytest.raises(ValidationError):
        Task(id="a", name="Regular", duration_minutes=1, status="done", actual_start=dt(), actual_finish=dt())


def test_overdue_is_clock_explicit_and_baseline_delta_is_elapsed():
    p = project()
    before = analyze(p, as_of=dt())
    assert all("overdue" not in t["risk_flags"] for t in before["tasks"])
    later = analyze(p, as_of=dt(22))
    assert all("overdue" in t["risk_flags"] for t in later["tasks"])
    assert before["finish"] == later["finish"]
    p.baseline = {"saved_at": dt().isoformat(), "finish": dt(20, 18).isoformat(), "tasks": {}}
    assert analyze(p, as_of=dt())["baseline_delta_minutes"] == 24 * 60


def test_invalid_baseline_rejected():
    with pytest.raises(ValidationError):
        project(baseline={"finish": "not a date"})


@pytest.mark.parametrize("kind,lag,expected", [("FS", 0, dt(22)), ("SS", 120, dt(21, 11)),
    ("FF", 0, dt()), ("SF", 480, dt()), ("FS", -120, dt(21, 16))])
def test_dependency_types(kind, lag, expected):
    result = analyze(project(deps=[Dependency(predecessor_id="a", successor_id="b", kind=kind, lag_minutes=lag)]))
    assert rows(result)["b"]["start"] == expected


def test_cascade_slack_and_deadline():
    p = project(tasks=[Task(id="a", name="A", duration_minutes=480), Task(id="b", name="B", duration_minutes=480),
                       Task(id="c", name="C", duration_minutes=60)],
                deps=[Dependency(predecessor_id="a", successor_id="b")])
    result = rows(analyze(p))
    assert result["a"]["slack_minutes"] == result["b"]["slack_minutes"] == 0
    assert result["c"]["slack_minutes"] == 900
    p.tasks[0].duration_minutes += 480
    assert rows(analyze(p))["b"]["finish"] == dt(23, 18)


def test_cycle_rejected():
    with pytest.raises(PlanningError, match="цикл"):
        analyze(project(deps=[Dependency(predecessor_id="a", successor_id="b"),
                              Dependency(predecessor_id="b", successor_id="a")]))


def test_vacation_and_calendar_intersection():
    personal = Calendar(week={0: [Shift(start=time(10), end=time(16))],
                              1: [Shift(start=time(10), end=time(16))],
                              2: [Shift(start=time(10), end=time(16))]}, exceptions={date(2026, 9, 22): []})
    p = project(tasks=[Task(id="a", name="A", duration_minutes=360, assignee_id="p")],
                assignees=[Assignee(id="p", name="P", calendar=personal)])
    row = rows(analyze(p))["a"]
    assert row["start"] == dt(21, 10)
    assert row["finish"] == dt(23, 11)


def test_overload_respects_allocation_and_lunch():
    p = project(assignees=[Assignee(id="p", name="P")])
    for task in p.tasks:
        task.assignee_id = "p"
        task.allocation_percent = 50
    assert not analyze(p)["overloads"]
    p.tasks[0].allocation_percent = 60
    result = analyze(p)
    assert len(result["overloads"]) == 2
    assert result["overloads"][0]["finish"] == dt(21, 13)
    assert result["overloads"][1]["start"] == dt(21, 14)


def test_actual_dates_are_not_moved():
    p = project(deps=[Dependency(predecessor_id="a", successor_id="b")])
    p.tasks[1] = Task(id="b", name="B", duration_minutes=480, status="done", actual_start=dt(), actual_finish=dt(21, 18))
    row = rows(analyze(p))["b"]
    assert row["start"] == dt()
    assert "dependency_conflict" in row["risk_flags"]
    assert row["slack_minutes"] is None


def test_elapsed_and_working_lags_differ():
    p = project(deps=[Dependency(predecessor_id="a", successor_id="b", lag_minutes=120, lag_mode="elapsed")])
    assert rows(analyze(p))["b"]["start"] == dt(22)
    p.dependencies[0].lag_mode = "working"
    assert rows(analyze(p))["b"]["start"] == dt(22, 11)


def test_dst_real_hours():
    zone = ZoneInfo("Europe/Berlin")
    cal = Calendar(week={6: [Shift(start=time(1), end=time(4))]})
    work = WorkCalendar([cal], "Europe/Berlin", datetime(2026, 10, 25, tzinfo=zone), datetime(2026, 10, 26, tzinfo=zone))
    assert len(work.slots) == 240


def test_invalid_foreign_task_and_naive_date():
    with pytest.raises(ValidationError):
        project(deps=[Dependency(predecessor_id="a", successor_id="foreign")])
    with pytest.raises(ValidationError):
        Task(id="x", name="X", duration_minutes=60, not_before=datetime(2026, 1, 1))


def test_no_common_work_is_error():
    with pytest.raises(PlanningError):
        analyze(project(calendar=Calendar(week={})))


def test_finish_constraint_and_critical_link_across_night():
    p = project(deps=[Dependency(predecessor_id="a", successor_id="b", kind="FF")])
    p.tasks[1].duration_minutes = 120
    result = analyze(p)
    assert rows(result)["b"]["start"] == dt(21, 16)
    p.dependencies[0].kind = "FS"
    assert len(analyze(p)["critical_dependencies"]) == 1


def test_downstream_is_distinct_from_date_changes():
    p = project(deps=[Dependency(predecessor_id="a", successor_id="b")])
    modified = p.model_copy(deep=True)
    modified.tasks[0].name = "Переименовано"
    before = analyze(p)
    delta = compare(before, before, p, modified)
    assert delta["downstream_task_ids"] == ["b"]
    assert delta["changed_task_ids"] == []


def test_unfinished_past_schedule_is_marked_stale_without_invented_new_dates():
    p = project()
    p.tasks = [Task(id="a", name="Still running", duration_minutes=60,
                    status="in_progress", actual_start=p.start)]
    p.dependencies = []
    result = analyze(p, as_of=p.start + timedelta(days=3))
    assert result["forecast_stale"]
    assert result["finish"] == p.start + timedelta(hours=1)
    assert result["tasks"][0]["slack_minutes"] is None


def test_compact_calendar_preserves_spring_gap_and_slice_order():
    zone = ZoneInfo("Europe/Berlin")
    cal = Calendar(week={6: [Shift(start=time(1), end=time(4))]})
    work = WorkCalendar([cal], "Europe/Berlin", datetime(2026, 3, 29, tzinfo=zone), datetime(2026, 3, 30, tzinfo=zone))
    assert len(work.slots) == 120
    assert work.slots[59].astimezone(zone).hour == 1
    assert work.slots[60].astimezone(zone).hour == 3
    assert work.slots[59:61] == [work.slots[59], work.slots[60]]
    assert work.index(work.slots[60]) == 60
    with pytest.raises(ValidationError):
        Shift(start=time(9, 0, 0, 1), end=time(10))
