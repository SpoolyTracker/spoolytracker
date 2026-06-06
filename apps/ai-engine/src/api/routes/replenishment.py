from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from src.forecasting.factory import ForecastingServiceFactory, forecasting_factory
from src.replenishment.models import ReplenishmentResponse
from src.replenishment.service import ReplenishmentService, country_from_headers
from src.security.context import RequestContext, get_optional_request_context
from src.security.plan import PlanContext, get_plan_context, require_pro

router = APIRouter(tags=["replenishment"])


def get_forecasting_factory() -> ForecastingServiceFactory:
    return forecasting_factory


@router.get("/replenishment/stock/{item_id}", response_model=ReplenishmentResponse)
def replenishment_suggestions(
    item_id: str,
    request: Request,
    country: str | None = Query(
        default=None,
        description="Code pays ISO-2 optionnel. Si absent, utilise les headers de geolocalisation IP.",
    ),
    max_results: int = Query(default=8, ge=1, le=20),
    plan: PlanContext = Depends(get_plan_context),
    context: RequestContext | None = Depends(get_optional_request_context),
    factory: ForecastingServiceFactory = Depends(get_forecasting_factory),
) -> ReplenishmentResponse:
    require_pro(plan)
    service = factory.build(context)
    detected_country = country or country_from_headers(dict(request.headers))
    try:
        return ReplenishmentService(service.stock_items).suggest_for_item(
            item_id=item_id,
            country=detected_country,
            max_results=max_results,
        )
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bobine introuvable.")
