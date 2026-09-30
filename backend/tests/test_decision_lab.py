from datetime import date

import pytest
from pydantic import ValidationError
from fastapi.testclient import TestClient

from app.engine.decision_lab import DecisionCase, evaluate


def case(**patch):
    return DecisionCase.model_validate(dict(
        title="Запуск", start="2026-10-01", supplier_due="2026-10-08", deadline="2026-10-15",
        delay_days=4, review_days=1, stress_days=14, extra_expense=50000,
        loss_per_day=30000, penalty_per_day=10000, penalty_cap=100000, phase_expense=25000,
        outcomes=[dict(id="core", name="Заказы", required=True, days=2),
                  dict(id="report", name="Отчётность", required=False, days=6),
                  dict(id="support", name="Поддержка", required=True, needs_supplier=False, days=5)],
        **patch))


def test_full_minimum_phased_and_cost_breakdown():
    source = case()
    original = source.model_dump_json()
    full, minimum, phased = evaluate(source)["variants"]
    assert full["launch"] == date(2026, 10, 19)
    assert full["costs"]["total"] == 210000
    assert minimum["launch"] == date(2026, 10, 15)
    assert minimum["costs"]["total"] == 50000
    assert minimum["excluded"] == ["Отчётность"]
    assert phased["second_release"] == full["launch"]
    assert phased["deferred"] == ["Отчётность"]
    assert phased["costs"]["total"] == 75000
    assert minimum["tolerance_days"] == 0
    assert full["tolerance_days"] is None
    assert full["stress"][-1]["total"] == 50000 + 100000 + 18 * 30000
    assert source.model_dump_json() == original


def test_independent_results_are_insensitive_and_all_required_has_one_choice():
    raw = case().model_dump()
    raw["outcomes"] = [dict(id="a", name="Независимый результат", required=True, needs_supplier=False, days=2)]
    result = evaluate(DecisionCase.model_validate(raw))["variants"]
    assert len(result) == 1
    assert result[0]["tolerance_at_least"]
    assert result[0]["tolerance_days"] == 14
    assert len({s["launch"] for s in result[0]["stress"]}) == 1


@pytest.mark.parametrize("patch", [dict(stress_days=31), dict(extra_expense=-1), dict(start="9999-01-01"), dict(supplier_due="2026-10-20"), dict(title="  ")])
def test_invalid_assumptions_rejected(patch):
    raw = {**case().model_dump(), **patch}
    with pytest.raises(ValidationError):
        DecisionCase.model_validate(raw)


def test_requires_mandatory_result_and_unique_ids():
    raw = case().model_dump()
    for o in raw["outcomes"]:
        o["required"] = False
    with pytest.raises(ValidationError):
        DecisionCase.model_validate(raw)
    raw = case().model_dump()
    raw["outcomes"][1]["id"] = "core"
    with pytest.raises(ValidationError):
        DecisionCase.model_validate(raw)


def test_endpoint_auth_validation_and_json():
    from app import main
    client = TestClient(main.app)
    headers = {"X-Critix-Request": "1"}
    payload = case().model_dump(mode="json")
    assert client.post("/api/decision-lab/evaluate", headers=headers, json=payload).status_code == 401
    main.app.dependency_overrides[main.current_user] = lambda: object()
    main.app.dependency_overrides[main.authenticated] = lambda: None
    try:
        response = client.post("/api/decision-lab/evaluate", headers=headers, json=payload)
        assert response.status_code == 200, response.text
        assert response.json()["variants"][0]["launch"] == "2026-10-19"
        assert client.post("/api/decision-lab/evaluate", headers=headers, json={**payload, "stress_days": 31}).status_code == 422
    finally:
        main.app.dependency_overrides.pop(main.current_user, None)
        main.app.dependency_overrides.pop(main.authenticated, None)
