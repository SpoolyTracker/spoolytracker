import asyncio

from src.api.routes.chat import chat
from src.api.schemas import ChatRequest
from src.memory.service import MemoryService
from src.memory.store import InMemoryStore
from src.security.context import RequestContext
from src.security.plan import Plan, PlanContext


def test_demo_1_remaining_pla_black_stock() -> None:
    response = asyncio.run(
        chat(
            ChatRequest(message="Combien il me reste de PLA noir ?"),
            context=None,
            plan=PlanContext(plan=Plan.FREE),
        )
    )

    assert response.intent == "stock_summary"
    assert "PLA noir BambuLab" in response.answer
    assert "740g" in response.answer


def test_demo_2_consumption_for_project_is_only_proposed() -> None:
    response = asyncio.run(
        chat(
            ChatRequest(
                message="Ajoute une consommation de 250g de PETG blanc pour le projet Support mural"
            ),
            context=None,
            plan=PlanContext(plan=Plan.FREE),
        )
    )

    assert response.intent == "consumption_entry"
    assert response.requires_confirmation is True
    assert response.proposed_actions[0]["type"] == "create_consumption"
    assert response.proposed_actions[0]["payload"]["filament_id"] == "fil-petg-blanc"
    assert response.proposed_actions[0]["payload"]["project_id"] == "proj-support"
    assert "Aucune donnee n'a ete modifiee" in response.answer


def test_demo_3_pro_stock_risks() -> None:
    response = asyncio.run(
        chat(
            ChatRequest(message="Quels stocks sont à risque ?"),
            context=RequestContext(workspace_id="demo-workspace", user_id="demo-user"),
            plan=PlanContext(plan=Plan.PRO),
        )
    )

    assert response.intent == "pro_risks"
    assert response.data is not None
    assert response.data["material_risks"]


def test_demo_4_project_launch_feasibility() -> None:
    response = asyncio.run(
        chat(
            ChatRequest(message="Est-ce que je peux lancer le projet Boîtier électronique ?"),
            context=None,
            plan=PlanContext(plan=Plan.FREE),
        )
    )

    assert response.intent == "project_question"
    assert "Boitier electronique" in response.answer
    assert "l'estimation est" in response.answer
    assert "Source des donnees" in response.answer


def test_demo_5_remember_user_preference() -> None:
    service = MemoryService(InMemoryStore())
    context = RequestContext(workspace_id="demo-workspace", user_id="demo-user")

    response = asyncio.run(
        chat(
            ChatRequest(
                message="Souviens-toi que je veux toujours garder 2kg minimum de PLA noir"
            ),
            context=context,
            plan=PlanContext(plan=Plan.FREE),
            service=service,
        )
    )

    assert response.intent == "memory_saved"
    memories = service.list(context)
    assert len(memories) == 1
    assert "2kg minimum de PLA noir" in memories[0].content
