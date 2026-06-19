import asyncio

from src.agents.free_assistant import FreeAssistantAgent, Intent
from src.api.routes.chat import capabilities, chat
from src.api.schemas import ChatRequest
from src.security.plan import Plan, PlanContext
from src.tools.models import StockItem


def _ask(message: str):
    return asyncio.run(FreeAssistantAgent().run(message))


def test_detects_stock_question_in_french() -> None:
    response = _ask("Quel est mon stock de filament ?")

    assert response.intent == Intent.STOCK_SUMMARY
    assert "bobines actives" in response.answer
    assert response.data is not None


def test_detects_specific_stock_item_in_french() -> None:
    response = _ask("Combien reste-t-il sur la bobine PLA noir ?")

    assert response.intent == Intent.STOCK_SUMMARY
    assert "PLA noir BambuLab" in response.answer
    assert "740g" in response.answer


def test_detects_low_stock_in_french() -> None:
    response = _ask("Quelles bobines sont presque vides ou en stock faible ?")

    assert response.intent == Intent.LOW_STOCK
    assert "PETG rouge" in response.answer
    assert "PLA blanc" in response.answer


def test_detects_consumption_entry_and_only_proposes_action() -> None:
    response = _ask("J'ai consommé 50g de PLA noir pour une impression.")

    assert response.intent == Intent.CONSUMPTION_ENTRY
    assert response.requires_confirmation is True
    assert response.proposed_actions[0]["type"] == "create_consumption"
    assert "Aucune donnee n'a ete modifiee" in response.answer


def test_consumption_matching_keeps_white_and_black_distinct() -> None:
    response = asyncio.run(
        FreeAssistantAgent().run(
            "Ajoute une consommation de 250g de PETG blanc",
            context={
                "data_source": "main_api",
                "stock_items": [
                    StockItem(
                        id="petg-black",
                        name="PETG Black",
                        brand="Generic",
                        material="PETG",
                        color="Black",
                        weight_initial_g=1000,
                        weight_remaining_g=700,
                    ),
                    StockItem(
                        id="petg-white",
                        name="PETG White",
                        brand="Generic",
                        material="PETG",
                        color="White",
                        weight_initial_g=1000,
                        weight_remaining_g=650,
                    ),
                ],
                "projects": [],
            },
        )
    )

    assert response.intent == Intent.CONSUMPTION_ENTRY
    assert response.proposed_actions[0]["payload"]["filament_id"] == "petg-white"


def test_consumption_matching_refuses_wrong_color_when_requested_color_is_missing() -> None:
    response = asyncio.run(
        FreeAssistantAgent().run(
            "Ajoute une consommation de 250g de PETG blanc",
            context={
                "data_source": "main_api",
                "stock_items": [
                    StockItem(
                        id="petg-black",
                        name="PETG Black",
                        brand="Generic",
                        material="PETG",
                        color="Black",
                        weight_initial_g=1000,
                        weight_remaining_g=700,
                    ),
                ],
                "projects": [],
            },
        )
    )

    assert response.intent == Intent.CONSUMPTION_ENTRY
    assert response.requires_confirmation is False
    assert response.proposed_actions == []
    assert "exactement a la matiere et a la couleur" in response.answer


def test_consumption_matching_asks_for_precision_when_multiple_brands_match() -> None:
    response = asyncio.run(
        FreeAssistantAgent().run(
            "Ajoute une consommation de 250g de PETG blanc",
            context={
                "data_source": "main_api",
                "stock_items": [
                    StockItem(
                        id="petg-white-a",
                        name="PETG White",
                        brand="BambuLab",
                        material="PETG",
                        color="White",
                        weight_initial_g=1000,
                        weight_remaining_g=650,
                    ),
                    StockItem(
                        id="petg-white-b",
                        name="PETG White",
                        brand="Prusament",
                        material="PETG",
                        color="White",
                        weight_initial_g=1000,
                        weight_remaining_g=500,
                    ),
                ],
                "projects": [],
            },
        )
    )

    assert response.intent == Intent.CONSUMPTION_ENTRY
    assert response.requires_confirmation is False
    assert response.proposed_actions == []
    assert "plusieurs bobines possibles" in response.answer
    assert "BambuLab" in response.answer
    assert "Prusament" in response.answer


