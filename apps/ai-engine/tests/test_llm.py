import asyncio

from src.api.routes.chat import chat
from src.api.schemas import ChatRequest
from src.llm.models import LLMMessage, LLMRequest
from src.llm.providers import MockLLMProvider, NoneLLMProvider, OllamaLLMProvider
from src.llm.service import LLMService
from src.security.plan import Plan, PlanContext


def test_none_provider_is_not_required() -> None:
    provider = NoneLLMProvider()
    response = provider.complete(LLMRequest(messages=[]))

    assert response.provider == "none"
    assert response.is_available is False


def test_mock_provider_returns_deterministic_content() -> None:
    service = LLMService(MockLLMProvider())

    response = service.enhance_answer(
        user_message="Quel est mon stock ?",
        deterministic_answer="Votre stock est de 895g.",
    )

    assert response is not None
    assert response.provider == "mock"
    assert "Reformulation mock LLM" in response.content


def test_ollama_provider_falls_back_when_unavailable() -> None:
    provider = OllamaLLMProvider(
        base_url="http://127.0.0.1:9",
        model="missing",
        fallback=MockLLMProvider(),
        timeout_seconds=0.01,
    )

    response = provider.complete(
        LLMRequest(messages=[LLMMessage(role="user", content="bonjour")])
    )

    assert response.used_fallback is True
    assert response.provider == "mock"


def test_chat_uses_mock_llm_as_optional_enhancement() -> None:
    response = asyncio.run(
        chat(
            ChatRequest(message="Quel est mon stock de filament ?"),
            context=None,
            plan=PlanContext(plan=Plan.FREE),
            llm=LLMService(MockLLMProvider()),
        )
    )

    assert response.data is not None
    assert response.data["llm"]["provider"] == "mock"
    assert response.answer.startswith("Reformulation mock LLM")


class CapturingProvider(MockLLMProvider):
    def __init__(self) -> None:
        self.last_prompt = ""

    def complete(self, request):
        self.last_prompt = request.messages[-1].content
        return super().complete(request)


def test_llm_does_not_receive_memory_context_by_default() -> None:
    provider = CapturingProvider()
    service = LLMService(provider)

    service.enhance_answer(
        user_message="Combien reste-t-il ?",
        deterministic_answer="Reponse.\n\nMemoire pertinente utilisee:\n- secret",
        memories=[{"content": "secret"}],
    )

    assert "secret" not in provider.last_prompt
