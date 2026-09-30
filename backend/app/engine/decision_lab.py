"""Transparent calendar-day scenarios for externally delivered outcomes."""
from datetime import date, timedelta
from pydantic import Field, model_validator, field_validator

from app.schemas import StrictModel


class Outcome(StrictModel):
    id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=160)
    required: bool = True
    needs_supplier: bool = True
    days: int = Field(ge=0, le=365)

    @field_validator("id", "name")
    @classmethod
    def trim(cls, value):
        if not value.strip():
            raise ValueError("Название не может быть пустым")
        return value.strip()


class DecisionCase(StrictModel):
    title: str = Field(min_length=1, max_length=160)
    start: date
    deadline: date
    supplier_due: date
    delay_days: int = Field(ge=0, le=365)
    review_days: int = Field(default=1, ge=0, le=30)
    stress_days: int = Field(default=14, ge=1, le=30)
    extra_expense: int = Field(default=0, ge=0, le=10**9)
    loss_per_day: int = Field(default=0, ge=0, le=10**9)
    penalty_per_day: int = Field(default=0, ge=0, le=10**9)
    penalty_cap: int = Field(default=0, ge=0, le=10**9)
    phase_expense: int = Field(default=0, ge=0, le=10**9)
    outcomes: list[Outcome] = Field(min_length=1, max_length=30)

    @model_validator(mode="after")
    def valid_case(self):
        if not self.title.strip():
            raise ValueError("Укажите название ситуации")
        if not 2000 <= self.start.year <= 2090 or not self.start <= self.supplier_due <= self.deadline:
            raise ValueError("Нужны даты: начало ≤ исходная поставка ≤ дедлайн; год начала 2000–2090")
        if (self.deadline - self.start).days > 730:
            raise ValueError("Горизонт сценария — не более двух лет")
        if len({o.id for o in self.outcomes}) != len(self.outcomes):
            raise ValueError("Идентификаторы результатов должны быть уникальны")
        if not any(o.required for o in self.outcomes):
            raise ValueError("Нужен хотя бы один обязательный результат")
        return self


def evaluate(case: DecisionCase):
    def dates(extra):
        ready = case.supplier_due + timedelta(days=case.delay_days + case.review_days + extra)
        return {o.id: (ready if o.needs_supplier else case.start) + timedelta(days=o.days)
                for o in case.outcomes}

    finishes = dates(0)
    variants = []
    modes = ["full"] + (["minimum", "phased"] if any(not o.required for o in case.outcomes) else [])
    for mode in modes:
        included = [o for o in case.outcomes if mode == "full" or o.required]
        excluded = [o for o in case.outcomes if o not in included]
        launch = max(finishes[o.id] for o in included)
        late = max(0, (launch - case.deadline).days)
        fixed = case.extra_expense + (case.phase_expense if mode == "phased" else 0)
        penalty = min(late * case.penalty_per_day, case.penalty_cap)
        loss = late * case.loss_per_day
        stress = []
        for extra in range(case.stress_days + 1):
            scenario = dates(extra)
            finish = max(scenario[o.id] for o in included)
            delay = max(0, (finish - case.deadline).days)
            stress.append(dict(extra_days=extra, launch=finish, on_time=delay == 0,
                               total=fixed + min(delay * case.penalty_per_day, case.penalty_cap) + delay * case.loss_per_day))
        safe = [s["extra_days"] for s in stress if s["on_time"]]
        variants.append(dict(
            id=mode, title={"full": "Полный результат", "minimum": "Минимальный запуск", "phased": "Поэтапный выпуск"}[mode],
            launch=launch, late_days=late, included=[o.name for o in included],
            deferred=[o.name for o in excluded] if mode == "phased" else [],
            excluded=[o.name for o in excluded] if mode == "minimum" else [],
            second_release=max(finishes.values()) if mode == "phased" else None,
            costs=dict(extra_expense=case.extra_expense, phase_expense=case.phase_expense if mode == "phased" else 0,
                       contractual_penalty=penalty, estimated_loss=loss, total=fixed + penalty + loss),
            tolerance_days=max(safe) if safe else None,
            tolerance_at_least=bool(safe and max(safe) == case.stress_days), stress=stress,
        ))
    return dict(currency="RUB", variants=variants,
                baseline_finish=max((case.supplier_due + timedelta(days=case.review_days) if o.needs_supplier else case.start)
                                    + timedelta(days=o.days) for o in case.outcomes),
                outcomes=[dict(id=o.id, name=o.name, finish=finishes[o.id]) for o in case.outcomes],
                assumptions=[
                    "Сроки указаны в календарных днях. Результаты выполняются параллельно, без конкуренции за ресурсы и зависимостей друг от друга.",
                    "Все результаты, зависящие от подрядчика, стартуют после поставки и приёмки. Длительности задаёт пользователь.",
                    "Штраф — расход вашей стороны за опоздание первого выпуска; ограничен указанным лимитом. Применимость к сокращённому выпуску нужно подтвердить.",
                    "Потери за день — ваша оценка для опоздания первого выпуска, а не доказанный убыток. Потери от исключённых возможностей не оценены.",
                    "Для поэтапного выпуска дополнительные результаты продолжаются параллельно. Расход повторного выпуска задаётся отдельно.",
                    "Проверка устойчивости меняет только задержку подрядчика. Это диапазон сценариев, не вероятность и не гарантия.",
                ])
