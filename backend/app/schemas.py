from datetime import date, datetime, time
from typing import Literal
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    @field_validator("name", mode="before", check_fields=False)
    @classmethod
    def trim_name(cls, value):
        return value.strip() if isinstance(value, str) else value


class Shift(StrictModel):
    start: time
    end: time

    @model_validator(mode="after")
    def ordered(self):
        if self.start >= self.end or self.start.second or self.end.second or self.start.microsecond or self.end.microsecond:
            raise ValueError("Смена должна заканчиваться позже начала, с точностью до минуты")
        if self.start.tzinfo or self.end.tzinfo:
            raise ValueError("Время смены задаётся в часовом поясе проекта")
        return self


class Calendar(StrictModel):
    week: dict[int, list[Shift]] = Field(default_factory=lambda: {
        day: [Shift(start=time(9), end=time(13)), Shift(start=time(14), end=time(18))]
        for day in range(5)
    })
    exceptions: dict[date, list[Shift]] = Field(default_factory=dict, max_length=1096)

    @model_validator(mode="after")
    def validate_shifts(self):
        if any(day not in range(7) for day in self.week):
            raise ValueError("День недели должен быть от 0 до 6")
        for shifts in [*self.week.values(), *self.exceptions.values()]:
            if len(shifts) > 16:
                raise ValueError("Допускается не более 16 смен в день")
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
    role: str | None = Field(default=None, max_length=120)
    skills: list[Skill] = Field(default_factory=list)
    calendar: Calendar = Field(default_factory=Calendar)


class Task(StrictModel):
    id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=200)
    duration_minutes: int = Field(ge=0, le=525600)
    remaining_minutes: int | None = Field(default=None, ge=0, le=525600)
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
        if self.remaining_minutes is not None and (not self.actual_start or self.status not in ("in_progress", "blocked")):
            raise ValueError("Остаток работы задаётся только для начатой незавершённой задачи")
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
        if self.actual_start and self.actual_finish and (self.actual_finish < self.actual_start or (self.actual_finish == self.actual_start and self.duration_minutes > 0)):
            raise ValueError("Окончание должно быть позже начала; равенство допустимо только для вехи")
        return self


class Dependency(StrictModel):
    predecessor_id: str
    successor_id: str
    kind: Literal["FS", "SS", "FF", "SF"] = "FS"
    lag_minutes: int = Field(default=0, ge=-525600, le=525600)
    lag_mode: Literal["working", "elapsed"] = "working"


class Delivery(StrictModel):
    id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=200)
    contractor: str = Field(min_length=1, max_length=200)
    promised_at: datetime
    expected_at: datetime | None = None
    review_days: int = Field(default=1, ge=0, le=30)
    status: Literal["waiting", "delivered", "rework", "accepted"] = "waiting"
    delivered_at: datetime | None = None
    accepted_at: datetime | None = None
    dependent_task_ids: list[str] = Field(min_length=1, max_length=200)

    @field_validator("contractor", mode="before")
    @classmethod
    def trim_contractor(cls, value):
        return value.strip() if isinstance(value, str) else value

    @model_validator(mode="after")
    def valid_delivery(self):
        for value in (self.promised_at, self.expected_at, self.delivered_at, self.accepted_at):
            if value and (value.tzinfo is None or value.second or value.microsecond):
                raise ValueError("Дата поставки должна содержать часовой пояс и точность до минуты")
        if len(set(self.dependent_task_ids)) != len(self.dependent_task_ids):
            raise ValueError("Задачи поставки не должны повторяться")
        if self.status in ("delivered", "rework", "accepted") and not self.delivered_at:
            raise ValueError("Укажите дату передачи результата")
        if self.status == "accepted" and not self.accepted_at:
            raise ValueError("Укажите дату приёмки результата")
        if self.accepted_at and (self.status != "accepted" or self.accepted_at < self.delivered_at):
            raise ValueError("Дата приёмки должна соответствовать принятому результату и быть не раньше передачи")
        if self.status == "waiting" and self.delivered_at:
            raise ValueError("Переданный результат должен иметь статус приёмки или доработки")
        return self


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
    deliveries: list[Delivery] = Field(default_factory=list, max_length=100)
    optional_task_ids: list[str] = Field(default_factory=list, max_length=200)
    deferred_task_ids: list[str] = Field(default_factory=list, max_length=200)

    @field_validator("baseline")
    @classmethod
    def valid_baseline(cls, value):
        if value is None:
            return value
        try:
            if set(value) != {"saved_at", "finish", "tasks"} or not isinstance(value["tasks"], dict):
                raise ValueError()
            if len(value["tasks"]) > 200:
                raise ValueError()
            dates = [value["saved_at"], value["finish"]]
            for key, row in value["tasks"].items():
                if not isinstance(key, str) or not isinstance(row, dict) or set(row) != {"start", "finish"}:
                    raise ValueError()
                dates.extend([row["start"], row["finish"]])
                if datetime.fromisoformat(row["finish"]) < datetime.fromisoformat(row["start"]):
                    raise ValueError()
            if any(datetime.fromisoformat(item).tzinfo is None for item in dates):
                raise ValueError()
        except (ValueError, TypeError, KeyError):
            raise ValueError("Некорректный базовый план: нужны даты с часовым поясом и интервалы задач")
        return value

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
        for values in (self.optional_task_ids, self.deferred_task_ids):
            if len(values) != len(set(values)) or not set(values) <= ids:
                raise ValueError("Состав выпуска содержит повторные или неизвестные задачи")
        deferred = set(self.deferred_task_ids)
        if not deferred <= set(self.optional_task_ids):
            raise ValueError("Переносить из выпуска можно только явно необязательные задачи")
        by_id = {t.id: t for t in self.tasks}
        if any(by_id[k].actual_start or by_id[k].status == "done" for k in deferred):
            raise ValueError("Начатую или выполненную работу нельзя исключать из выпуска")
        for dep in self.dependencies:
            if dep.predecessor_id in deferred and dep.successor_id not in deferred and by_id[dep.successor_id].duration_minutes != 0:
                raise ValueError("От отложенной задачи зависит работа текущего выпуска")
        if len({d.id for d in self.deliveries}) != len(self.deliveries):
            raise ValueError("Идентификаторы поставок должны быть уникальными")
        outgoing = {key: [] for key in ids}
        for dep in self.dependencies:
            outgoing[dep.predecessor_id].append(dep.successor_id)
        for delivery in self.deliveries:
            if not set(delivery.dependent_task_ids) <= ids:
                raise ValueError("Поставка ссылается на неизвестную задачу")
            pending = list(delivery.dependent_task_ids)
            visited = set()
            while pending:
                key = pending.pop()
                if key in visited or key in deferred:
                    continue
                visited.add(key)
                task = by_id[key]
                if task.actual_start and (delivery.status != "accepted" or task.actual_start < delivery.accepted_at):
                    raise ValueError("Работу, требующую поставку, нельзя начать до фактической приёмки результата")
                pending.extend(outgoing[key])
        return self


