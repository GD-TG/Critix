from datetime import datetime
from zoneinfo import ZoneInfo

from app.engine.leveling import level_resources
from app.schemas import ProjectInput, Task, Assignee, Dependency


def plan(fixed=False):
    start = datetime(2026, 9, 21, 9, tzinfo=ZoneInfo("Asia/Yekaterinburg"))
    return ProjectInput(name="Level", start=start, deadline=start.replace(day=30),
        assignees=[Assignee(id="p", name="P")],
        tasks=[Task(id=str(i), name=str(i), duration_minutes=60, assignee_id="p", allocation_percent=40,
                    status="in_progress" if fixed else "todo", actual_start=start if fixed else None) for i in range(3)])


def test_three_tasks_forty_percent_resolved_without_changing_graph_or_input():
    original = plan()
    snapshot = original.model_dump_json()
    proposal, result, report = level_resources(original)
    assert report["before_periods"] > 0
    assert report["complete"] and not result["overloads"]
    assert report["moved_task_ids"]
    assert proposal.dependencies == original.dependencies
    assert original.model_dump_json() == snapshot


def test_fixed_actual_starts_are_not_moved_and_unresolved_is_explicit():
    original = plan(fixed=True)
    proposal, result, report = level_resources(original)
    assert not report["complete"] and report["remaining_periods"] > 0
    assert not report["moved_task_ids"]
    assert proposal == original


def test_target_scope_and_iteration_limit_are_honest():
    original = plan()
    original.assignees.append(Assignee(id="other", name="Other"))
    _, result, report = level_resources(original, "other")
    assert report["complete"] and not report["moved_task_ids"]
    assert result["overloads"]  # Other workers are still reported in full analysis.
    _, _, report = level_resources(original, max_iterations=0)
    assert not report["complete"] and report["iterations"] == 0
