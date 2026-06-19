from pydantic import BaseModel, Field


class StockItem(BaseModel):
    id: str
    name: str
    brand: str
    material: str
    color: str
    color_name: str | None = None
    color_hex: str | None = None
    material_type: str | None = None
    weight_initial_g: float = Field(ge=0)
    weight_remaining_g: float = Field(ge=0)
    low_stock_threshold_percent: float = Field(default=20, ge=0, le=100)
    max_volumetric_speed_mm3_s: float | None = None
    flow_ratio: float | None = None
    k_factor: float | None = None

    @property
    def remaining_percent(self) -> float:
        if self.weight_initial_g <= 0:
            return 0
        return round((self.weight_remaining_g / self.weight_initial_g) * 100, 2)


class ConsumptionLog(BaseModel):
    id: str
    filament_id: str
    amount_g: float = Field(gt=0)
    note: str


class ProjectMaterialRequirement(BaseModel):
    material: str
    color: str
    required_g: float = Field(ge=0)


class ProjectItem(BaseModel):
    id: str
    name: str
    status: str
    requirements: list[ProjectMaterialRequirement]


class StockSummaryRequest(BaseModel):
    pass


class StockSummaryResponse(BaseModel):
    active_items: int
    total_remaining_g: float
    total_initial_g: float
    items: list[StockItem]


class StockItemRequest(BaseModel):
    query: str


class StockItemResponse(BaseModel):
    item: StockItem | None


class LowStockRequest(BaseModel):
    threshold_percent: float = Field(default=20, ge=0, le=100)


class LowStockResponse(BaseModel):
    items: list[StockItem]


class ConsumptionProposalRequest(BaseModel):
    user_message: str
    filament_query: str | None = None
    amount_g: float | None = Field(default=None, gt=0)


class ProposedAction(BaseModel):
    type: str
    label: str
    payload: dict
    requires_confirmation: bool = True


class ConsumptionProposalResponse(BaseModel):
    item: StockItem | None
    amount_g: float | None
    action: ProposedAction | None
    extra_actions: list[ProposedAction] = Field(default_factory=list)
    message: str


class ProjectEstimateRequest(BaseModel):
    query: str


class ProjectRequirementEstimate(BaseModel):
    material: str
    color: str
    required_g: float
    available_g: float
    status: str


class ProjectEstimateResponse(BaseModel):
    project: ProjectItem | None
    estimates: list[ProjectRequirementEstimate]
    overall_status: str
