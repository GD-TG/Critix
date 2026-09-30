"""Actionable, deterministic warnings derived from the calculated snapshot."""


def summarize_attention(project, analysis):
    tasks = {t.id: t for t in project.tasks}
    alerts = []

    def add(key, severity, code, ids, reason, action):
        alerts.append(dict(id=key, severity=severity, code=code, task_ids=ids,
                           reason=reason, action=action))

    if analysis["forecast_stale"] and analysis["stale_task_ids"]:
        add("forecast_stale", "high", "forecast_stale", analysis["stale_task_ids"],
            "Есть незавершённые задачи с финишем в прошлом; прогноз требует актуализации",
            "Уточнить фактическое выполнение и остаток работы начатых задач")
    for delivery in analysis.get("deliveries", []):
        if not delivery["affected_task_ids"]:
            continue
        if not delivery["forecast_known"]:
            add(f"delivery_unknown:{delivery['id']}", "high", "delivery_date_unknown", delivery["affected_task_ids"],
                f"{delivery['name']}: дата повторной передачи или сдачи неизвестна; срок выпуска не определён",
                "Получить у подрядчика ожидаемую дату передачи")
        elif delivery["awaiting_acceptance"]:
            add(f"delivery_acceptance:{delivery['id']}", "high" if delivery["status"] == "rework" else "medium",
                "awaiting_delivery_acceptance", delivery["affected_task_ids"],
                f"{delivery['name']}: результат ещё не принят; даты зависимых работ условны",
                "Провести приёмку или согласовать повторную передачу")
    if analysis["deadline_exceeded"]:
        add("deadline", "high", "deadline_exceeded", [r["id"] for r in analysis["tasks"] if r["critical"]],
            f"Расчётный финиш позже дедлайна на {analysis['delay_minutes']} календарных минут",
            "Проверить вариант решения через симуляцию")
    rules = {
        "blocked": ("high", "Задача заблокирована; длительность блокировки неизвестна", "Уточнить причину и ожидаемую дату возобновления"),
        "dependency_conflict": ("high", "Даты задачи противоречат зависимости или ограничению", "Проверить фактические даты и связи"),
        "past_deadline": ("high", "Задача заканчивается после дедлайна проекта", "Проверить последствия изменения задачи"),
        "overdue": ("high", "Плановый финиш прошёл, задача не завершена", "Уточнить статус и остаток работы"),
    }
    for row in analysis["tasks"]:
        task = tasks[row["id"]]
        for flag in row["risk_flags"]:
            if flag in rules and (task.status != "done" or flag == "dependency_conflict"):
                severity, reason, action = rules[flag]
                add(f"{flag}:{task.id}", severity, flag, [task.id], reason, action)
        if row["critical"] and task.status != "done":
            add(f"critical:{task.id}", "medium", "critical", [task.id],
                "Рабочий резерв равен нулю", "Контролировать остаток работы и зависимости")
    for person in sorted({o["assignee_id"] for o in analysis["overloads"]}):
        periods = [o for o in analysis["overloads"] if o["assignee_id"] == person]
        add(f"overload:{person}", "medium", "overload", sorted({k for o in periods for k in o["task_ids"]}),
            f"Пиковая загрузка исполнителя {person}: {max(o['allocation_percent'] for o in periods)}%",
            "Проверить ресурсное выравнивание и его влияние на сроки")
    severity_order = {"high": 0, "medium": 1}
    priority_order = {"urgent": 0, "high": 1, "medium": 2, "low": 3}
    alerts.sort(key=lambda a: (severity_order[a["severity"]],
                              min((priority_order[tasks[k].priority] for k in a["task_ids"]), default=-1), a["id"]))
    high = any(a["severity"] == "high" for a in alerts)
    return dict(attention=alerts, intervention_required=high,
                health="stale" if analysis["forecast_stale"] else "intervention" if high else "attention" if alerts else "ok")
