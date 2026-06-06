from fastapi import APIRouter, Depends
from pydantic import BaseModel

from src.core.config import Settings, get_settings
from src.forecasting.factory import ForecastingServiceFactory, forecasting_factory
from src.llm.service import LLMService, llm_service
from src.security.context import RequestContext, get_optional_request_context

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    environment: str


class LLMStatus(BaseModel):
    provider: str
    available: bool
    required: bool = False


class EngineStatusResponse(BaseModel):
    status: str
    service: str
    version: str
    environment: str
    data_source: str
    api_connected: bool
    api_base_url: str | None = None
    fallback_reason: str | None = None
    mode: str
    llm: LLMStatus


@router.get("/health", response_model=HealthResponse)
def health_check(settings: Settings = Depends(get_settings)) -> HealthResponse:
    return HealthResponse(
        status="ok",
        service=settings.app_name,
        version=settings.app_version,
        environment=settings.environment,
    )


def get_forecasting_factory() -> ForecastingServiceFactory:
    return forecasting_factory


def get_llm_service() -> LLMService:
    return llm_service


@router.get("/status", response_model=EngineStatusResponse)
def engine_status(
    settings: Settings = Depends(get_settings),
    context: RequestContext | None = Depends(get_optional_request_context),
    factory: ForecastingServiceFactory = Depends(get_forecasting_factory),
    llm: LLMService = Depends(get_llm_service),
) -> EngineStatusResponse:
    service = factory.build(context)
    provider = llm.provider
    api_connected = service.data_source == "main_api"
    data_provider = factory.provider
    return EngineStatusResponse(
        status="ok",
        service=settings.app_name,
        version=settings.app_version,
        environment=settings.environment,
        data_source=service.data_source,
        api_connected=api_connected,
        api_base_url=settings.app_api_url,
        fallback_reason=None if api_connected else getattr(data_provider, "last_error", None),
        mode="api" if api_connected else "demo_offline",
        llm=LLMStatus(
            provider=provider.name,
            available=provider.is_available(),
            required=False,
        ),
    )
