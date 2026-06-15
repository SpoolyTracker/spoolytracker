from datetime import date, timedelta

import pytest
from fastapi import HTTPException

from src.api.routes.alerts import AlertsRequest, _collect_alerts, get_alerts
from src.forecasting.depletion import ForecastingService
from src.forecasting.models import AlertsResponse, ConsumptionSample, ProactiveAlert, RiskLevel
from src.security.plan import Plan, PlanContext
from src.tools.models import ProjectItem, ProjectMaterialRequirement, StockItem


def test_proactive_alert_minimal_fields() -> None:
    alert = ProactiveAlert(
        type="rupture",
        alert_key="rupture:fil-1",
        severity=RiskLevel.CRITICAL,
        title="Rupture imminente",
        message="Bientot vide.",
        data={"item_id": "fil-1"},
    )
    assert alert.alert_key == "rupture:fil-1"
    assert alert.severity == RiskLevel.CRITICAL


def test_alerts_response_defaults() -> None:
    response = AlertsResponse(alerts=[])
    assert response.plan == "pro"
    assert response.source == "mock_fallback"
    assert response.alerts == []


def _service() -> ForecastingService:
    today = date(2026, 5, 30)
    stock = [
        StockItem(id="pla-low", name="PLA noir", brand="Test", material="PLA",
                  color="noir", weight_initial_g=1000, weight_remaining_g=80),
        StockItem(id="petg-ok", name="PETG rouge", brand="Test", material="PETG",
                  color="rouge", weight_initial_g=1000, weight_remaining_g=900),
    ]
    history = [
        ConsumptionSample(item_id="pla-low", amount_g=40, occurred_on=today - timedelta(days=18)),
        ConsumptionSample(item_id="pla-low", amount_g=50, occurred_on=today - timedelta(days=12)),
        ConsumptionSample(item_id="pla-low", amount_g=45, occurred_on=today - timedelta(days=6)),
        ConsumptionSample(item_id="pla-low", amount_g=80, occurred_on=today - timedelta(days=1)),
    ]
    projects = [ProjectItem(id="proj-1", name="Projet", status="PLANNING",
                requirements=[ProjectMaterialRequirement(material="PLA", color="noir", required_g=500)])]
    return ForecastingService(stock_items=stock, history=history, projects=projects, today=today)


def test_alerts_refuses_free_plan() -> None:
    with pytest.raises(HTTPException) as exc:
        get_alerts(AlertsRequest(), plan=PlanContext(plan=Plan.FREE), context=None)
    assert exc.value.status_code == 403


def test_collect_alerts_returns_rupture_and_project_keys() -> None:
    alerts = _collect_alerts(_service(), ["rupture", "achat", "projet"])
    keys = {alert.alert_key for alert in alerts}
    types = {alert.type for alert in alerts}
    assert any(key.startswith("rupture:pla-low") for key in keys)
    assert "projet" in types
    assert all(":" in alert.alert_key for alert in alerts)


def test_collect_alerts_respects_type_filter() -> None:
    alerts = _collect_alerts(_service(), ["projet"])
    assert alerts
    assert {alert.type for alert in alerts} == {"projet"}
