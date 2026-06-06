from datetime import datetime, timezone
from enum import StrEnum
from uuid import uuid4

from pydantic import BaseModel, Field


class MemoryType(StrEnum):
    PREFERENCE = "preference"
    CORRECTION = "correction"
    LEARNED_RULE = "learned_rule"
    FEEDBACK = "feedback"


class MemoryRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    workspace_id: str = Field(min_length=1)
    user_id: str = Field(min_length=1)
    type: MemoryType
    content: str = Field(min_length=1, max_length=4000)
    tags: list[str] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CreateMemoryRequest(BaseModel):
    type: MemoryType
    content: str = Field(min_length=1, max_length=4000)
    tags: list[str] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)


class MemoryListResponse(BaseModel):
    items: list[MemoryRecord]


class FeedbackRequest(BaseModel):
    content: str = Field(min_length=1, max_length=4000)
    target: str | None = None
    rating: int | None = Field(default=None, ge=1, le=5)
    metadata: dict = Field(default_factory=dict)
