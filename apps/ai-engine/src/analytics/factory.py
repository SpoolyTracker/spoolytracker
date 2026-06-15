from src.analytics.service import AnalyticsService
from src.core.config import get_settings
from src.domain.provider import AppDataProvider, MockAppDataProvider
from src.integrations.spooly_api import SpoolyApiConfig, SpoolyApiProvider
from src.security.context import RequestContext
from src.security.plan import PlanContext


class AnalyticsServiceFactory:
    def __init__(self, provider: AppDataProvider | None = None) -> None:
        self.provider = provider or self._default_provider()

    def build(
        self,
        context: RequestContext | None = None,
        plan: PlanContext | None = None,
    ) -> AnalyticsService:
        snapshot = self.provider.get_snapshot(context)
        is_pro = bool(plan and plan.is_pro)
        return AnalyticsService.from_snapshot(snapshot, is_pro=is_pro)

    def _default_provider(self) -> AppDataProvider:
        settings = get_settings()
        return SpoolyApiProvider(
            SpoolyApiConfig(base_url=settings.app_api_url, token=settings.app_api_token),
            fallback=MockAppDataProvider(),
        )


analytics_factory = AnalyticsServiceFactory()
