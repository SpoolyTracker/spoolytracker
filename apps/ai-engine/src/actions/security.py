from fastapi import HTTPException, status

from src.actions.models import AIAction, AIActionType, ProposeActionRequest
from src.security.context import RequestContext


REQUIRED_PAYLOAD_KEYS: dict[AIActionType, set[str]] = {
    AIActionType.CREATE_CONSUMPTION: {"filament_id", "amount_g"},
    AIActionType.UPDATE_STOCK_THRESHOLD: {"filament_id", "threshold"},
    AIActionType.CREATE_ALERT: {"alert_type", "message"},
    AIActionType.PROPOSE_SUPPLIER_ORDER: {"supplier", "items"},
    AIActionType.LINK_CONSUMPTION_TO_PROJECT: {"consumption_id", "project_id"},
    AIActionType.PREPARE_NOTIFICATION: {"channel", "recipient", "message"},
}


def validate_action_request(request: ProposeActionRequest) -> None:
    required = REQUIRED_PAYLOAD_KEYS[request.type]
    missing = sorted(key for key in required if key not in request.payload)
    if missing:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Payload incomplet pour ce type d'action.",
                "missing": missing,
            },
        )

    if request.type == AIActionType.CREATE_CONSUMPTION and request.payload.get("amount_g", 0) <= 0:
        raise HTTPException(
            status_code=422,
            detail="La consommation doit etre superieure a 0g.",
        )

    if request.type == AIActionType.UPDATE_STOCK_THRESHOLD and request.payload.get("threshold", -1) < 0:
        raise HTTPException(
            status_code=422,
            detail="Le seuil de stock ne peut pas etre negatif.",
        )


def assert_action_access(action: AIAction, context: RequestContext) -> None:
    if action.workspace_id != context.workspace_id or action.user_id != context.user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Action introuvable dans ce workspace pour cet utilisateur.",
        )
