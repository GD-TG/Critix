from datetime import date, datetime, time
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Shift(StrictModel):
    start: time
    end: time

    @model_validator(mode="after")
    def ordered(self):
        if self.start >= self.end or self.start.second or self.end.second:
            raise ValueError("Смена должна заканчиваться позже начала, с точностью до минуты")
        if self.start.tzinfo or self.end.tzinfo:
            raise ValueError("Время смены задаётся в часовом поясе проекта")
        return self


class Calendar(StrictModel):
    week: dict[int, list[Shift]] = Field(default_factory=lambda: {
        day: [Shift(start=time(9), end=time(13)), Shift(start=time(14), end=time(18))]
        for day in range(5)
    })
    exceptions: dict[date, list[Shift]] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_shifts(self):
        if any(day not in range(7) for day in self.week):
            raise ValueError("День недели должен быть от 0 до 6")
        for shifts in [*self.week.values(), *self.exceptions.values()]:
            ordered = sorted(shifts, key=lambda s: s.start)
            if any(a.end > b.start for a, b in zip(ordered, ordered[1:])):
                raise ValueError("Смены не должны пересекаться")
        return self


class Skill(StrictModel):
    name: str = Field(min_length=1, max_length=64)
    level: Literal["beginner", "intermediate", "advanced", "expert"] = "intermediate"


class Assignee(StrictModel):
    id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=120)
    skills: list[Skill] = Field(default_factory=list)
    calendar: Calendar = Field(default_factory=Calendar)


class Task(StrictModel):
    id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=200)
    duration_minutes: int = Field(gt=0, le=525600)
    priority: Literal["low", "medium", "high", "urgent"] = "medium"
    required_skills: list[str] = Field(default_factory=list)
    not_before: datetime | None = None
    assignee_id: str | None = None
    allocation_percent: int = Field(default=100, ge=1, le=100)
    status: Literal["todo", "in_progress", "done", "blocked"] = "todo"
    actual_start: datetime | None = None
    actual_finish: datetime | None = None

    @model_validator(mode="after")
    def actual_dates(self):
        for value in [self.not_before, self.actual_start, self.actual_finish]:
            if value and (value.tzinfo is None or value.second or value.microsecond):
                raise ValueError("Дата должна содержать часовой пояс и иметь точность до минуты")
        if self.status == "done" and not (self.actual_start and self.actual_finish):
            raise ValueError("Завершённой задаче нужны фактические начало и окончание")
        if self.status == "in_progress" and not self.actual_start:
            raise ValueError("Начатой задаче нужно фактическое начало")
        if self.actual_finish and self.status != "done":
            raise ValueError("Фактическое окончание допустимо только для завершённой задачи")
        if self.actual_start and self.status not in ("done", "in_progress", "blocked"):
            raise ValueError("Фактическое начало несовместимо со статусом")
        if self.actual_start and self.actual_finish and self.actual_finish <= self.actual_start:
            raise ValueError("Фактическое окончание должно быть позже начала")
        return self


class Dependency(StrictModel):
    predecessor_id: str
    successor_id: str
    kind: Literal["FS", "SS", "FF", "SF"] = "FS"
    lag_minutes: int = Field(default=0, ge=-525600, le=525600)
    lag_mode: Literal["working", "elapsed"] = "working"


class ProjectInput(StrictModel):
    name: str = Field(min_length=1, max_length=200)
    timezone: str = "Asia/Yekaterinburg"
    start: datetime
    deadline: datetime
    baseline: dict | None = None
    calendar: Calendar = Field(default_factory=Calendar)
    assignees: list[Assignee] = Field(default_factory=list, max_length=100)
    tasks: list[Task] = Field(default_factory=list, max_length=200)
    dependencies: list[Dependency] = Field(default_factory=list, max_length=2000)

    @field_validator("timezone")
    @classmethod
    def valid_zone(cls, value):
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as exc:
            raise ValueError("Неизвестный часовой пояс") from exc
        return value

    @model_validator(mode="after")
    def valid_project(self):
        for value in (self.start, self.deadline):
            if value.tzinfo is None or value.second or value.microsecond:
                raise ValueError("Укажите часовой пояс и точность до минуты")
        if self.deadline <= self.start:
            raise ValueError("Дедлайн должен быть позже начала")
        if (self.deadline - self.start).days > 366:
            raise ValueError("Горизонт проекта ограничен одним годом")
        ids = {t.id for t in self.tasks}
        people = {a.id for a in self.assignees}
        if len(ids) != len(self.tasks) or len(people) != len(self.assignees):
            raise ValueError("Идентификаторы должны быть уникальными")
        if any(t.assignee_id is not None and t.assignee_id not in people for t in self.tasks):
            raise ValueError("Исполнитель не принадлежит проекту")
        seen = set()
        for dep in self.dependencies:
            pair = (dep.predecessor_id, dep.successor_id)
            if pair[0] not in ids or pair[1] not in ids or pair[0] == pair[1]:
                raise ValueError("Некорректные участники зависимости")
            if pair in seen:
                raise ValueError("Повторная зависимость между задачами")
            seen.add(pair)
        return self


class SaveProject(StrictModel):
    version: int = Field(ge=1)
    project: ProjectInput
