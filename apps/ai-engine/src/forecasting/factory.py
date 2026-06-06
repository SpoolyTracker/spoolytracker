from src.core.config import get_settings
from src.domain.provider import AppDataProvider, MockAppDataProvider
from src.forecasting.depletion import ForecastingService
from src.integrations.spooly_api import SpoolyApiConfig, SpoolyApiProvider
from src.security.context import RequestContext


class ForecastingServiceFactory:
    def __init__(self, provider: AppDataProvider | None = None) -> None:
        self.provider = provider or self._default_provider()

    def build(self, context: RequestContext | None = None) -> ForecastingService:
        snapshot = self.provider.get_snapshot(context)
        return ForecastingService.from_snapshot(snapshot)

    def _default_provider(self) -> AppDataProvider:
        settings = get_settings()
        return SpoolyApiProvider(
            SpoolyApiConfig(
                base_url=settings.app_api_url,
                token=settings.app_api_token,
            ),
            fallback=MockAppDataProvider(),
        )


forecasting_factory = ForecastingServiceFactory()
