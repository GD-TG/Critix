from datetime import datetime, timezone

from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy import delete, select

from app import models
from app.engine.analysis import analyze, compare
from app.schemas import ProjectInput


def load(db, project_id, lock=False):
    query = select(models.Project).where(models.Project.id == project_id)
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


def write(db, row, data, result):
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
                        analysis=jsonable_encoder(result)))
    db.commit()
    return dict(id=row.id, version=row.version, project=data, analysis=result)


def create(db, data):
    result = analyze(data)
    return write(db, models.Project(version=1), data, result)


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
    return {**write(db, row, request.project, after), "changes": delta}


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
