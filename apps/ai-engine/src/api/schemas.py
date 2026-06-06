from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    conversation_id: str | None = None


class ChatResponse(BaseModel):
    intent: str
    answer: str
    requires_confirmation: bool = False
    proposed_actions: list[dict] = Field(default_factory=list)
    data: dict | None = None


class Capability(BaseModel):
    name: str
    description: str


class CapabilitiesResponse(BaseModel):
    tier: str
    language: str
    intents: list[Capability]
    tools: list[Capability]
    limitations: list[str]
    llm: dict | None = None
