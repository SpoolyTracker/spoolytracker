from src.agents.base import AgentResult, BaseAgent


class PlannerAgent(BaseAgent):
    """Placeholder deterministic planner until a real LLM is connected."""

    name = "planner"

    async def run(self, prompt: str, context: dict | None = None) -> AgentResult:
        return AgentResult(
            intent="not_configured",
            answer=(
                "Le moteur IA est disponible comme service, mais aucun fournisseur LLM "
                "n'est configure pour cet agent."
            ),
        )
