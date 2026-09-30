"""Human events -> immutable preview -> one explicit decision to apply."""
from datetime import timezone

from pydantic import ValidationError

from app.engine.analysis import analyze, compare
from app.engine.calendar import CalculationBudget, PlanningError
from app.engine.delivery_planning import descendants
from app.schemas import ProjectInput


EVENT_LABELS = {
    "delay": "Подрядчик переносит сдачу",
    "submit": "Результат передан на приёмку",
    "reject": "Результат возвращён на доработку",
    "accept": "Результат принят",
}
EVENT_ALLOWED = {
    "delay": {"waiting", "rework"}, "submit": {"waiting", "rework"},
    "reject": {"delivered"}, "accept": {"delivered"},
}


def event_catalog(project):
    return [dict(id=d.id, name=d.name, contractor=d.contractor, status=d.status,
                 actions=[dict(kind=kind, title=label,
                               asks_expected_date=kind in ("delay", "reject"),
                               unknown_date_allowed=kind in ("delay", "reject"))
                          for kind, label in EVENT_LABELS.items() if d.status in EVENT_ALLOWED[kind]])
            for d in project.deliveries]


def apply_event(project, event, *, as_of):
    candidate = project.model_copy(deep=True)
    delivery = next((d for d in candidate.deliveries if d.id == event.delivery_id), None)
    if delivery is None:
        raise PlanningError("Поставка не найдена в проекте")
    when = event.occurred_at or as_of.astimezone(timezone.utc).replace(second=0, microsecond=0)
    if when > as_of:
        raise PlanningError("Событие не может быть из будущего")
    if delivery.delivered_at and when < delivery.delivered_at:
        raise PlanningError("Событие не может предшествовать последней передаче результата")
    if delivery.status not in EVENT_ALLOWED[event.kind]:
        raise PlanningError(f"Событие «{EVENT_LABELS[event.kind]}» недопустимо для статуса {delivery.status}")
    if event.kind in ("delay", "reject"):
        if event.expected_at and event.expected_at < when:
            raise PlanningError("Новая ожидаемая дата не может быть раньше события")
        if event.kind == "delay" and event.expected_at and delivery.expected_at and event.expected_at < delivery.expected_at:
            raise PlanningError("Перенос сдачи должен быть не раньше прежней ожидаемой даты")
        delivery.expected_at = event.expected_at  # None explicitly means unknown, never an invented date.
    if event.kind == "submit":
        delivery.status, delivery.delivered_at = "delivered", when
    elif event.kind == "reject":
        delivery.status = "rework"
    elif event.kind == "accept":
        delivery.status, delivery.accepted_at = "accepted", when
    try:
        return ProjectInput.model_validate(candidate.model_dump()), when
    except ValidationError as exc:
        raise PlanningError("Событие противоречит фактическому выполнению или составу проекта") from exc


def describe_impact(before_project, before, candidate, after, delivery_id):
    delivery = next(d for d in candidate.deliveries if d.id == delivery_id)
    old_rows = {r["id"]: r for r in before["tasks"]}
    new_rows = {r["id"]: r for r in after["tasks"]}
    tasks = {t.id: t for t in candidate.tasks}
    delta = compare(before, after, before_project, candidate)
    touched = descendants(candidate, delivery.dependent_task_ids)
    moved = []
    for key in sorted(set(delta["date_changed_task_ids"]) & old_rows.keys() & new_rows.keys()):
        old, new = old_rows[key], new_rows[key]
        moved.append(dict(id=key, name=tasks[key].name,
                          before_start=old["start"] if old["forecast_known"] else None,
                          before_finish=old["finish"] if old["forecast_known"] else None,
                          after_start=new["start"] if new["forecast_known"] else None,
                          after_finish=new["finish"] if new["forecast_known"] else None))
    # Shortest actual dependency chain from this delivery to each affected task.
    paths = {key: [delivery.name, tasks[key].name] for key in delivery.dependent_task_ids if key in new_rows}
    pending = list(paths)
    outgoing = {}
    for dep in candidate.dependencies:
        if dep.predecessor_id in new_rows and dep.successor_id in new_rows:
            outgoing.setdefault(dep.predecessor_id, []).append(dep.successor_id)
    while pending:
        key = pending.pop(0)
        for child in outgoing.get(key, []):
            if child not in paths:
                paths[child] = [*paths[key], tasks[child].name]
                pending.append(child)
    known = after["forecast_complete"]
    finish_before = before["forecast_finish"]
    finish_after = after["forecast_finish"]
    delta_minutes = int((finish_after - finish_before).total_seconds() / 60) if finish_before and finish_after else None
    return dict(
        headline=("Срок выпуска неизвестен: нужна дата от подрядчика" if not known else
                  "Ожидаемый выпуск выходит за дедлайн" if after["deadline_exceeded"] else
                  "По текущим условиям выпуск укладывается в дедлайн"),
        finish_before=finish_before, finish_after=finish_after, finish_delta_minutes=delta_minutes,
        deadline=candidate.deadline, deadline_exceeded=after["deadline_exceeded"] if known else None,
        forecast_conditional=after["forecast_conditional"],
        moved_tasks=moved, affected_task_ids=sorted(touched),
        awaiting_acceptance_task_ids=sorted(touched) if delivery.status != "accepted" else [],
        unknown_task_ids=after["unknown_task_ids"],
        unaffected_task_ids=sorted(set(new_rows) - touched),
        deferred_tasks=[dict(id=k, name=tasks[k].name) for k in candidate.deferred_task_ids],
        chains=[dict(task_id=k, path=paths[k]) for k in sorted(paths)],
        assumptions=[r["assumption"] for r in after["deliveries"] if r["affected_task_ids"]],
        changes=delta,
    )


def preview_event(project, event, *, as_of):
    budget = CalculationBudget()
    before = analyze(project, as_of=as_of, budget=budget)
    candidate, when = apply_event(project, event, as_of=as_of)
    after = analyze(candidate, as_of=as_of, budget=budget)
    variants = [dict(id="accept_change", name="Сохранить полный объём и принять последствия",
                     project=candidate, analysis=after,
                     impact=describe_impact(project, before, candidate, after, event.delivery_id))]
    optional = set(candidate.optional_task_ids) - set(candidate.deferred_task_ids)
    if optional and event.kind in ("delay", "reject"):
        reduced = candidate.model_copy(deep=True)
        reduced.deferred_task_ids = sorted(set(reduced.deferred_task_ids) | optional)
        try:
            reduced = ProjectInput.model_validate(reduced.model_dump())
            result = analyze(reduced, as_of=as_of, budget=budget)
        except (ValidationError, PlanningError):
            # Not an admissible scope cut; do not present it as an available solution.
            pass
        else:
            variants.append(dict(id="defer_optional", name="Перенести необязательные работы в следующий выпуск",
                                 project=reduced, analysis=result,
                                 impact=describe_impact(project, before, reduced, result, event.delivery_id)))
    return dict(event={**event.model_dump(mode="json"), "occurred_at": when.isoformat(), "label": EVENT_LABELS[event.kind]},
                before=before, variants=variants, requires_confirmation=True)
