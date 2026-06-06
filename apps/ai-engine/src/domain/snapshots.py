from datetime import date

from pydantic import BaseModel, Field

from src.forecasting.models import ConsumptionSample
from src.tools.models import ProjectItem, ProjectMaterialRequirement, StockItem


def _is_hex_color(value: str) -> bool:
    value = value.strip()
    if not value.startswith("#") or len(value) not in {4, 7}:
        return False
    return all(char in "0123456789abcdefABCDEF" for char in value[1:])


class AppFilamentSnapshot(BaseModel):
    id: str
    organization_id: str
    name: str
    brand_name: str
    material_name: str
    color_name: str
    color_hex: str | None = None
    color_display_name: str | None = None
    material_type: str | None = None
    weight_initial_g: float = Field(ge=0)
    weight_remaining_g: float = Field(ge=0)
    planned_weight_g: float = Field(default=0, ge=0)
    virtual_weight_remaining_g: float | None = Field(default=None, ge=0)
    low_stock_threshold: float | None = None
    low_stock_threshold_type: str = "PERCENTAGE"
    price: float | None = None
    vendor: str | None = None

    @property
    def forecastable_remaining_g(self) -> float:
        if self.virtual_weight_remaining_g is not None:
            return self.virtual_weight_remaining_g
        return max(self.weight_remaining_g - self.planned_weight_g, 0)

    def to_stock_item(self) -> StockItem:
        color_hex = self.color_hex or (self.color_name if _is_hex_color(self.color_name) else None)
        color_name = self.color_display_name or (None if _is_hex_color(self.color_name) else self.color_name)
        display_color = color_name or ""
        display_name = " ".join(
            part
            for part in [self.material_name, self.material_type, display_color]
            if part and part.lower() != "inconnu"
        ).strip() or self.name
        return StockItem(
            id=self.id,
            name=display_name,
            brand=self.brand_name,
            material=self.material_name,
            color=self.color_name,
            color_name=color_name,
            color_hex=color_hex,
            material_type=self.material_type,
            weight_initial_g=self.weight_initial_g,
            weight_remaining_g=self.forecastable_remaining_g,
            low_stock_threshold_percent=(
                self.low_stock_threshold
                if self.low_stock_threshold_type == "PERCENTAGE" and self.low_stock_threshold is not None
                else 20
            ),
        )


class AppConsumptionSnapshot(BaseModel):
    id: str
    organization_id: str
    filament_id: str
    amount_g: float = Field(gt=0)
    occurred_on: date
    type: str = "PRINT"
    project_id: str | None = None
    print_status: str | None = None
    is_planned: bool = False

    def to_consumption_sample(self) -> ConsumptionSample:
        return ConsumptionSample(
            item_id=self.filament_id,
            amount_g=self.amount_g,
            occurred_on=self.occurred_on,
            source="spooly_snapshot",
        )


class AppProjectSnapshot(BaseModel):
    id: str
    organization_id: str
    name: str
    status: str
    requirements: list[ProjectMaterialRequirement]

    def to_project_item(self) -> ProjectItem:
        return ProjectItem(
            id=self.id,
            name=self.name,
            status=self.status,
            requirements=self.requirements,
        )


class AppOrganizationSettings(BaseModel):
    organization_id: str
    plan: str = "free"
    low_stock_threshold: float = 20
    low_stock_threshold_type: str = "PERCENTAGE"


class AppDataSnapshot(BaseModel):
    source: str = "mock_fallback"
    organization_id: str
    user_id: str | None = None
    settings: AppOrganizationSettings
    filaments: list[AppFilamentSnapshot]
    consumptions: list[AppConsumptionSnapshot]
    projects: list[AppProjectSnapshot]

    def to_forecasting_inputs(self):
        return {
            "stock_items": [filament.to_stock_item() for filament in self.filaments],
            "history": [
                consumption.to_consumption_sample()
                for consumption in self.consumptions
                if not consumption.is_planned and consumption.print_status != "FAILED"
            ],
            "projects": [project.to_project_item() for project in self.projects],
        }
