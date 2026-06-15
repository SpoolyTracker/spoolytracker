from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from src.domain.snapshots import AppDataSnapshot
from src.forecasting.depletion import ForecastingService
from src.forecasting.factory import forecasting_factory
from src.forecasting.models import AlertsResponse, ProactiveAlert, RiskLevel
from src.security.context import RequestContext, get_optional_request_context
from src.security.plan import PlanContext, get_plan_context, require_pro

router = APIRouter(tags=["alerts"])

DEFAULT_TYPES = ["rupture", "achat", "projet"]


class AlertsRequest(BaseModel):
    snapshot: dict | None = None
    types: list[str] = Field(default_factory=lambda: list(DEFAULT_TYPES))


def _build_service(request: AlertsRequest, context: RequestContext | None) -> ForecastingService:
    if request.snapshot:
        snapshot = AppDataSnapshot.model_validate(request.snapshot)
        return ForecastingService.from_snapshot(snapshot, source="main_api")
    return forecasting_factory.build(context)


def _rupture_alerts(service: ForecastingService) -> list[ProactiveAlert]:
    alerts: list[ProactiveAlert] = []
    for forecast in service.forecast_all(include_empty=False):
        if forecast.risk_level not in {RiskLevel.CRITICAL, RiskLevel.HIGH}:
            continue
        days = forecast.days_until_depletion
        delay = f"dans {days:g} jours" if days is not None else "tres prochainement"
        alerts.append(
            ProactiveAlert(
                type="rupture",
                alert_key=f"rupture:{forecast.item_id}",
                severity=forecast.risk_level,
                title=f"Rupture imminente : {forecast.item_name}",
                message=(
                    f"Rupture estimee {delay} ({forecast.remaining_g:g}g restants). "
                    "Pensez a commander."
                ),
                data={"item_id": forecast.item_id, "forecast": forecast.model_dump(mode="json")},
            )
        )
    return alerts


def _achat_alerts(service: ForecastingService) -> list[ProactiveAlert]:
    alerts: list[ProactiveAlert] = []
    for reco in service.purchase_recommendations(include_empty=False):
        if reco.urgency != "immediate":
            continue
        alerts.append(
            ProactiveAlert(
                type="achat",
                alert_key=f"achat:{reco.item_id}",
                severity=RiskLevel.HIGH,
                title=f"Achat a prevoir : {reco.item_name}",
                message=f"{reco.reason} Quantite suggeree : {reco.suggested_quantity_kg} kg.",
                data={"item_id": reco.item_id, "recommendation": reco.model_dump(mode="json")},
            )
        )
    return alerts


def _projet_alerts(service: ForecastingService) -> list[ProactiveAlert]:
    risks = service.risks(include_empty=False)
    alerts: list[ProactiveAlert] = []
    for risk in risks.project_risks:
        alerts.append(
            ProactiveAlert(
                type="projet",
                alert_key=f"projet:{risk.project_id}",
                severity=RiskLevel.HIGH,
                title=f"Projet a risque : {risk.project_name}",
                message=f"{risk.reason} {'; '.join(risk.missing_materials)}",
                data={"project_id": risk.project_id, "risk": risk.model_dump(mode="json")},
            )
        )
    return alerts


def _collect_alerts(service: ForecastingService, requested: list[str]) -> list[ProactiveAlert]:
    builders = {"rupture": _rupture_alerts, "achat": _achat_alerts, "projet": _projet_alerts}
    alerts: list[ProactiveAlert] = []
    for alert_type in requested or DEFAULT_TYPES:
        builder = builders.get(alert_type)
        if builder:
            alerts.extend(builder(service))
    return alerts


@router.post("/alerts", response_model=AlertsResponse)
def get_alerts(
    request: AlertsRequest,
    plan: PlanContext = Depends(get_plan_context),
    context: RequestContext | None = Depends(get_optional_request_context),
) -> AlertsResponse:
    require_pro(plan)
    service = _build_service(request, context)
    alerts = _collect_alerts(service, request.types)
    return AlertsResponse(plan="pro", source=service.data_source, alerts=alerts)
