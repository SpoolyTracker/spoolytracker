from fastapi import APIRouter, Depends, Query

from src.analytics.factory import AnalyticsServiceFactory, analytics_factory
from src.analytics.models import (
    AnalyticsOverview,
    ConsumptionAnalytics,
    CostAnalytics,
    StockAnalytics,
)
from src.security.context import RequestContext, get_optional_request_context
from src.security.plan import PlanContext, get_plan_context

router = APIRouter(tags=["analytics"])


def get_analytics_factory() -> AnalyticsServiceFactory:
    return analytics_factory


@router.get("/analytics/overview", response_model=AnalyticsOverview)
def analytics_overview(
    granularity: str = Query(default="day", pattern="^(day|week|month)$"),
    plan: PlanContext = Depends(get_plan_context),
    context: RequestContext | None = Depends(get_optional_request_context),
    factory: AnalyticsServiceFactory = Depends(get_analytics_factory),
) -> AnalyticsOverview:
    return factory.build(context=context, plan=plan).overview(granularity=granularity)


@router.get("/analytics/consumption", response_model=ConsumptionAnalytics)
def analytics_consumption(
    granularity: str = Query(default="day", pattern="^(day|week|month)$"),
    plan: PlanContext = Depends(get_plan_context),
    context: RequestContext | None = Depends(get_optional_request_context),
    factory: AnalyticsServiceFactory = Depends(get_analytics_factory),
) -> ConsumptionAnalytics:
    return factory.build(context=context, plan=plan).consumption(granularity=granularity)


@router.get("/analytics/cost", response_model=CostAnalytics)
def analytics_cost(
    granularity: str = Query(default="day", pattern="^(day|week|month)$"),
    plan: PlanContext = Depends(get_plan_context),
    context: RequestContext | None = Depends(get_optional_request_context),
    factory: AnalyticsServiceFactory = Depends(get_analytics_factory),
) -> CostAnalytics:
    return factory.build(context=context, plan=plan).cost(granularity=granularity)


@router.get("/analytics/stock", response_model=StockAnalytics)
def analytics_stock(
    plan: PlanContext = Depends(get_plan_context),
    context: RequestContext | None = Depends(get_optional_request_context),
    factory: AnalyticsServiceFactory = Depends(get_analytics_factory),
) -> StockAnalytics:
    return factory.build(context=context, plan=plan).stock()
