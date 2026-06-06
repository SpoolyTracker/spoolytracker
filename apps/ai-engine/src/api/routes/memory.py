from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status

from src.memory.models import (
    CreateMemoryRequest,
    FeedbackRequest,
    MemoryListResponse,
    MemoryRecord,
    MemoryType,
)
from src.memory.service import MemoryService, memory_service
from src.security.context import RequestContext, get_request_context

router = APIRouter(tags=["memory"])


def get_memory_service() -> MemoryService:
    return memory_service


@router.post("/memory", response_model=MemoryRecord)
def create_memory(
    request: CreateMemoryRequest,
    context: RequestContext = Depends(get_request_context),
    service: MemoryService = Depends(get_memory_service),
) -> MemoryRecord:
    return service.create(request, context)


@router.get("/memory", response_model=MemoryListResponse)
def list_memory(
    memory_type: Annotated[MemoryType | None, Query(alias="type")] = None,
    context: RequestContext = Depends(get_request_context),
    service: MemoryService = Depends(get_memory_service),
) -> MemoryListResponse:
    return MemoryListResponse(items=service.list(context, memory_type))


@router.delete("/memory/{memory_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_memory(
    memory_id: str,
    context: RequestContext = Depends(get_request_context),
    service: MemoryService = Depends(get_memory_service),
) -> Response:
    service.delete(memory_id, context)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/feedback", response_model=MemoryRecord)
def create_feedback(
    request: FeedbackRequest,
    context: RequestContext = Depends(get_request_context),
    service: MemoryService = Depends(get_memory_service),
) -> MemoryRecord:
    return service.feedback(request, context)
