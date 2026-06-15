from datetime import date

from pydantic import BaseModel, Field


class SeriesPoint(BaseModel):
    bucket: str
    value: float = 0
    planned: float = 0


class BreakdownSlice(BaseModel):
    key: str
    label: str
    value: float
    color_hex: str | None = None


class PeriodDelta(BaseModel):
    current: float = 0
    previous: float = 0
    pct: float = 0


class ConsumptionAnalytics(BaseModel):
    series: list[SeriesPoint] = Field(default_factory=list)
    by_material: list[BreakdownSlice] = Field(default_factory=list)
    by_brand: list[BreakdownSlice] = Field(default_factory=list)
    delta: PeriodDelta = Field(default_factory=PeriodDelta)


class CostAnalytics(BaseModel):
    series: list[SeriesPoint] = Field(default_factory=list)
    by_material: list[BreakdownSlice] = Field(default_factory=list)
    total_cost: float = 0
    delta: PeriodDelta = Field(default_factory=PeriodDelta)
    suggested_budget: float | None = None


class DepletionItem(BaseModel):
    item_id: str
    label: str
    days_left: float | None = None
    estimated_date: date | None = None
    color_hex: str | None = None
    risk_level: str = "unknown"


class DormantItem(BaseModel):
    item_id: str
    label: str
    remaining_g: float
    value: float
    last_used_on: date | None = None
    days_idle: int | None = None
    color_hex: str | None = None


class StockAnalytics(BaseModel):
    runway_days: int | None = None
    total_value: float = 0
    available_value: float = 0
    by_material: list[BreakdownSlice] = Field(default_factory=list)
    by_brand: list[BreakdownSlice] = Field(default_factory=list)
    dormant: list[DormantItem] = Field(default_factory=list)
    depletion: list[DepletionItem] = Field(default_factory=list)


class AnalyticsOverview(BaseModel):
    plan: str = "free"
    source: str = "mock_fallback"
    granularity: str = "day"
    generated_on: date
    consumption: ConsumptionAnalytics = Field(default_factory=ConsumptionAnalytics)
    cost: CostAnalytics = Field(default_factory=CostAnalytics)
    stock: StockAnalytics = Field(default_factory=StockAnalytics)
