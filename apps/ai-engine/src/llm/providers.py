import json
from typing import Protocol
from urllib.error import URLError
from urllib.request import Request, urlopen

from src.llm.models import LLMRequest, LLMResponse


class LLMProvider(Protocol):
    name: str

    def is_available(self) -> bool:
        ...

    def complete(self, request: LLMRequest) -> LLMResponse:
        ...


class NoneLLMProvider:
    name = "none"

    def is_available(self) -> bool:
        return True

    def complete(self, request: LLMRequest) -> LLMResponse:
        return LLMResponse(
            content="",
            provider=self.name,
            model=None,
            is_available=False,
        )


class MockLLMProvider:
    name = "mock"

    def is_available(self) -> bool:
        return True

    def complete(self, request: LLMRequest) -> LLMResponse:
        last_user = next(
            (message.content for message in reversed(request.messages) if message.role == "user"),
            "",
        )
        return LLMResponse(
            content=f"Reformulation mock LLM: {last_user}".strip(),
            provider=self.name,
            model="mock-local",
        )


class OllamaLLMProvider:
    name = "ollama"

    def __init__(
        self,
        base_url: str,
        model: str,
        fallback: LLMProvider | None = None,
        timeout_seconds: float = 2.0,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.fallback = fallback or NoneLLMProvider()
        self.timeout_seconds = timeout_seconds

    def is_available(self) -> bool:
        try:
            request = Request(f"{self.base_url}/api/tags", method="GET")
            with urlopen(request, timeout=self.timeout_seconds) as response:
                return response.status < 500
        except (OSError, URLError):
            return False

    def complete(self, request: LLMRequest) -> LLMResponse:
        if not self.is_available():
            fallback_response = self.fallback.complete(request)
            fallback_response.used_fallback = True
            return fallback_response

        payload = json.dumps(
            {
                "model": self.model,
                "messages": [message.model_dump() for message in request.messages],
                "stream": False,
            }
        ).encode("utf-8")
        http_request = Request(
            f"{self.base_url}/api/chat",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urlopen(http_request, timeout=self.timeout_seconds) as response:
                body = json.loads(response.read().decode("utf-8"))
        except (OSError, URLError, json.JSONDecodeError):
            fallback_response = self.fallback.complete(request)
            fallback_response.used_fallback = True
            return fallback_response

        return LLMResponse(
            content=(body.get("message") or {}).get("content", ""),
            provider=self.name,
            model=self.model,
        )
