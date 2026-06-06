from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.forecasting.depletion import ForecastingService
from src.forecasting.factory import ForecastingServiceFactory, forecasting_factory
from src.forecasting.models import (
    NotificationProposalsResponse,
    RisksResponse,
    StockForecast,
    StockForecastResponse,
)
from src.security.plan import PlanContext, get_plan_context, require_pro
from src.security.context import RequestContext, get_optional_request_context

router = APIRouter(tags=["forecast"])


def get_forecasting_factory() -> ForecastingServiceFactory:
    return forecasting_factory


@router.get("/forecast/stock", response_model=StockForecastResponse)
def forecast_stock(
    include_empty: bool = Query(default=False, description="Inclure les bobines vides dans la prevision."),
    plan: PlanContext = Depends(get_plan_context),
    context: RequestContext | None = Depends(get_optional_request_context),
    factory: ForecastingServiceFactory = Depends(get_forecasting_factory),
) -> StockForecastResponse:
    require_pro(plan)
    service = factory.build(context)
    return StockForecastResponse(source=service.data_source, forecasts=service.forecast_all(include_empty=include_empty))


@router.get("/forecast/stock/{item_id}", response_model=StockForecast)
def forecast_stock_item(
    item_id: str,
    plan: PlanContext = Depends(get_plan_context),
    context: RequestContext | None = Depends(get_optional_request_context),
    factory: ForecastingServiceFactory = Depends(get_forecasting_factory),
) -> StockForecast:
    require_pro(plan)
    service = factory.build(context)
    try:
        return service.forecast_item(item_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bobine introuvable.")


@router.get("/risks", response_model=RisksResponse)
def risks(
    include_empty: bool = Query(default=False, description="Inclure les bobines vides dans les risques."),
    plan: PlanContext = Depends(get_plan_context),
    context: RequestContext | None = Depends(get_optional_request_context),
    factory: ForecastingServiceFactory = Depends(get_forecasting_factory),
) -> RisksResponse:
    require_pro(plan)
    service = factory.build(context)
    response = service.risks(include_empty=include_empty)
    response.source = service.data_source
    return response


@router.get("/notifications/proposals", response_model=NotificationProposalsResponse)
def notification_proposals(
    include_empty: bool = Query(default=False, description="Inclure les bobines vides dans les notifications proposees."),
    plan: PlanContext = Depends(get_plan_context),
    context: RequestContext | None = Depends(get_optional_request_context),
    factory: ForecastingServiceFactory = Depends(get_forecasting_factory),
) -> NotificationProposalsResponse:
    require_pro(plan)
    service = factory.build(context)
    return NotificationProposalsResponse(
        source=service.data_source,
        proposals=service.notification_proposals(include_empty=include_empty),
    )
