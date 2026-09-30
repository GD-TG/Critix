"""Translate external handovers into release constraints, without supplier calendars."""
from collections import defaultdict
from datetime import timedelta


def descendants(project, roots):
    outgoing = defaultdict(list)
    deferred = set(project.deferred_task_ids)
    for dep in project.dependencies:
        if dep.predecessor_id not in deferred and dep.successor_id not in deferred:
            outgoing[dep.predecessor_id].append(dep.successor_id)
    visited = set()
    pending = [key for key in roots if key not in deferred]
    while pending:
        key = pending.pop()
        if key in visited:
            continue
        visited.add(key)
        pending.extend(outgoing[key])
    return visited


def prepare_deliveries(project):
    """Keep all facts in the source; calculate only the current release."""
    planned = project.model_copy(deep=True)
    deferred = set(project.deferred_task_ids)
    planned.tasks = [t for t in planned.tasks if t.id not in deferred]
    planned.dependencies = [d for d in planned.dependencies if d.predecessor_id not in deferred and d.successor_id not in deferred]
    tasks = {t.id: t for t in planned.tasks}
    reports = []
    for delivery in project.deliveries:
        affected = descendants(project, delivery.dependent_task_ids)
        if delivery.status == "accepted":
            ready_at = delivery.accepted_at
        else:
            anchor = delivery.delivered_at if delivery.status == "delivered" else delivery.expected_at
            ready_at = anchor + timedelta(days=delivery.review_days) if anchor else None
        for key in delivery.dependent_task_ids:
            if key in tasks and ready_at is not None:
                task = tasks[key]
                task.not_before = max(task.not_before or ready_at, ready_at)
        reports.append(dict(
            id=delivery.id, name=delivery.name, contractor=delivery.contractor, status=delivery.status,
            promised_at=delivery.promised_at, expected_at=delivery.expected_at,
            expected_ready_at=ready_at, affected_task_ids=sorted(affected),
            awaiting_acceptance=delivery.status != "accepted" and bool(affected),
            forecast_known=ready_at is not None or not affected,
            assumption=("Фактическая приёмка подтверждена" if delivery.status == "accepted" else
                        f"Условный прогноз: результат пройдёт приёмку за {delivery.review_days} календарных дней; факт приёмки ещё не подтверждён"),
        ))
    return planned, reports


def enrich_delivery_analysis(source, analysis, reports):
    for report in reports:
        if report["awaiting_acceptance"] and report["expected_ready_at"] is not None and report["expected_ready_at"] < analysis["as_of"]:
            report["forecast_known"] = False
            report["assumption"] = "Ожидаемый срок приёмки прошёл, результат не принят; нужна новая оценка"
    unknown = {key for r in reports if not r["forecast_known"] for key in r["affected_task_ids"]}
    waiting = {key for r in reports if r["awaiting_acceptance"] for key in r["affected_task_ids"]}
    for row in analysis["tasks"]:
        if row["id"] in waiting:
            row["risk_flags"] = sorted(set(row["risk_flags"]) | {"awaiting_delivery_acceptance"})
        if row["id"] in unknown:
            row["risk_flags"] = sorted(set(row["risk_flags"]) | {"delivery_date_unknown"})
            row["criticality_known"] = False
            row["critical"] = False
            row["slack_minutes"] = None
        row["forecast_known"] = row["id"] not in unknown
    analysis.update(deliveries=reports, deferred_task_ids=list(source.deferred_task_ids),
                    forecast_complete=not unknown,
                    forecast_finish=None if unknown else analysis["finish"],
                    forecast_conditional=bool(waiting),
                    unknown_task_ids=sorted(unknown))
    if unknown:
        analysis["forecast_stale"] = True
        analysis["critical_dependencies"] = [d for d in analysis["critical_dependencies"]
                                              if d["predecessor_id"] not in unknown and d["successor_id"] not in unknown]
    return analysis
