from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

from app.engine.calendar import MINUTE, PlanningError, WorkCalendar
from app.schemas import ProjectInput


def topology(project: ProjectInput):
    incoming = defaultdict(list)
    outgoing = defaultdict(list)
    counts = {t.id: 0 for t in project.tasks}
    for dep in project.dependencies:
        incoming[dep.successor_id].append(dep)
        outgoing[dep.predecessor_id].append(dep)
        counts[dep.successor_id] += 1
    queue = deque(sorted(t for t, count in counts.items() if count == 0))
    order = []
    while queue:
        task_id = queue.popleft()
        order.append(task_id)
        for dep in outgoing[task_id]:
            counts[dep.successor_id] -= 1
            if counts[dep.successor_id] == 0:
                queue.append(dep.successor_id)
    if len(order) != len(project.tasks):
        raise PlanningError("Зависимости образуют цикл")
    return order, incoming, outgoing


def analyze(project: ProjectInput, as_of=None, calendar_cache=None):
    # Time-dependent flags are deterministic for an explicitly supplied instant.
    as_of = as_of or datetime.now(timezone.utc)
    def baseline_delta(finish):
        return (int((finish - datetime.fromisoformat(project.baseline["finish"])).total_seconds() / 60)
                if project.baseline else None)
    order, incoming, outgoing = topology(project)
    if not order:
        return dict(tasks=[], finish=project.start, deadline=project.deadline,
                    deadline_exceeded=False, delay_minutes=0, overloads=[], critical_dependencies=[],
                    as_of=as_of, forecast_stale=False, baseline_delta_minutes=baseline_delta(project.start))
    tasks = {t.id: t for t in project.tasks}
    people = {a.id: a for a in project.assignees}
    all_starts = [project.start] + [t.actual_start for t in project.tasks if t.actual_start] + [t.not_before for t in project.tasks if t.not_before]
    all_finishes = [project.deadline] + [t.actual_finish for t in project.tasks if t.actual_finish]
    min_start = min(all_starts).astimezone(timezone.utc)
    max_target = max(all_finishes).astimezone(timezone.utc)
    total_dur_days = max(30, sum(t.duration_minutes for t in project.tasks) // 480 + 90)
    lower = min_start - timedelta(days=60)
    upper = max(max_target + timedelta(days=90), min_start + timedelta(days=total_dur_days + 180))
    calendars = {}
    definitions_cache = calendar_cache if calendar_cache is not None else {}
    # Share precomputed calendars across tasks assigned to the same person.
    for person in {t.assignee_id for t in project.tasks}:
        definitions = [project.calendar]
        if person is not None:
            definitions.append(people[person].calendar)
        key = (project.timezone, lower, upper, tuple(sorted({c.model_dump_json() for c in definitions})))
        if key not in definitions_cache:
            definitions_cache[key] = WorkCalendar(definitions, project.timezone, lower, upper)
        calendars[person] = definitions_cache[key]
    calendar = {t.id: calendars[t.assignee_id] for t in project.tasks}
    early, indices, flags = {}, {}, defaultdict(set)

    def shifted(dep, predecessor):
        anchor = predecessor[0 if dep.kind[0] == "S" else 1]
        if dep.lag_mode == "elapsed":
            return anchor + timedelta(minutes=dep.lag_minutes)
        return calendar[dep.successor_id].shift(anchor, dep.lag_minutes)

    def earliest_index(cal, duration, start_bound, finish_bound):
        lo, hi = cal.index(start_bound), len(cal.slots) - max(1, duration)
        if lo > hi or (finish_bound and cal.finish(hi, duration) < finish_bound):
            raise PlanningError("Недостаточно рабочего времени в горизонте расчёта")
        while lo < hi:
            mid = (lo + hi) // 2
            if finish_bound and cal.finish(mid, duration) < finish_bound:
                lo = mid + 1
            else:
                hi = mid
        return lo

    for task_id in order:
        task, cal = tasks[task_id], calendar[task_id]
        start_bound = max(project.start, task.not_before or project.start)
        finish_bound = None
        for dep in incoming[task_id]:
            bound = shifted(dep, early[dep.predecessor_id])
            if dep.kind[1] == "S":
                start_bound = max(start_bound, bound)
            else:
                finish_bound = max(finish_bound or bound, bound)
        if task.status == "done":
            pair = (task.actual_start, task.actual_finish)
            index = cal.index(task.actual_start)
        elif task.actual_start:
            index = cal.index(task.actual_start)
            pair = (task.actual_start, cal.finish(index, task.duration_minutes))
        else:
            index = earliest_index(cal, task.duration_minutes, start_bound, finish_bound)
            pair = (cal.start(index), cal.finish(index, task.duration_minutes))
        if pair[0] < start_bound or (finish_bound and pair[1] < finish_bound):
            flags[task_id].add("dependency_conflict")
        if task.status == "blocked":
            flags[task_id].add("blocked")
        early[task_id], indices[task_id] = pair, index

    finish = max(pair[1] for pair in early.values())
    latest, slack = {}, {}
    # Backward pass in working-slot coordinates. A monotone search handles
    # unequal calendars and both positive/negative working lags without
    # assuming that work-calendar addition is invertible at weekends.
    for task_id in reversed(order):
        task, cal = tasks[task_id], calendar[task_id]
        if task.actual_start:
            latest[task_id], slack[task_id] = early[task_id], None
            continue

        def feasible(index):
            pair = (cal.start(index), cal.finish(index, task.duration_minutes))
            if pair[1] > finish:
                return False
            for dep in outgoing[task_id]:
                target = latest[dep.successor_id][0 if dep.kind[1] == "S" else 1]
                try:
                    if shifted(dep, pair) > target:
                        return False
                except PlanningError:
                    return False
            return True

        lo = indices[task_id]
        hi = min(cal.index(finish), len(cal.slots) - max(1, task.duration_minutes))
        if not feasible(lo):
            flags[task_id].add("dependency_conflict")
        while lo < hi:
            mid = (lo + hi + 1) // 2
            if feasible(mid):
                lo = mid
            else:
                hi = mid - 1
        latest[task_id] = (cal.start(lo), cal.finish(lo, task.duration_minutes))
        slack[task_id] = lo - indices[task_id]

    events = defaultdict(lambda: defaultdict(list))
    for task_id in order:
        task, cal = tasks[task_id], calendar[task_id]
        if task.assignee_id is None or task.status == "done":
            continue
        start, end = early[task_id]
        slots = cal.slots[cal.index(start):cal.index(end)]
        if not slots:
            continue
        first = previous = slots[0]
        for current in slots[1:]:
            if current != previous + MINUTE:
                events[task.assignee_id][first].append((task_id, task.allocation_percent))
                events[task.assignee_id][previous + MINUTE].append((task_id, -task.allocation_percent))
                first = current
            previous = current
        events[task.assignee_id][first].append((task_id, task.allocation_percent))
        events[task.assignee_id][previous + MINUTE].append((task_id, -task.allocation_percent))
    overloads = []
    for person, timeline in events.items():
        active = {}
        points = sorted(timeline)
        for i, point in enumerate(points[:-1]):
            for task_id, delta in timeline[point]:
                active[task_id] = active.get(task_id, 0) + delta
                if active[task_id] == 0:
                    del active[task_id]
            if sum(active.values()) > 100:
                overloads.append(dict(assignee_id=person, start=point, finish=points[i+1],
                                      allocation_percent=sum(active.values()), task_ids=sorted(active)))
                for task_id in active:
                    flags[task_id].add("overload")
    rows = []
    for task_id in order:
        start, end = early[task_id]
        if tasks[task_id].status != "done" and end < as_of:
            flags[task_id].add("overdue")
        if end > project.deadline:
            flags[task_id].add("past_deadline")
        rows.append(dict(id=task_id, start=start, finish=end,
                         latest_start=latest[task_id][0], slack_minutes=slack[task_id],
                         critical=slack[task_id] == 0, risk_flags=sorted(flags[task_id])))
    critical = {r["id"] for r in rows if r["critical"]}
    critical_dependencies = []
    for dep in project.dependencies:
        if dep.predecessor_id not in critical or dep.successor_id not in critical:
            continue
        predecessor = tasks[dep.predecessor_id]
        cal = calendar[predecessor.id]
        index = indices[predecessor.id] + 1
        moved = (cal.start(index), cal.finish(index, predecessor.duration_minutes))
        if shifted(dep, moved) > early[dep.successor_id][0 if dep.kind[1] == "S" else 1]:
            critical_dependencies.append(dep.model_dump())
    return dict(tasks=rows, finish=finish, deadline=project.deadline,
                forecast_stale=any("overdue" in row["risk_flags"] for row in rows),
                as_of=as_of, baseline_delta_minutes=baseline_delta(finish),
                deadline_exceeded=finish > project.deadline,
                delay_minutes=max(0, int((finish-project.deadline).total_seconds()/60)),
                overloads=overloads, critical_dependencies=critical_dependencies)


def compare(before, after, old_project=None, new_project=None):
    previous = {t["id"]: t for t in before["tasks"]}
    changed = [t["id"] for t in after["tasks"] if t["id"] not in previous or
               any(t[key] != previous[t["id"]][key] for key in ("start", "finish"))]
    downstream = set()
    if old_project is not None and new_project is not None:
        old_tasks = {t.id: t.model_dump() for t in old_project.tasks}
        roots = {t.id for t in new_project.tasks if old_tasks.get(t.id) != t.model_dump()}
        roots.update(set(old_tasks) - {t.id for t in new_project.tasks})
        outgoing = defaultdict(set)
        for dep in [*old_project.dependencies, *new_project.dependencies]:
            outgoing[dep.predecessor_id].add(dep.successor_id)
        old_links = {d.model_dump_json() for d in old_project.dependencies}
        new_links = {d.model_dump_json() for d in new_project.dependencies}
        for dep in [*old_project.dependencies, *new_project.dependencies]:
            if dep.model_dump_json() in old_links ^ new_links:
                roots.add(dep.successor_id)
        queue = deque(roots)
        visited = set(roots)
        while queue:
            for child in outgoing[queue.popleft()]:
                downstream.add(child)
                if child not in visited:
                    visited.add(child)
                    queue.append(child)
    return dict(changed_task_ids=changed, downstream_task_ids=sorted(downstream), removed_task_ids=sorted(set(previous)-{t["id"] for t in after["tasks"]}),
                finish_delta_minutes=int((after["finish"]-before["finish"]).total_seconds()/60))
