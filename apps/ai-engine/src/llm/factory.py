from src.core.config import get_settings
from src.llm.providers import LLMProvider, MockLLMProvider, NoneLLMProvider, OllamaLLMProvider


def build_llm_provider() -> LLMProvider:
    settings = get_settings()
    provider = settings.llm_provider.lower()

    if provider == "mock":
        return MockLLMProvider()

    if provider == "ollama":
        return OllamaLLMProvider(
            base_url=settings.ollama_base_url,
            model=settings.ollama_model,
            fallback=NoneLLMProvider(),
        )

    return NoneLLMProvider()
