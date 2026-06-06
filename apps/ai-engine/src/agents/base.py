from pydantic import BaseModel, Field


class AgentResult(BaseModel):
    intent: str
    answer: str
    requires_confirmation: bool = False
    proposed_actions: list[dict] = Field(default_factory=list)
    data: dict | None = None


class BaseAgent:
    """Base contract for future AI agents."""

    name = "base"

    async def run(self, prompt: str, context: dict | None = None) -> AgentResult:
        raise NotImplementedError
