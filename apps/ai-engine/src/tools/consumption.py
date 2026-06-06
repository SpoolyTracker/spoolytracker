import re

from src.tools.mock_data import MOCK_PROJECTS
from src.tools.models import (
    ConsumptionProposalRequest,
    ConsumptionProposalResponse,
    ProposedAction,
    StockItemRequest,
)
from src.tools.stock import get_stock_item


def _extract_amount_g(message: str) -> float | None:
    match = re.search(r"(\d+(?:[,.]\d+)?)\s*(g|gr|grammes|kg)\b", message.lower())
    if not match:
        return None

    value = float(match.group(1).replace(",", "."))
    unit = match.group(2)
    return value * 1000 if unit == "kg" else value


def _extract_filament_query(message: str) -> str:
    tokens = []
    for candidate in ["pla", "petg", "abs", "tpu", "noir", "rouge", "blanc", "bambulab", "prusament"]:
        if candidate in message.lower():
            tokens.append(candidate)
    return " ".join(tokens)


def _extract_project_id(message: str) -> str | None:
    normalized = message.lower()
    for project in MOCK_PROJECTS:
        if project.name.lower() in normalized:
            return project.id
    for project in MOCK_PROJECTS:
        tokens = [token for token in project.name.lower().split() if len(token) > 3]
        if tokens and all(token in normalized for token in tokens):
            return project.id
    return None


def create_consumption_proposal(
    request: ConsumptionProposalRequest,
) -> ConsumptionProposalResponse:
    amount_g = request.amount_g or _extract_amount_g(request.user_message)
    filament_query = request.filament_query or _extract_filament_query(request.user_message)
    item = get_stock_item(StockItemRequest(query=filament_query)).item if filament_query else None
    project_id = _extract_project_id(request.user_message)

    if amount_g is None:
        return ConsumptionProposalResponse(
            item=item,
            amount_g=None,
            action=None,
            message="Je peux preparer la saisie, mais il me manque la quantite en grammes.",
        )

    if item is None:
        return ConsumptionProposalResponse(
            item=None,
            amount_g=amount_g,
            action=None,
            message="Je peux preparer la saisie, mais je n'ai pas identifie la bobine concernee.",
        )

    remaining_before_g = item.weight_remaining_g
    remaining_after_g = max(remaining_before_g - amount_g, 0)
    warning = ""
    if amount_g > remaining_before_g:
        warning = (
            f"\n\nAttention: la quantite demandee depasse le stock restant "
            f"de {amount_g - remaining_before_g:g}g."
        )

    return ConsumptionProposalResponse(
        item=item,
        amount_g=amount_g,
        action=ProposedAction(
            type="create_consumption",
            label=(
                f"Enregistrer {amount_g:g}g consommes sur {item.name} "
                f"({remaining_after_g:g}g restants)"
            ),
            payload={
                "filament_id": item.id,
                "amount_g": amount_g,
                "type": "PRINT",
                **({"project_id": project_id} if project_id else {}),
            },
        ),
        message=(
            f"Je propose d'enregistrer {amount_g:g}g de consommation sur {item.name}. "
            f"La bobine contient actuellement {remaining_before_g:g}g; "
            f"il resterait {remaining_after_g:g}g apres validation. "
            "Aucune donnee n'a ete modifiee."
            f"{warning}"
        ),
    )
