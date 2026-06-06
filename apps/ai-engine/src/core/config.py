from functools import lru_cache
import os
from pathlib import Path

from pydantic import BaseModel


class Settings(BaseModel):
    app_name: str = "Spooly AI Engine"
    app_version: str = "0.1.0"
    environment: str = "local"
    debug: bool = False
    host: str = "0.0.0.0"
    port: int = 8000
    internal_api_token: str | None = None
    memory_db_path: str = "ai_engine_memory.sqlite3"
    app_api_url: str | None = "http://localhost:3000"
    app_api_token: str | None = None
    llm_provider: str = "none"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2"
    allow_sensitive_llm_context: bool = False
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]


def _load_dotenv(path: Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    return int(value)


@lru_cache
def get_settings() -> Settings:
    _load_dotenv(Path(".env"))
    return Settings(
        app_name=os.getenv("AI_ENGINE_APP_NAME", "Spooly AI Engine"),
        app_version=os.getenv("AI_ENGINE_APP_VERSION", "0.1.0"),
        environment=os.getenv("AI_ENGINE_ENV", "local"),
        debug=_env_bool("AI_ENGINE_DEBUG", False),
        host=os.getenv("AI_ENGINE_HOST", "0.0.0.0"),
        port=_env_int("AI_ENGINE_PORT", 8000),
        internal_api_token=os.getenv("AI_ENGINE_INTERNAL_API_TOKEN"),
        memory_db_path=os.getenv("AI_ENGINE_MEMORY_DB_PATH", "ai_engine_memory.sqlite3"),
        app_api_url=os.getenv("AI_ENGINE_APP_API_URL", "http://localhost:3000"),
        app_api_token=os.getenv("AI_ENGINE_APP_API_TOKEN"),
        llm_provider=os.getenv("AI_LLM_PROVIDER", "none"),
        ollama_base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
        ollama_model=os.getenv("OLLAMA_MODEL", "llama3.2"),
        allow_sensitive_llm_context=_env_bool("AI_ALLOW_SENSITIVE_LLM_CONTEXT", False),
        cors_origins=[
            origin.strip()
            for origin in os.getenv(
                "AI_ENGINE_CORS_ORIGINS",
                "http://localhost:5173,http://localhost:3000",
            ).split(",")
            if origin.strip()
        ],
    )
