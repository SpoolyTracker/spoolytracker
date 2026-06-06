import json
from urllib.error import URLError
from urllib.request import Request, urlopen

from pydantic import BaseModel

from src.domain.snapshots import AppDataSnapshot
from src.security.context import RequestContext


class SpoolyApiClientConfig(BaseModel):
    base_url: str
    token: str | None = None
    timeout_seconds: float = 2.0


class SpoolyApiClient:
    """Typed client for the future main NestJS API AI context endpoint."""

    def __init__(self, config: SpoolyApiClientConfig) -> None:
        self.config = config

    def fetch_ai_context(self, context: RequestContext | None = None) -> AppDataSnapshot:
        headers = {"Accept": "application/json"}
        if context and context.authorization:
            headers["Authorization"] = context.authorization
        elif self.config.token:
            headers["Authorization"] = f"Bearer {self.config.token}"
        if context:
            headers["x-organization-id"] = context.organization_id or context.workspace_id
            headers["x-user-id"] = context.user_id

        request = Request(
            f"{self.config.base_url.rstrip('/')}/ai/context",
            headers=headers,
            method="GET",
        )
        with urlopen(request, timeout=self.config.timeout_seconds) as response:
            payload = json.loads(response.read().decode("utf-8"))
        return AppDataSnapshot.model_validate(payload)


class SpoolyApiUnavailable(Exception):
    pass
