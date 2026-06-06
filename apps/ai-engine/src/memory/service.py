from __future__ import annotations

import re

from fastapi import HTTPException, status

from src.memory.models import (
    CreateMemoryRequest,
    FeedbackRequest,
    MemoryRecord,
    MemoryType,
)
from src.memory.store import MemoryStore, memory_store
from src.security.context import RequestContext


class MemoryService:
    def __init__(self, store: MemoryStore = memory_store) -> None:
        self.store = store

    def create(self, request: CreateMemoryRequest, context: RequestContext) -> MemoryRecord:
        return self.store.add(
            MemoryRecord(
                workspace_id=context.workspace_id,
                user_id=context.user_id,
                type=request.type,
                content=request.content,
                tags=request.tags,
                metadata=request.metadata,
            )
        )

    def list(self, context: RequestContext, memory_type: MemoryType | None = None) -> list[MemoryRecord]:
        return self.store.list(context.workspace_id, context.user_id, memory_type)

    def delete(self, memory_id: str, context: RequestContext) -> None:
        deleted = self.store.delete(memory_id, context.workspace_id, context.user_id)
        if not deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memoire introuvable.")

    def feedback(self, request: FeedbackRequest, context: RequestContext) -> MemoryRecord:
        tags = ["feedback"]
        if request.target:
            tags.append(request.target)
        return self.store.add(
            MemoryRecord(
                workspace_id=context.workspace_id,
                user_id=context.user_id,
                type=MemoryType.FEEDBACK,
                content=request.content,
                tags=tags,
                metadata={"target": request.target, "rating": request.rating, **request.metadata},
            )
        )

    def search(self, context: RequestContext, query: str, limit: int = 5) -> list[MemoryRecord]:
        return self.store.search(context.workspace_id, context.user_id, query, limit)

    def capture_from_chat(self, message: str, context: RequestContext) -> MemoryRecord | None:
        normalized = message.strip()
        lower = normalized.lower()

        if lower.startswith("souviens-toi") or lower.startswith("souviens toi"):
            content = re.sub(r"^souviens[- ]toi\s+que\s+", "", normalized, flags=re.IGNORECASE)
            return self.create(
                CreateMemoryRequest(
                    type=MemoryType.PREFERENCE,
                    content=content,
                    tags=self._tags_from_text(content),
                    metadata={"source": "chat"},
                ),
                context,
            )

        if self._looks_like_preference(lower):
            return self.create(
                CreateMemoryRequest(
                    type=MemoryType.PREFERENCE,
                    content=normalized,
                    tags=self._tags_from_text(normalized),
                    metadata={"source": "chat", "captured_as": "preference"},
                ),
                context,
            )

        if lower.startswith("non,") or lower.startswith("non "):
            return self.create(
                CreateMemoryRequest(
                    type=MemoryType.CORRECTION,
                    content=normalized,
                    tags=self._tags_from_text(normalized),
                    metadata={"source": "chat"},
                ),
                context,
            )

        if "pas utile" in lower or "n'est pas utile" in lower or "n’est pas utile" in lower:
            return self.feedback(
                FeedbackRequest(content=normalized, target="recommendation", rating=1),
                context,
            )

        return None

    def _looks_like_preference(self, lower: str) -> bool:
        preference_markers = [
            "je veux garder",
            "je souhaite garder",
            "garder une reserve",
            "garder une réserve",
            "reserve de",
            "réserve de",
            "seuil minimum",
            "minimum de",
        ]
        stock_markers = ["pla", "petg", "abs", "tpu", "stock", "bobine", "filament"]
        quantity_pattern = r"\b\d+(?:[,.]\d+)?\s*(g|kg|gr|grammes)\b"
        return (
            any(marker in lower for marker in preference_markers)
            and any(marker in lower for marker in stock_markers)
            and re.search(quantity_pattern, lower) is not None
        )

    def _tags_from_text(self, text: str) -> list[str]:
        known = [
            "pla",
            "petg",
            "abs",
            "tpu",
            "noir",
            "blanc",
            "rouge",
            "matte",
            "atomeblue",
            "reserve",
            "réserve",
            "projet",
            "seuil",
            "consommation",
            "recommandation",
        ]
        lower = text.lower()
        return [tag for tag in known if tag in lower]


memory_service = MemoryService()
