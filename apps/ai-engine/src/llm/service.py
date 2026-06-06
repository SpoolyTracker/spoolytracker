from src.core.config import get_settings
from src.llm.factory import build_llm_provider
from src.llm.models import LLMMessage, LLMRequest, LLMResponse
from src.llm.providers import LLMProvider


class LLMService:
    def __init__(self, provider: LLMProvider | None = None) -> None:
        self.provider = provider or build_llm_provider()

    def enhance_answer(
        self,
        user_message: str,
        deterministic_answer: str,
        memories: list[dict] | None = None,
    ) -> LLMResponse | None:
        if self.provider.name == "none":
            return None

        settings = get_settings()
        safe_memories = []
        safe_answer = deterministic_answer
        if settings.allow_sensitive_llm_context:
            safe_memories = memories or []
        else:
            safe_answer = deterministic_answer.split("\n\nMemoire pertinente utilisee:", 1)[0]

        request = LLMRequest(
            messages=[
                LLMMessage(
                    role="system",
                    content=(
                        "Tu es un assistant local optionnel. Tu peux reformuler en francais, "
                        "mais tu ne dois pas inventer de donnees ni executer d'action."
                    ),
                ),
                LLMMessage(
                    role="user",
                    content=(
                        f"Question utilisateur: {user_message}\n"
                        f"Reponse deterministe: {safe_answer}\n"
                        f"Memoire autorisee: {safe_memories}"
                    ),
                ),
            ],
            metadata={"sensitive_context_allowed": settings.allow_sensitive_llm_context},
        )
        return self.provider.complete(request)


llm_service = LLMService()
