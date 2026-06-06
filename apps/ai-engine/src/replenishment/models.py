from pydantic import BaseModel, Field


class ColorCandidate(BaseModel):
    name: str
    hex: str | None = None
    distance: float | None = None
    score: int = Field(ge=0, le=100)


class ReplenishmentSuggestion(BaseModel):
    provider_id: str
    provider_name: str
    country: str
    title: str
    url: str
    score: int = Field(ge=0, le=100)
    relevance: str
    query: str
    matched_color: ColorCandidate
    reasons: list[str]


class ReplenishmentPolicy(BaseModel):
    brand: str = "required"
    material: str = "required"
    material_type: str = "required_when_known"
    color: str = "exact_or_nearest_for_same_brand_material_type"


class ReplenishmentResponse(BaseModel):
    item_id: str
    country: str
    quantity_kg: int
    matching_policy: ReplenishmentPolicy = Field(default_factory=ReplenishmentPolicy)
    suggestions: list[ReplenishmentSuggestion]
