from src.api.routes.health import engine_status, health_check
from src.core.config import get_settings
from src.domain.provider import MockAppDataProvider
from src.forecasting.factory import ForecastingServiceFactory
from src.llm.providers import NoneLLMProvider
from src.llm.service import LLMService
from src.security.context import RequestContext
from src.main import create_app


def test_health_returns_ok() -> None:
    response = health_check(settings=get_settings())

    assert response.status == "ok"
    assert response.service == "Spooly AI Engine"


def test_health_route_is_registered() -> None:
    app = create_app()
    routes = {route.path for route in app.routes}

    assert "/health" in routes
    assert "/status" in routes
    assert "/chat" in routes
    assert "/capabilities" in routes
    assert "/memory" in routes
    assert "/memory/{memory_id}" in routes
    assert "/feedback" in routes
    assert "/forecast/stock" in routes
    assert "/forecast/stock/{item_id}" in routes
    assert "/risks" in routes
    assert "/notifications/proposals" in routes


def test_engine_status_exposes_data_source_and_llm() -> None:
    response = engine_status(
        settings=get_settings(),
        context=RequestContext(workspace_id="org-demo", user_id="user-demo"),
        factory=ForecastingServiceFactory(provider=MockAppDataProvider()),
        llm=LLMService(NoneLLMProvider()),
    )

    assert response.status == "ok"
    assert response.data_source == "mock_fallback"
    assert response.api_connected is False
    assert response.api_base_url == "http://localhost:3000"
    assert response.mode == "demo_offline"
    assert response.llm.provider == "none"
