import asyncio
from datetime import date, timedelta

import pytest
from fastapi import HTTPException

from src.api.routes.chat import chat
from src.api.routes.forecast import (
    forecast_stock,
    forecast_stock_item,
    notification_proposals,
    risks,
)
from src.api.schemas import ChatRequest
from src.forecasting.depletion import ForecastingService
from src.forecasting.factory import ForecastingServiceFactory
from src.forecasting.models import ConsumptionSample, RiskLevel
from src.security.plan import Plan, PlanContext
from src.tools.models import ProjectItem, ProjectMaterialRequirement, StockItem


def _service() -> ForecastingService:
    today = date(2026, 5, 30)
    stock = [
        StockItem(
            id="pla-low",
            name="PLA noir test",
            brand="Test",
            material="PLA",
            color="noir",
            weight_initial_g=1000,
            weight_remaining_g=100,
        ),
        StockItem(
            id="petg-ok",
            name="PETG rouge test",
            brand="Test",
            material="PETG",
            color="rouge",
            weight_initial_g=1000,
            weight_remaining_g=900,
        ),
    ]
    history = [
        ConsumptionSample(item_id="pla-low", amount_g=40, occurred_on=today - timedelta(days=18)),
        ConsumptionSample(item_id="pla-low", amount_g=50, occurred_on=today - timedelta(days=12)),
        ConsumptionSample(item_id="pla-low", amount_g=45, occurred_on=today - timedelta(days=6)),
        ConsumptionSample(item_id="pla-low", amount_g=80, occurred_on=today - timedelta(days=1)),
        ConsumptionSample(item_id="petg-ok", amount_g=10, occurred_on=today - timedelta(days=18)),
        ConsumptionSample(item_id="petg-ok", amount_g=12, occurred_on=today - timedelta(days=9)),
    ]
    projects = [
        ProjectItem(
            id="proj-risk",
            name="Projet a risque",
            status="PLANNING",
            requirements=[
                ProjectMaterialRequirement(material="PLA", color="noir", required_g=250),
            ],
        )
    ]
    return ForecastingService(stock_items=stock, history=history, projects=projects, today=today)


def test_forecast_item_calculates_average_depletion_and_confidence() -> None:
    forecast = _service().forecast_item("pla-low")

    assert forecast.average_daily_consumption_g > 10
    assert forecast.days_until_depletion is not None
    assert forecast.predicted_depletion_date is not None
    assert 0 < forecast.confidence_score <= 1
    assert forecast.risk_level in {RiskLevel.CRITICAL, RiskLevel.HIGH}
    assert "stock restant / moyenne" in forecast.explanation


def test_forecast_detects_anomalies() -> None:
    service = _service()
    service.history.append(
        ConsumptionSample(
            item_id="pla-low",
            amount_g=400,
            occurred_on=date(2026, 5, 29),
        )
    )

    forecast = service.forecast_item("pla-low")

    assert forecast.anomalies
    assert "depasse le seuil anormal" in forecast.anomalies[0]


def test_risks_identify_material_and_project_risks() -> None:
    result = _service().risks()

    assert result.material_risks
    assert result.project_risks
    assert result.project_risks[0].project_id == "proj-risk"


def test_forecasts_exclude_empty_spools_by_default_and_can_include_them() -> None:
    service = _service()
    service.stock_items.append(
        StockItem(
            id="abs-empty",
            name="ABS vide test",
            brand="Test",
            material="ABS",
            color="noir",
            weight_initial_g=1000,
            weight_remaining_g=0,
        )
    )

    default_ids = {forecast.item_id for forecast in service.forecast_all()}
    include_empty_ids = {forecast.item_id for forecast in service.forecast_all(include_empty=True)}

    assert "abs-empty" not in default_ids
    assert "abs-empty" in include_empty_ids


def test_notifications_prepare_proactive_proposals() -> None:
    proposals = _service().notification_proposals()

    assert proposals
    assert proposals[0].proposed_action is not None


def test_forecast_endpoint_refuses_free_plan() -> None:
    with pytest.raises(HTTPException) as exc:
        forecast_stock(
            plan=PlanContext(plan=Plan.FREE),
            context=None,
            factory=ForecastingServiceFactory(),
        )

    assert exc.value.status_code == 403
    assert exc.value.detail["code"] == "pro_required"


def test_forecast_endpoints_accept_pro_plan() -> None:
    plan = PlanContext(plan=Plan.PRO)
    class StaticFactory:
        def build(self, context=None):
            return _service()

    factory = StaticFactory()
    all_forecasts = forecast_stock(plan=plan, context=None, factory=factory)
    one_forecast = forecast_stock_item("pla-low", plan=plan, context=None, factory=factory)
    risk_response = risks(plan=plan, context=None, factory=factory)
    notification_response = notification_proposals(plan=plan, context=None, factory=factory)

    assert len(all_forecasts.forecasts) == 2
    assert one_forecast.item_id == "pla-low"
    assert risk_response.plan == "pro"
    assert notification_response.proposals


def test_forecasting_factory_uses_app_snapshot_provider_shape() -> None:
    service = ForecastingServiceFactory().build()
    forecast = service.forecast_item("fil-petg-rouge")

    assert forecast.item_id == "fil-petg-rouge"
    assert forecast.remaining_g == 95
    assert forecast.purchase_recommendation is not None


def test_free_chat_refuses_pro_feature_cleanly() -> None:
    response = asyncio.run(
        chat(
            ChatRequest(message="Peux-tu me donner la date de rupture du PLA noir ?"),
            context=None,
            plan=PlanContext(plan=Plan.FREE),
        )
    )

    assert response.intent == "pro_feature"
    assert response.data["required_plan"] == "pro"


def test_pro_chat_does_not_use_restricted_free_answer() -> None:
    response = asyncio.run(
        chat(
            ChatRequest(message="Peux-tu me donner la date de rupture du PLA noir ?"),
            context=None,
            plan=PlanContext(plan=Plan.PRO),
        )
    )

    assert response.intent == "pro_stock_forecast"
    assert "prevision Pro" in response.answer
