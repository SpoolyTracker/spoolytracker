from pydantic import BaseModel, Field


class LLMMessage(BaseModel):
    role: str
    content: str


class LLMRequest(BaseModel):
    messages: list[LLMMessage]
    metadata: dict = Field(default_factory=dict)


class LLMResponse(BaseModel):
    content: str
    provider: str
    model: str | None = None
    used_fallback: bool = False
    is_available: bool = True
