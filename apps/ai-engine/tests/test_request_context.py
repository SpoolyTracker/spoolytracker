import pytest
from fastapi import HTTPException

from src.security.context import get_optional_request_context


def test_optional_request_context_rejects_workspace_organization_mismatch() -> None:
    with pytest.raises(HTTPException) as exc:
        get_optional_request_context(
            workspace_id="org-a",
            organization_id="org-b",
            user_id="user-1",
            authorization="Bearer token",
        )

    assert exc.value.status_code == 400
