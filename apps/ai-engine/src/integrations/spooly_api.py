from urllib.error import URLError

from pydantic import BaseModel

from src.domain.provider import AppDataProvider, MockAppDataProvider
from src.domain.snapshots import AppDataSnapshot
from src.integrations.spooly_client import SpoolyApiClient, SpoolyApiClientConfig
from src.security.context import RequestContext


class SpoolyApiConfig(BaseModel):
    base_url: str | None = None
    token: str | None = None


class SpoolyApiProvider(AppDataProvider):
    """Adapter for the NestJS API with a local demo fallback."""

    def __init__(self, config: SpoolyApiConfig, fallback: AppDataProvider | None = None) -> None:
        self.config = config
        self.fallback = fallback or MockAppDataProvider()
        self.last_error: str | None = None

    def get_snapshot(self, context: RequestContext | None = None) -> AppDataSnapshot:
        if not self.config.base_url:
            self.last_error = "AI_ENGINE_APP_API_URL is not configured."
            return self.fallback.get_snapshot(context)
        try:
            snapshot = SpoolyApiClient(
                SpoolyApiClientConfig(
                    base_url=self.config.base_url,
                    token=self.config.token,
                )
            ).fetch_ai_context(context)
            snapshot.source = "main_api"
            self.last_error = None
            return snapshot
        except (OSError, URLError, ValueError) as error:
            self.last_error = str(error) or error.__class__.__name__
            return self.fallback.get_snapshot(context)
