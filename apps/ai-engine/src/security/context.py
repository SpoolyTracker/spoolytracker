from fastapi import Header
from fastapi import HTTPException, status
from pydantic import BaseModel, Field


class RequestContext(BaseModel):
    workspace_id: str = Field(min_length=1)
    user_id: str = Field(min_length=1)
    authorization: str | None = None
    organization_id: str | None = None


def _build_context(
    workspace_id: str,
    user_id: str,
    authorization: str | None,
    organization_id: str | None,
) -> RequestContext:
    if organization_id and organization_id != workspace_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization header does not match workspace header.",
        )
    return RequestContext(
        workspace_id=organization_id or workspace_id,
        user_id=user_id,
        authorization=authorization,
        organization_id=organization_id or workspace_id,
    )


def get_request_context(
    workspace_id: str = Header(alias="x-workspace-id"),
    user_id: str = Header(alias="x-user-id"),
    authorization: str | None = Header(default=None, alias="authorization"),
    organization_id: str | None = Header(default=None, alias="x-organization-id"),
) -> RequestContext:
    return _build_context(workspace_id, user_id, authorization, organization_id)


def get_optional_request_context(
    workspace_id: str | None = Header(default=None, alias="x-workspace-id"),
    user_id: str | None = Header(default=None, alias="x-user-id"),
    authorization: str | None = Header(default=None, alias="authorization"),
    organization_id: str | None = Header(default=None, alias="x-organization-id"),
) -> RequestContext | None:
    if not workspace_id or not user_id:
        return None
    return _build_context(workspace_id, user_id, authorization, organization_id)
