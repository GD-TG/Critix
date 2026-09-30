"""Generate a readable walkthrough and exact JSON using the production event engine.

Run: python -m app.delivery_walkthrough --output ../output/delivery-demo
No database writes or external requests.
"""
import argparse
import json
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from fastapi.encoders import jsonable_encoder

from app.demo import delivery_demo
from app.engine.delivery_events import apply_event, preview_event
from app.schemas import DeliveryEvent


def generate(output):
    clock = datetime(2026, 10, 1, 12, tzinfo=ZoneInfo("Asia/Yekaterinburg"))
    project = delivery_demo(clock)
    delay = DeliveryEvent(version=1, delivery_id="payment-api", kind="delay",
                          expected_at=project.deliveries[0].expected_at + timedelta(days=1),
                          reason="Подрядчик переносит передачу API на один день")
    delayed = preview_event(project, delay, as_of=clock)
    submitted, _ = apply_event(project, DeliveryEvent(version=1, delivery_id="payment-api", kind="submit",
                                                     occurred_at=clock, reason="API передано на приёмку"), as_of=clock)
    rejection = DeliveryEvent(version=2, delivery_id="payment-api", kind="reject",
                              reason="Проверка оплаты не пройдена, срок исправления пока неизвестен")
    rejected = preview_event(submitted, rejection, as_of=clock)
    output.mkdir(parents=True, exist_ok=True)
    payload = dict(as_of=clock, initial_project=project, delay_request=delay, delay_preview=delayed,
                   rejection_request=rejection, rejection_preview=rejected)
    (output / "results.json").write_text(json.dumps(jsonable_encoder(payload), ensure_ascii=False, indent=2), encoding="utf-8")
    fmt = lambda value: value.astimezone(clock.tzinfo).strftime("%d.%m.%Y %H:%M") if value else "Неизвестно"
    full, reduced = delayed["variants"]
    moved = "\n".join(f"| {t['name']} | {fmt(t['before_finish'])} | {fmt(t['after_finish'])} |" for t in full["impact"]["moved_tasks"])
    text = f"""# Что теперь делает Critix: пример на реальном расчёте

Это результат запуска backend, не макет. Данные учебные, момент расчёта фиксирован: {fmt(clock)} (Екатеринбург).

## Исходная ситуация

Запускаем пилот с оплатой. Внешний подрядчик должен передать API **5 октября**.
На приёмку выделен **один календарный день**. Затем команда выполняет интеграцию и проверку.
Дополнительный отчёт по платежам явно отмечен необязательным для первого выпуска.
Инструкция и подготовка поддержки идут независимо от API.

План запуска: **{fmt(delayed['before']['forecast_finish'])}**. Дедлайн: **{fmt(project.deadline)}**.
Внутренний рабочий график подрядчика не запрашивается.

## Случилось: подрядчик переносит API на 6 октября

Руководитель выбирает поставку, указывает новую дату и причину. Critix показывает:

| Вариант решения | Прогноз запуска | Последствие |
| --- | --- | --- |
| Сохранить полный объём | **{fmt(full['impact']['finish_after'])}** | Дедлайн нарушен |
| Дополнительный отчёт выпустить позже | **{fmt(reduced['impact']['finish_after'])}** | Дедлайн сохранён; отчёт исключается только из текущего выпуска |

Это не обещание ускорить подрядчика. Во втором варианте меняется согласуемый объём выпуска.
Задача отчёта остаётся в проекте. Фактическая приёмка API всё ещё обязательна.

### Почему изменился срок

API оплаты → Интеграция оплаты → Проверка оплаты → Запуск пилота.
Параллельная ветка: API оплаты → Дополнительный отчёт → Запуск пилота.

| Работа | Прежний финиш | Финиш после переноса API |
| --- | --- | --- |
{moved}

Прогноз условен: подрядчик соблюдёт новую дату, результат пройдёт приёмку за один календарный день.
Подготовку инструкции и поддержки можно продолжать.

## Случилось: переданное API не прошло приёмку

Отдельный кейс: результат передан, но проверка не пройдена. Руководитель возвращает его на доработку.
Если подрядчик ещё не назвал новую дату, Critix отвечает:

> {rejected['variants'][0]['impact']['headline']}.

Прогноз запуска: **{fmt(rejected['variants'][0]['impact']['finish_after'])}**.
Зависимые работы остаются закрыты до фактической приёмки.
API отклонит попытку отметить интеграцию начатой до принятия результата.
Повторная передача и успешная приёмка — отдельные события.

## Что сохраняется после выбора

До применения события — только предпросмотр. При применении сохраняются исходное событие,
причина, выбранный вариант, указанный ответственный за решение, пользователь,
который его записал, и рассчитанные последствия. Версия проекта увеличивается.
Указание ответственного не выдаётся за подтверждённое внешнее согласование.

Интерфейс приложения не изменён. Для подключения есть готовые API и полный JSON расчётов рядом с этим файлом.
"""
    (output / "walkthrough.md").write_text(text, encoding="utf-8")
    return output / "walkthrough.md"


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("../output/delivery-demo"))
    print(generate(parser.parse_args().output).resolve())
