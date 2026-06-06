from fastapi import APIRouter, Depends

from src.actions.models import AIAction, ActionDecisionResponse, ProposeActionRequest
from src.actions.service import AIActionService, action_service
from src.security.context import RequestContext, get_request_context

router = APIRouter(prefix="/actions", tags=["actions"])


def get_action_service() -> AIActionService:
    return action_service


@router.post("/propose", response_model=AIAction)
def propose_action(
    request: ProposeActionRequest,
    context: RequestContext = Depends(get_request_context),
    service: AIActionService = Depends(get_action_service),
) -> AIAction:
    return service.propose(request, context)


@router.post("/{action_id}/approve", response_model=ActionDecisionResponse)
def approve_action(
    action_id: str,
    context: RequestContext = Depends(get_request_context),
    service: AIActionService = Depends(get_action_service),
) -> ActionDecisionResponse:
    return service.approve(action_id, context)


@router.post("/{action_id}/reject", response_model=ActionDecisionResponse)
def reject_action(
    action_id: str,
    context: RequestContext = Depends(get_request_context),
    service: AIActionService = Depends(get_action_service),
) -> ActionDecisionResponse:
    return service.reject(action_id, context)
