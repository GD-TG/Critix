from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from pydantic import ValidationError

from app.demo import delivery_demo
from app.engine.analysis import analyze
from app.engine.calendar import PlanningError
from app.engine.delivery_events import apply_event, preview_event
from app.schemas import DeliveryEvent, ProjectInput

CLOCK = datetime(2026, 10, 1, 12, tzinfo=ZoneInfo("Asia/Yekaterinburg"))


def event(kind="delay", **kwargs):
    return DeliveryEvent(version=1, delivery_id="payment-api", kind=kind,
                         reason="Уточнённые условия подрядчика", **kwargs)


def test_delay_and_scope_alternative_are_calculated_not_hardcoded():
    p = delivery_demo(CLOCK)
    original = p.model_dump_json()
    result = preview_event(p, event(expected_at=p.deliveries[0].expected_at + timedelta(days=1)), as_of=CLOCK)
    full, reduced = result["variants"]
    assert result["before"]["finish"].astimezone(CLOCK.tzinfo).day == 9
    assert full["impact"]["finish_after"].astimezone(CLOCK.tzinfo).day == 12
    assert reduced["impact"]["finish_after"] == result["before"]["finish"]
    assert full["impact"]["deadline_exceeded"]
    assert not reduced["impact"]["deadline_exceeded"]
    assert reduced["project"].deferred_task_ids == ["report"]
    assert len(reduced["project"].tasks) == 8  # Scope deferral never deletes work.
    assert full["project"].deliveries[0].promised_at == p.deliveries[0].promised_at
    assert {r["id"] for r in full["impact"]["moved_tasks"]} >= {"integration", "qa", "launch"}
    assert "docs" in full["impact"]["unaffected_task_ids"]
    assert any(c["task_id"] == "qa" and c["path"] == ["API оплаты", "Интеграция оплаты", "Проверка оплаты"] for c in full["impact"]["chains"])
    assert p.model_dump_json() == original


def test_no_date_means_unknown_finish_not_fake_ontime_result():
    p = delivery_demo(CLOCK)
    full = preview_event(p, event(), as_of=CLOCK)["variants"][0]
    assert full["analysis"]["forecast_finish"] is None
    assert not full["analysis"]["forecast_complete"]
    assert full["impact"]["finish_after"] is None
    assert full["impact"]["finish_delta_minutes"] is None
    assert full["impact"]["deadline_exceeded"] is None
    assert {"integration", "qa", "launch"} <= set(full["impact"]["unknown_task_ids"])
    assert full["analysis"]["intervention_required"]


def test_delivery_is_not_acceptance_and_rework_blocks_execution():
    p = delivery_demo(CLOCK)
    submitted, _ = apply_event(p, event("submit", occurred_at=CLOCK), as_of=CLOCK)
    result = preview_event(submitted, event("reject", expected_at=CLOCK + timedelta(days=5)), as_of=CLOCK)
    rework = result["variants"][0]["project"]
    assert rework.deliveries[0].status == "rework"
    assert rework.deliveries[0].accepted_at is None
    for plan in (submitted, rework):
        raw = plan.model_dump()
        task = next(t for t in raw["tasks"] if t["id"] == "integration")
        task.update(status="in_progress", actual_start=CLOCK)
        with pytest.raises(ValidationError, match="приёмки"):
            ProjectInput.model_validate(raw)
    accepted, _ = apply_event(submitted, event("accept", occurred_at=CLOCK), as_of=CLOCK)
    raw = accepted.model_dump()
    task = next(t for t in raw["tasks"] if t["id"] == "integration")
    task.update(status="in_progress", actual_start=CLOCK)
    ProjectInput.model_validate(raw)
    assert not analyze(accepted, as_of=CLOCK)["forecast_conditional"]


def test_expired_expected_acceptance_requires_updated_forecast():
    p = delivery_demo(CLOCK)
    result = analyze(p, as_of=CLOCK + timedelta(days=7))
    assert not result["forecast_complete"]
    assert result["forecast_finish"] is None


@pytest.mark.parametrize("kind", ["reject", "accept"])
def test_waiting_delivery_cannot_be_accepted_or_rejected_without_handover(kind):
    with pytest.raises(PlanningError, match="недопустимо"):
        apply_event(delivery_demo(CLOCK), event(kind), as_of=CLOCK)


def test_accepted_delivery_is_terminal_and_future_facts_rejected():
    p, _ = apply_event(delivery_demo(CLOCK), event("submit", occurred_at=CLOCK), as_of=CLOCK)
    p, _ = apply_event(p, event("accept", occurred_at=CLOCK), as_of=CLOCK)
    with pytest.raises(PlanningError):
        apply_event(p, event(), as_of=CLOCK)
    with pytest.raises(PlanningError, match="будущего"):
        apply_event(delivery_demo(CLOCK), event("submit", occurred_at=CLOCK + timedelta(days=1)), as_of=CLOCK)


def test_scope_cut_cannot_remove_required_or_started_work():
    p = delivery_demo(CLOCK)
    raw = p.model_dump()
    raw["deferred_task_ids"] = ["integration"]
    with pytest.raises(ValidationError, match="необязательные"):
        ProjectInput.model_validate(raw)
    raw = p.model_dump()
    raw["optional_task_ids"] = ["integration"]
    raw["deferred_task_ids"] = ["integration"]
    with pytest.raises(ValidationError, match="зависит работа"):
        ProjectInput.model_validate(raw)


def test_unknown_delivery_and_blank_event_reason_are_rejected():
    with pytest.raises(ValidationError):
        DeliveryEvent(version=1, delivery_id="payment-api", kind="delay", reason="  ")
    p = delivery_demo(CLOCK).model_dump()
    p["deliveries"][0]["dependent_task_ids"] = ["foreign"]
    with pytest.raises(ValidationError):
        ProjectInput.model_validate(p)
