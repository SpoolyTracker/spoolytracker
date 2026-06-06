import asyncio

import pytest
from fastapi import HTTPException

from src.api.routes.chat import chat
from src.api.routes.memory import create_feedback, create_memory, delete_memory, list_memory
from src.api.schemas import ChatRequest
from src.memory.models import CreateMemoryRequest, FeedbackRequest, MemoryType
from src.memory.service import MemoryService
from src.memory.store import InMemoryStore
from src.security.context import RequestContext
from src.security.plan import Plan, PlanContext


@pytest.fixture()
def memory_service() -> MemoryService:
    return MemoryService(InMemoryStore())


@pytest.fixture()
def context() -> RequestContext:
    return RequestContext(workspace_id="workspace-1", user_id="user-1")


def test_memory_crud_workflow(memory_service: MemoryService, context: RequestContext) -> None:
    record = create_memory(
        CreateMemoryRequest(
            type=MemoryType.PREFERENCE,
            content="Mon seuil minimum de PLA noir est 2kg",
            tags=["pla", "noir", "seuil"],
        ),
        context=context,
        service=memory_service,
    )

    listed = list_memory(context=context, service=memory_service)

    assert listed.items[0].id == record.id
    assert listed.items[0].workspace_id == "workspace-1"

    delete_memory(record.id, context=context, service=memory_service)

    assert list_memory(context=context, service=memory_service).items == []


def test_memory_delete_is_tenant_isolated(
    memory_service: MemoryService,
    context: RequestContext,
) -> None:
    record = memory_service.create(
        CreateMemoryRequest(type=MemoryType.LEARNED_RULE, content="Regle locale"),
        context,
    )

    with pytest.raises(HTTPException) as exc:
        memory_service.delete(
            record.id,
            RequestContext(workspace_id="workspace-2", user_id="user-1"),
        )

    assert exc.value.status_code == 404


def test_feedback_endpoint_stores_feedback(
    memory_service: MemoryService,
    context: RequestContext,
) -> None:
    record = create_feedback(
        FeedbackRequest(
            content="Cette recommandation n'est pas utile",
            target="recommendation",
            rating=1,
        ),
        context=context,
        service=memory_service,
    )

    assert record.type == MemoryType.FEEDBACK
    assert record.metadata["rating"] == 1


def test_chat_remember_phrase_stores_memory(
    memory_service: MemoryService,
    context: RequestContext,
) -> None:
    response = asyncio.run(
        chat(
            ChatRequest(message="Souviens-toi que mon seuil minimum de PLA noir est 2kg"),
            context=context,
            plan=PlanContext(plan=Plan.FREE),
            service=memory_service,
        )
    )

    assert response.intent == "memory_saved"
    memories = memory_service.list(context)
    assert memories[0].type == MemoryType.PREFERENCE
    assert "PLA noir" in memories[0].content


def test_chat_preference_without_remember_keyword_stores_memory(
    memory_service: MemoryService,
    context: RequestContext,
) -> None:
    response = asyncio.run(
        chat(
            ChatRequest(message="je veux garder une reserve de 200g de PLA Matte AtomeBlue"),
            context=context,
            plan=PlanContext(plan=Plan.FREE),
            service=memory_service,
        )
    )

    assert response.intent == "memory_saved"
    memories = memory_service.list(context)
    assert memories[0].type == MemoryType.PREFERENCE
    assert "200g" in memories[0].content
    assert "pla" in memories[0].tags


def test_chat_correction_phrase_stores_memory(
    memory_service: MemoryService,
    context: RequestContext,
) -> None:
    response = asyncio.run(
        chat(
            ChatRequest(message="Non, ce projet consomme plutôt 1.2kg"),
            context=context,
            plan=PlanContext(plan=Plan.FREE),
            service=memory_service,
        )
    )

    assert response.intent == "memory_saved"
    assert memory_service.list(context)[0].type == MemoryType.CORRECTION


def test_chat_feedback_phrase_stores_memory(
    memory_service: MemoryService,
    context: RequestContext,
) -> None:
    response = asyncio.run(
        chat(
            ChatRequest(message="Cette recommandation n'est pas utile"),
            context=context,
            plan=PlanContext(plan=Plan.FREE),
            service=memory_service,
        )
    )

    assert response.intent == "memory_saved"
    assert memory_service.list(context)[0].type == MemoryType.FEEDBACK


def test_chat_uses_relevant_memory_in_future_answer(
    memory_service: MemoryService,
    context: RequestContext,
) -> None:
    memory_service.create(
        CreateMemoryRequest(
            type=MemoryType.PREFERENCE,
            content="Mon seuil minimum de PLA noir est 2kg",
            tags=["pla", "noir", "seuil"],
        ),
        context,
    )

    response = asyncio.run(
        chat(
            ChatRequest(message="Combien reste-t-il sur la bobine PLA noir ?"),
            context=context,
            plan=PlanContext(plan=Plan.FREE),
            service=memory_service,
        )
    )

    assert response.intent == "stock_summary"
    assert "Memoire pertinente utilisee" in response.answer
    assert "2kg" in response.answer


def test_memory_search_is_user_isolated(memory_service: MemoryService) -> None:
    context_a = RequestContext(workspace_id="workspace-1", user_id="user-1")
    context_b = RequestContext(workspace_id="workspace-1", user_id="user-2")
    memory_service.create(
        CreateMemoryRequest(type=MemoryType.PREFERENCE, content="PLA noir seuil 2kg"),
        context_a,
    )

    assert memory_service.search(context_a, "PLA noir")
    assert memory_service.search(context_b, "PLA noir") == []
