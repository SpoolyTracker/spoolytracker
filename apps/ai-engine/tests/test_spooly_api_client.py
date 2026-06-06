from unittest.mock import patch

from src.integrations.spooly_client import SpoolyApiClient, SpoolyApiClientConfig
from src.integrations.spooly_api import SpoolyApiConfig, SpoolyApiProvider
from src.security.context import RequestContext


def test_spooly_api_provider_falls_back_to_mock_when_main_api_unavailable() -> None:
    provider = SpoolyApiProvider(
        SpoolyApiConfig(base_url="http://127.0.0.1:9", token="demo-token")
    )

    snapshot = provider.get_snapshot(RequestContext(workspace_id="org-demo", user_id="user-demo"))

    assert snapshot.organization_id == "org-demo"
    assert snapshot.filaments
    assert snapshot.projects


def test_spooly_api_client_forwards_user_bearer_token() -> None:
    captured = {}

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def read(self):
            return b'{"organization_id":"42","user_id":"7","settings":{"organization_id":"42","plan":"pro","low_stock_threshold":20,"low_stock_threshold_type":"PERCENTAGE"},"filaments":[],"consumptions":[],"projects":[],"source":"main_api"}'

    def fake_urlopen(request, timeout):
        captured["authorization"] = request.headers.get("Authorization")
        captured["organization_id"] = request.headers.get("X-organization-id")
        captured["timeout"] = timeout
        return FakeResponse()

    client = SpoolyApiClient(
        SpoolyApiClientConfig(base_url="http://api:3000", token="service-token")
    )

    with patch("src.integrations.spooly_client.urlopen", fake_urlopen):
        snapshot = client.fetch_ai_context(
            RequestContext(
                workspace_id="42",
                user_id="7",
                authorization="Bearer user-token",
            )
        )

    assert captured["authorization"] == "Bearer user-token"
    assert captured["organization_id"] == "42"
    assert captured["timeout"] == 2.0
    assert snapshot.source == "main_api"


def test_spooly_api_client_forwards_explicit_organization_id() -> None:
    captured = {}

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def read(self):
            return b'{"organization_id":"org-current","user_id":"7","settings":{"organization_id":"org-current","plan":"pro","low_stock_threshold":20,"low_stock_threshold_type":"PERCENTAGE"},"filaments":[],"consumptions":[],"projects":[],"source":"main_api"}'

    def fake_urlopen(request, timeout):
        captured["organization_id"] = request.headers.get("X-organization-id")
        return FakeResponse()

    client = SpoolyApiClient(SpoolyApiClientConfig(base_url="http://api:3000"))

    with patch("src.integrations.spooly_client.urlopen", fake_urlopen):
        client.fetch_ai_context(
            RequestContext(
                workspace_id="org-current",
                organization_id="org-current",
                user_id="7",
            )
        )

    assert captured["organization_id"] == "org-current"
