from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy import delete, func, select
from pydantic import ValidationError
from app.engine.calendar import PlanningError

from app import models
from app.engine.analysis import analyze, compare
from app.schemas import ProjectInput
 
MAX_SCENARIOS_PER_PROJECT = 20


def load(db, project_id, lock=False):
    owner_id = db.info.get("owner_id")
    if owner_id is not None:
        condition = (models.Project.id == project_id) & (models.Project.owner_id == owner_id)
    else:
        condition = (models.Project.id == project_id) & (models.Project.owner_id.is_(None))
    query = select(models.Project).where(condition)
    query = query.with_for_update(read=not lock).execution_options(populate_existing=True)
    row = db.scalar(query)
    if row is None:
        raise HTTPException(404, "Проект не найден")
    return row


def snapshot(db, row):
    def children(model, fields):
        return [{key: getattr(item, key) for key in fields}
                for item in db.scalars(select(model).where(model.project_id == row.id))]
    return ProjectInput(
        name=row.name, timezone=row.timezone, start=row.start, deadline=row.deadline,
        baseline=row.baseline,
        calendar=row.calendar,
        assignees=children(models.Assignee, ["id", "name", "role", "skills", "calendar"]),
        tasks=children(models.Task, ["id", "name", "duration_minutes", "priority", "required_skills", "not_before", "assignee_id",
                                    "allocation_percent", "status", "actual_start", "actual_finish"]),
        dependencies=children(models.Dependency, ["predecessor_id", "successor_id", "kind", "lag_minutes", "lag_mode"]),
    )


def delete_project(db, project_id):
    row = load(db, project_id, lock=True)
    db.delete(row)
    db.commit()
    return {"ok": True}


def write(db, row, data, result, comment=None):
    for field in ("name", "timezone", "start", "deadline", "baseline"):
        setattr(row, field, getattr(data, field, None))
    row.calendar = data.calendar.model_dump(mode="json")
    db.add(row)
    db.flush()
    # Replace the project aggregate atomically under its row lock.
    for model in (models.Dependency, models.Task, models.Assignee):
        db.execute(delete(model).where(model.project_id == row.id))
    for person in data.assignees:
        db.add(models.Assignee(project_id=row.id, **person.model_dump(mode="json")))
    db.flush()
    for task in data.tasks:
        db.add(models.Task(project_id=row.id, **task.model_dump()))
    db.flush()
    for dependency in data.dependencies:
        db.add(models.Dependency(project_id=row.id, **dependency.model_dump()))
    db.add(models.Change(project_id=row.id, version=row.version,
                        created_at=datetime.now(timezone.utc), snapshot=data.model_dump(mode="json"),
                        analysis=jsonable_encoder(result), comment=comment))
    db.commit()
    return dict(id=row.id, version=row.version, project=data, analysis=result)


from app.auth import hash_password, verify_password
from app.demo import demo


def create(db, data, owner_id=None):
    result = analyze(data)
    return write(db, models.Project(version=1, owner_id=owner_id), data, result)