class DeliveryEvent(StrictModel):
    version: int = Field(ge=1)
    delivery_id: str = Field(min_length=1, max_length=64)
    kind: Literal["delay", "submit", "reject", "accept"]
    expected_at: datetime | None = None
    occurred_at: datetime | None = None
    reason: str = Field(min_length=1, max_length=512)

    @field_validator("reason", mode="before")
    @classmethod
    def trim_reason(cls, value):
        return value.strip() if isinstance(value, str) else value

    @model_validator(mode="after")
    def valid_dates(self):
        for value in (self.expected_at, self.occurred_at):
            if value and (value.tzinfo is None or value.second or value.microsecond):
                raise ValueError("Укажите часовой пояс и точность до минуты")
        if self.kind in ("submit", "accept") and self.expected_at is not None:
            raise ValueError("Фактическая передача или приёмка не меняет ожидаемую дату")
        return self


class ApplyDeliveryEvent(DeliveryEvent):
    decision: Literal["accept_change", "defer_optional"] = "accept_change"
    decision_owner: str = Field(min_length=1, max_length=200)

    @field_validator("decision_owner", mode="before")
    @classmethod
    def trim_owner(cls, value):
        return value.strip() if isinstance(value, str) else value


class SaveProject(StrictModel):
    version: int = Field(ge=1)
    project: ProjectInput
    comment: str | None = Field(default=None, max_length=512)


class RecommendationRequest(SaveProject):
    """Evaluate explicitly supplied alternatives; never invent durations or staff."""
    alternatives: list[ProjectInput] = Field(default_factory=list, max_length=3)
    include_leveling: bool = True


class LevelProject(SaveProject):
    assignee_id: str | None = None


class CreateScenario(StrictModel):
    name: str = Field(min_length=1, max_length=128)
    description: str | None = Field(default=None, max_length=512)
    base_version: int = Field(ge=1)
    project: ProjectInput


class ScenarioResponse(StrictModel):
    id: UUID
    project_id: UUID
    name: str
    description: str | None = None
    base_version: int
    is_stale: bool = False
    created_at: datetime
    project: ProjectInput
    analysis: dict | None = None
    changes: dict | None = None


class UserRegister(StrictModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=6, max_length=128)
    name: str = Field(min_length=1, max_length=255)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if " " in v or "@" not in v or v.count("@") != 1:
            raise ValueError("Некорректный формат email")
        local, domain = v.split("@")
        if not local or not domain or "." not in domain:
            raise ValueError("Некорректный формат email")
        domain_parts = domain.split(".")
        if any(not part for part in domain_parts) or len(domain_parts[-1]) < 2:
            raise ValueError("Некорректный формат email")
        return v


class UserLogin(StrictModel):
    email: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class UserResponse(StrictModel):
    id: UUID
    email: str
    name: str
    created_at: datetime

