"""Bounded deterministic resource leveling; proposals never change dependencies/facts."""
from datetime import datetime, timezone

from app.engine.analysis import analyze
from app.engine.calendar import PlanningError


def level_resources(project, assignee_id=None, max_iterations=32):
    candidate = project.model_copy(deep=True)
    if assignee_id and assignee_id not in {p.id for p in project.assignees}:
        raise PlanningError("Исполнитель не принадлежит проекту")
    clock = datetime.now(timezone.utc)
    cache = {}
    result = analyze(candidate, as_of=clock, calendar_cache=cache)
    before = result
    moved = set()
    priorities = {"low": 0, "medium": 1, "high": 2, "urgent": 3}
    iterations = 0
    for _ in range(max_iterations):
        tasks = {t.id: t for t in candidate.tasks}
        rows = {r["id"]: r for r in result["tasks"]}
        proposal = None
        for period in sorted(result["overloads"], key=lambda o: (o["start"], o["assignee_id"])):
            if assignee_id and period["assignee_id"] != assignee_id:
                continue
            movable = [tasks[k] for k in period["task_ids"]
                       if not tasks[k].actual_start and tasks[k].status != "done"]
            # Move lower priority/noncritical work first; IDs make ties reproducible.
            movable.sort(key=lambda t: (rows[t.id]["critical"], priorities[t.priority], t.id))
            if movable:
                task = movable[0]
                bound = min(rows[k]["finish"] for k in period["task_ids"] if k != task.id)
                proposal = (task, max(bound, task.not_before or bound))
                break
        if proposal is None:
            break
        task, bound = proposal
        old = task.not_before
        task.not_before = bound
        try:
            recalculated = analyze(candidate, as_of=clock, calendar_cache=cache)
        except PlanningError:
            task.not_before = old
            break
        old_conflicts = {r["id"] for r in result["tasks"] if "dependency_conflict" in r["risk_flags"]}
        new_conflicts = {r["id"] for r in recalculated["tasks"] if "dependency_conflict" in r["risk_flags"]}
        if new_conflicts - old_conflicts:
            task.not_before = old
            break
        result = recalculated
        moved.add(task.id)
        iterations += 1
    remaining = [o for o in result["overloads"] if not assignee_id or o["assignee_id"] == assignee_id]
    return candidate, result, {
        "moved_task_ids": sorted(moved), "iterations": iterations,
        "before_periods": len([o for o in before["overloads"] if not assignee_id or o["assignee_id"] == assignee_id]),
        "remaining_periods": len(remaining),
        "complete": not remaining,
        "message": ("Перегрузки выбранной области устранены в расчёте. Проверьте сроки и примените черновик."
                    if not remaining else "Часть перегрузок осталась: проверьте фактические даты, назначения и ограничения. Это ограниченная эвристика, не оптимальный план."),
    }