def test_consumption_with_missing_project_proposes_project_creation() -> None:
    response = asyncio.run(
        FreeAssistantAgent().run(
            "Ajoute une consommation de 250g de PETG blanc pour le projet Support mural",
            context={
                "data_source": "main_api",
                "stock_items": [
                    StockItem(
                        id="petg-white",
                        name="PETG White",
                        brand="Generic",
                        material="PETG",
                        color="White",
                        weight_initial_g=1000,
                        weight_remaining_g=650,
                    ),
                ],
                "projects": [],
            },
        )
    )

    assert response.intent == Intent.CONSUMPTION_ENTRY
    assert response.proposed_actions[0]["type"] == "create_consumption"
    assert response.proposed_actions[0]["payload"]["pending_project_name"] == "Support mural"
    assert response.proposed_actions[1]["type"] == "create_project"
    assert response.proposed_actions[1]["payload"]["name"] == "Support mural"
    assert response.proposed_actions[1]["payload"]["filament_id"] == "petg-white"
    assert response.proposed_actions[1]["payload"]["amount_g"] == 250
    assert "assistant Spooly" in response.proposed_actions[1]["payload"]["description"]


def test_detects_project_question_in_french() -> None:
    response = _ask("Le projet Drone FPV est-il faisable avec mon stock ?")

    assert response.intent == Intent.PROJECT_QUESTION
    assert "Drone FPV" in response.answer
    assert "l'estimation est" in response.answer


def test_detects_general_question_in_french() -> None:
    response = _ask("Bonjour, que peux-tu faire ?")

    assert response.intent == Intent.GENERAL_QUESTION
    assert "assistant IA Free" in response.answer


def test_chat_endpoint_returns_pydantic_response() -> None:
    response = asyncio.run(
        chat(
            ChatRequest(message="Montre-moi le stock faible"),
            context=None,
            plan=PlanContext(plan=Plan.FREE),
        )
    )

    assert response.intent == Intent.LOW_STOCK
    assert response.requires_confirmation is False


def test_detects_calibration_and_computes_volumetric_flow() -> None:
    response = _ask(
        "Calibration du debit volumetrique max: depart 5, max 20, pas 0.5, hauteur propre 22 mm"
    )

    assert response.intent == Intent.CALIBRATION
    # observed = min(5 + 22 * 0.5, 20) = 16 ; recommended = 16 * 95% = 15.2
    assert response.data["observed_mm3_s"] == 16.0
    assert response.data["recommended_mm3_s"] == 15.2
    assert response.data["tower_height_mm"] == 30.0


def test_calibration_bounds_observed_to_test_maximum() -> None:
    # hauteur propre tres haute -> observe doit etre borne au max du test
    response = _ask(
        "debit volumetrique depart 5 max 12 pas 0.5 hauteur propre 40"
    )

    assert response.intent == Intent.CALIBRATION
    assert response.data["observed_mm3_s"] == 12.0


def test_calibration_proposes_action_when_single_filament_in_context() -> None:
    response = asyncio.run(
        FreeAssistantAgent().run(
            "debit volumetrique depart 5 max 20 pas 0.5 hauteur propre 22",
            context={
                "data_source": "main_api",
                "active_context": {"mode": "calibration", "filament_ids": ["pla-black"]},
                "stock_items": [
                    StockItem(
                        id="pla-black",
                        name="PLA Black",
                        brand="BambuLab",
                        material="PLA",
                        color="Black",
                        weight_initial_g=1000,
                        weight_remaining_g=740,
                    ),
                ],
                "projects": [],
            },
        )
    )

    assert response.intent == Intent.CALIBRATION
    assert response.requires_confirmation is True
    action = response.proposed_actions[0]
    assert action["type"] == "update_filament_calibration"
    assert action["payload"]["filament_id"] == "pla-black"
    assert action["payload"]["max_volumetric_speed_mm3_s"] == 15.2


def test_capabilities_lists_calibration() -> None:
    response = capabilities()
    intent_names = {intent.name for intent in response.intents}

    assert "calibration" in intent_names


def test_capabilities_lists_free_tools() -> None:
    response = capabilities()
    tool_names = {tool.name for tool in response.tools}

    assert response.tier == "free"
    assert "get_stock_summary" in tool_names
    assert "create_consumption_proposal" in tool_names
