from fastapi import Header, HTTPException, status

from src.core.config import get_settings


async def verify_internal_token(
    authorization: str | None = Header(default=None),
) -> None:
    settings = get_settings()
    if not settings.internal_api_token:
        return

    expected = f"Bearer {settings.internal_api_token}"
    if authorization != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal API token",
        )
