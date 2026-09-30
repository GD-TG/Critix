"""Decision evidence from Critix calendars, resource leveling and explicit alternatives.

No guessed productivity gains, altered facts or LLM-generated scheduling inputs.
"""
from app.engine.analysis import analyze, compare
from app.engine.calendar import CalculationBudget, PlanningError, ResourceLimitError
from app.engine.leveling import level_resources


def overload_minutes(analysis):
    """Excess allocation weighted by elapsed minutes: 200% for 60m = 60m."""
    return round(sum((p["finish"] - p["start"]).total_seconds() / 60 *
                     (p["allocation_percent"] - 100) / 100 for p in analysis["overloads"]), 2)


def evaluate_recommendations(project, alternatives=(), include_leveling=True, *, as_of):
    budget = CalculationBudget()
    base = analyze(project, as_of=as_of, budget=budget)
    proposals = []
    limited = False

    def evaluate(key, title, candidate, result, assumptions):
        delta = compare(base, result, project, candidate)
        base_high = {a["id"] for a in base["attention"] if a["severity"] == "high"}
        introduced = [a for a in result["attention"] if a["severity"] == "high" and a["id"] not in base_high]
        proposals.append(dict(
            id=key, title=title, project=candidate, analysis=result, changes=delta,
            finish_gain_minutes=-delta["finish_delta_minutes"],
            overload_before_minutes=overload_minutes(base), overload_after_minutes=overload_minutes(result),
            new_high_alerts=introduced, assumptions=assumptions,
            requires_review=True, verified=True,
        ))

    if include_leveling and base["overloads"]:
        try:
            candidate, result, report = level_resources(project, as_of=as_of, budget=budget)
            if report["moved_task_ids"]:
                evaluate("resource-leveling", "Выравнивание загрузки по календарям", candidate, result,
                         ["Меняются только ограничения начала неначатых задач",
                          "Длительности, зависимости и фактические даты сохранены",
                          "Эвристика может отодвинуть финиш; проверьте последствия"])
        except ResourceLimitError:
            limited = True
        except PlanningError:
            proposals.append(dict(id="resource-leveling", verified=False, error="Не удалось построить допустимое выравнивание"))
    for index, candidate in enumerate(alternatives):
        if limited:
            break
        try:
            old_tasks = {t.id: t for t in project.tasks}
            next_tasks = {t.id: t for t in candidate.tasks}
            for task_id in old_tasks.keys() | next_tasks.keys():
                old, new = old_tasks.get(task_id), next_tasks.get(task_id)
                old_facts = (old.actual_start, old.actual_finish) if old else (None, None)
                new_facts = (new.actual_start, new.actual_finish) if new else (None, None)
                if old_facts != new_facts or (old and old.status == "done" and (not new or new.status != "done")):
                    raise PlanningError("Вариант решения не должен изменять фактические даты или удалять выполненную работу")
            result = analyze(candidate, as_of=as_of, budget=budget)
            evaluate(f"alternative-{index + 1}", f"Предложенный вариант {index + 1}", candidate, result,
                     ["Параметры варианта заданы пользователем; выполнимость оценок требует подтверждения",
                      "Сравнение выполнено в один момент времени с исходным планом"])
        except ResourceLimitError:
            limited = True
        except PlanningError as exc:
            proposals.append(dict(id=f"alternative-{index + 1}", verified=False, error=str(exc)))
    return dict(source="engine", analysis=base, proposals=proposals, limited=limited,
                evaluated_alternatives=sum(p["id"].startswith("alternative-") for p in proposals),
                actions=base["attention"][:3],
                units=dict(finish_gain_minutes="elapsed_minutes", overload_minutes="excess_allocation_minutes"),
                limitations=["Результат условен относительно введённых оценок и календарей",
                             "Блокировка без даты возобновления не задаёт величину задержки",
                             "LLM не изменяет граф и не рассчитывает эффект решения"])
