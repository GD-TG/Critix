from datetime import datetime, timezone

from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy import delete, select

from app import models
from app.engine.analysis import analyze, compare
from app.schemas import ProjectInput


def load(db, project_id, lock=False):
    query = select(models.Project).where(models.Project.id == project_id)
    if lock:
        query = query.with_for_update()
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


def update(db, project_id, request, simulate=False):
    row = load(db, project_id, lock=True)
    if row.version != request.version:
        raise HTTPException(409, "Проект изменён в другой вкладке. Обновите данные")
    old_project = snapshot(db, row)
    before = analyze(old_project)
    after = analyze(request.project)
    delta = compare(before, after, old_project, request.project)
    if simulate:
        return dict(id=row.id, version=row.version, project=request.project, analysis=after, changes=delta)
    row.version += 1
    return {**write(db, row, request.project, after), "changes": delta}
