from datetime import date
from enum import StrEnum

from pydantic import BaseModel, Field


class RiskLevel(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"
    UNKNOWN = "unknown"


class ConsumptionSample(BaseModel):
    item_id: str
    amount_g: float = Field(gt=0)
    occurred_on: date
    source: str = "mock"


class StockForecast(BaseModel):
    item_id: str
    item_name: str
    brand: str | None = None
    material: str
    material_type: str | None = None
    color: str
    color_name: str | None = None
    color_hex: str | None = None
    remaining_g: float
    average_daily_consumption_g: float
    days_until_depletion: float | None
    predicted_depletion_date: date | None
    confidence_score: float = Field(ge=0, le=1)
    risk_level: RiskLevel
    explanation: str
    anomalies: list[str] = Field(default_factory=list)
    purchase_recommendation: str | None = None


class StockForecastResponse(BaseModel):
    plan: str = "pro"
    source: str = "mock_fallback"
    forecasts: list[StockForecast]


class MaterialRisk(BaseModel):
    item_name: str | None = None
    brand: str | None = None
    material: str
    material_type: str | None = None
    color: str | None = None
    color_name: str | None = None
    color_hex: str | None = None
    risk_level: RiskLevel
    reason: str
    affected_items: list[str]
    confidence_score: float = Field(ge=0, le=1)


class ProjectRisk(BaseModel):
    project_id: str
    project_name: str
    risk_level: RiskLevel
    reason: str
    missing_materials: list[str] = Field(default_factory=list)
    confidence_score: float = Field(ge=0, le=1)


class RisksResponse(BaseModel):
    plan: str = "pro"
    source: str = "mock_fallback"
    material_risks: list[MaterialRisk]
    project_risks: list[ProjectRisk]


class NotificationProposal(BaseModel):
    type: str
    title: str
    message: str
    priority: RiskLevel
    related_item_id: str | None = None
    proposed_action: dict | None = None
    confidence_score: float = Field(ge=0, le=1)


class NotificationProposalsResponse(BaseModel):
    plan: str = "pro"
    source: str = "mock_fallback"
    proposals: list[NotificationProposal]


class PurchaseRecommendation(BaseModel):
    item_id: str
    item_name: str
    brand: str | None = None
    material: str
    material_type: str | None = None
    color: str
    color_name: str | None = None
    color_hex: str | None = None
    remaining_g: float
    remaining_percent: float
    days_until_depletion: float | None = None
    predicted_depletion_date: date | None = None
    risk_level: RiskLevel
    urgency: str
    suggested_quantity_kg: int = 1
    reason: str
    confidence_score: float = Field(ge=0, le=1)
    provider_name: str | None = None
    provider_url: str | None = None


class PurchaseRecommendationsResponse(BaseModel):
    plan: str = "pro"
    source: str = "mock_fallback"
    country: str | None = None
    recommendations: list[PurchaseRecommendation]


class ProactiveAlert(BaseModel):
    type: str  # "rupture" | "achat" | "projet"
    alert_key: str
    severity: RiskLevel
    title: str
    message: str
    data: dict = Field(default_factory=dict)


class AlertsResponse(BaseModel):
    plan: str = "pro"
    source: str = "mock_fallback"
    alerts: list[ProactiveAlert]