def create_user(db, email: str, password: str, name: str):
    email = email.strip().lower()
    existing = db.scalar(select(models.User).where(models.User.email == email))
    if existing:
        raise HTTPException(400, "Пользователь с таким email уже зарегистрирован")
    user = models.User(
        email=email,
        hashed_password=hash_password(password),
        name=name.strip(),
        created_at=datetime.now(timezone.utc),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    create(db, demo(), owner_id=user.id)
    return user


def authenticate_user(db, email: str, password: str):
    email = email.strip().lower()
    user = db.scalar(select(models.User).where(models.User.email == email))
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def list_projects_for_user(db, user_id: UUID | None = None):
    projects = db.scalars(select(models.Project).where(
        models.Project.owner_id == user_id).order_by(models.Project.name)).all()
    return [dict(id=p.id, name=p.name, version=p.version) for p in projects]


def read(db, project_id):
    row = load(db, project_id)
    version = row.version
    data = snapshot(db, row)
    db.rollback()  # Release the aggregate read lock before CPU or external API work.
    return version, data


def require_version(db, project_id, version, lock=False):
    row = load(db, project_id, lock=lock)
    if row.version != version:
        raise HTTPException(409, "Проект изменён в другой вкладке. Обновите данные")
    return row


def update(db, project_id, request, simulate=False):
    version, old_project = read(db, project_id)
    if version != request.version:
        raise HTTPException(409, "Проект изменён в другой вкладке. Обновите данные")
    before = analyze(old_project)
    after = analyze(request.project)
    delta = compare(before, after, old_project, request.project)
    row = require_version(db, project_id, request.version, lock=not simulate)
    if simulate:
        result = dict(id=row.id, version=row.version, project=request.project, analysis=after, changes=delta)
        db.rollback()
        return result
    row.version += 1
    return {**write(db, row, request.project, after, comment=getattr(request, "comment", None)), "changes": delta}


def level(db, project_id, request):
    from app.engine.leveling import level_resources
    version, old = read(db, project_id)
    if version != request.version:
        raise HTTPException(409, "Проект изменён. Обновите данные перед выравниванием")
    proposal, result, report = level_resources(request.project, request.assignee_id)
    delta = compare(analyze(old), result, old, proposal)
    row = require_version(db, project_id, version)
    response = dict(id=row.id, version=row.version, project=proposal, analysis=result,
                    changes=delta, leveling=report)
    db.rollback()
    return response


def list_scenarios(db, project_id, limit: int = 20, offset: int = 0, include_analysis: bool = False):
    row = load(db, project_id)
    current_version = row.version
    db.rollback()

    scenarios = db.scalars(
        select(models.Scenario)
        .where(models.Scenario.project_id == project_id)
        .order_by(models.Scenario.created_at.desc())
        .offset(max(0, offset))
        .limit(max(1, min(limit, 20)))
    ).all()

    for item in scenarios:
        db.expunge(item)
    db.rollback()

    current_project = None
    current_analysis = None
    if include_analysis and scenarios:
        current_project = snapshot(db, row)
        db.rollback()
        current_analysis = analyze(current_project)

    result = []
    for s in scenarios:
        try:
            scenario_proj = ProjectInput(**s.snapshot)
        except (ValidationError, PlanningError, Exception):
            result.append(dict(id=s.id, project_id=s.project_id, name=s.name,
                               description=s.description, base_version=s.base_version,
                               is_stale=s.base_version != current_version, created_at=s.created_at,
                               error="Сценарий не прошёл проверку; удалите его и создайте новый"))
            continue

        item_data = {
            "id": s.id,
            "project_id": s.project_id,
            "name": s.name,
            "description": s.description,
            "base_version": s.base_version,
            "is_stale": s.base_version != current_version,
            "created_at": s.created_at,
            "project": scenario_proj,
        }

        if include_analysis and current_analysis and current_project:
            try:
                scenario_analysis = analyze(scenario_proj)
                delta = compare(current_analysis, scenario_analysis, current_project, scenario_proj)
                item_data["analysis"] = scenario_analysis
                item_data["changes"] = delta
            except (ValidationError, PlanningError):
                item_data["error"] = "Ошибка расчёта сценария"

        result.append(item_data)
    return result


def create_scenario(db, project_id, request):
    current_version, current_project = read(db, project_id)
    scenario_count = db.scalar(
        select(func.count()).select_from(models.Scenario).where(models.Scenario.project_id == project_id)
    )
    if scenario_count >= MAX_SCENARIOS_PER_PROJECT:
        raise HTTPException(
            400,
            f"Превышен лимит сценариев для проекта (максимум {MAX_SCENARIOS_PER_PROJECT}). "
            "Удалите устаревшие сценарии перед созданием нового.",
        )
    if request.base_version != current_version:
        raise HTTPException(409, "Проект изменён. Обновите данные перед сохранением сценария")
    current_analysis = analyze(current_project)
    scenario_analysis = analyze(request.project)
    delta = compare(current_analysis, scenario_analysis, current_project, request.project)
    require_version(db, project_id, current_version, lock=True)

    scenario_row = models.Scenario(
        project_id=project_id,
        name=request.name,
        description=request.description,
        base_version=request.base_version,
        snapshot=request.project.model_dump(mode="json"),
        created_at=datetime.now(timezone.utc),
    )
    db.add(scenario_row)
    db.commit()
    db.refresh(scenario_row)

    return {
        "id": scenario_row.id,
        "project_id": scenario_row.project_id,
        "name": scenario_row.name,
        "description": scenario_row.description,
        "base_version": scenario_row.base_version,
        "is_stale": scenario_row.base_version != current_version,
        "created_at": scenario_row.created_at,
        "project": request.project,
        "analysis": scenario_analysis,
        "changes": delta,
    }


def get_scenario(db, project_id, scenario_id: UUID):
    row = load(db, project_id)
    current_version = row.version
    current_project = snapshot(db, row)
    db.rollback()
    current_analysis = analyze(current_project)
    s = db.scalar(
        select(models.Scenario).where(
            models.Scenario.project_id == project_id,
            models.Scenario.id == scenario_id,
        )
    )
    if s is None:
        raise HTTPException(404, "Сценарий не найден")
    scenario_proj = ProjectInput(**s.snapshot)
    scenario_analysis = analyze(scenario_proj)
    delta = compare(current_analysis, scenario_analysis, current_project, scenario_proj)
    return {
        "id": s.id,
        "project_id": s.project_id,
        "name": s.name,
        "description": s.description,
        "base_version": s.base_version,
        "is_stale": s.base_version != current_version,
        "created_at": s.created_at,
        "project": scenario_proj,
        "analysis": scenario_analysis,
        "changes": delta,
    }


def delete_scenario(db, project_id, scenario_id: UUID):
    load(db, project_id, lock=True)
    scenario = db.scalar(
        select(models.Scenario).where(
            models.Scenario.project_id == project_id,
            models.Scenario.id == scenario_id,
        )
    )
    if scenario is None:
        raise HTTPException(404, "Сценарий не найден")
    db.delete(scenario)
    db.commit()
    return {"ok": True}


def get_history(db, project_id):
    load(db, project_id)
    changes = db.scalars(
        select(models.Change)
        .where(models.Change.project_id == project_id)
        .order_by(models.Change.version.desc())
        .limit(31)
    ).all()

    result = []
    for i, item in enumerate(changes[:30]):
        prev_item = changes[i + 1] if i + 1 < len(changes) else None
        changed_tasks = []
        finish_delta = 0

        if prev_item:
            cur_tasks_full = {t.get("id"): t for t in item.snapshot.get("tasks", []) if isinstance(t, dict)}
            prev_tasks_full = {t.get("id"): t for t in prev_item.snapshot.get("tasks", []) if isinstance(t, dict)}

            for tid, t in cur_tasks_full.items():
                if tid not in prev_tasks_full or t != prev_tasks_full[tid]:
                    changed_tasks.append(t.get("name", tid))
            for tid, t in prev_tasks_full.items():
                if tid not in cur_tasks_full:
                    changed_tasks.append(f"Удалена: {t.get('name', tid)}")

            cur_finish_str = item.analysis.get("finish")
            prev_finish_str = prev_item.analysis.get("finish")
            if cur_finish_str and prev_finish_str:
                try:
                    cur_f = datetime.fromisoformat(cur_finish_str)
                    prev_f = datetime.fromisoformat(prev_finish_str)
                    finish_delta = round((cur_f - prev_f).total_seconds() / 60)
                except Exception:
                    pass

        result.append({
            "version": item.version,
            "created_at": item.created_at,
            "finish": item.analysis.get("finish"),
            "comment": item.comment,
            "task_count": len(item.snapshot.get("tasks", [])),
            "changed_tasks": changed_tasks,
            "change_details": describe_changes(prev_item.snapshot, item.snapshot) if prev_item else ["Исходная версия; сравнение недоступно"],
            "finish_delta_minutes": finish_delta,
        })
    return result


def describe_changes(before, after):
    details = []
    for key, label in (("name", "Название проекта"), ("timezone", "Часовой пояс"),
                       ("start", "Начало проекта"), ("deadline", "Дедлайн"),
                       ("calendar", "Календарь проекта"), ("baseline", "Базовый план")):
        if before.get(key) != after.get(key):
            details.append(f"Изменено: {label}")
    for key, identity, label in (("tasks", lambda x: x["id"], "Задача"),
                                 ("assignees", lambda x: x["id"], "Участник"),
                                 ("dependencies", lambda x: (x["predecessor_id"], x["successor_id"]), "Связь")):
        old = {identity(x): x for x in before.get(key, [])}
        new = {identity(x): x for x in after.get(key, [])}
        for item_id in sorted(old.keys() | new.keys(), key=str):
            previous, current = old.get(item_id), new.get(item_id)
            if previous == current:
                continue
            value = current or previous
            name = value.get("name") or " → ".join(item_id)
            action = "Добавлено" if previous is None else "Удалено" if current is None else "Изменено"
            fields = [] if not previous or not current else [k for k in current.keys() | previous.keys() if current.get(k) != previous.get(k)]
            labels = {"calendar": "календарь", "skills": "навыки", "role": "роль", "name": "название",
                      "duration_minutes": "длительность", "assignee_id": "исполнитель", "status": "статус",
                      "allocation_percent": "загрузка", "not_before": "не раньше", "priority": "приоритет",
                      "required_skills": "требуемые навыки", "actual_start": "фактическое начало",
                      "actual_finish": "фактическое окончание", "kind": "тип", "lag_minutes": "лаг", "lag_mode": "шкала лага"}
            suffix = ": " + ", ".join(labels.get(k, k) for k in sorted(fields)) if fields else ""
            details.append(f"{action}: {label} «{name}»{suffix}")
    return details
