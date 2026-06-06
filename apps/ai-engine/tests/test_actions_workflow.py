import pytest
from fastapi import HTTPException

from src.actions.models import (
    AIActionStatus,
    AIActionType,
    AuditEvent,
    ProposeActionRequest,
)
from src.actions.service import AIActionService
from src.actions.store import InMemoryActionStore
from src.api.routes.actions import approve_action, propose_action, reject_action
from src.security.context import RequestContext


@pytest.fixture()
def service() -> AIActionService:
    return AIActionService(InMemoryActionStore())


@pytest.fixture()
def context() -> RequestContext:
    return RequestContext(workspace_id="workspace-1", user_id="user-1")


def test_create_consumption_action_full_approve_workflow(
    service: AIActionService,
    context: RequestContext,
) -> None:
    action = service.propose(
        ProposeActionRequest(
            type=AIActionType.CREATE_CONSUMPTION,
            title="Enregistrer 50g de PLA noir",
            payload={"filament_id": "fil-pla-noir", "amount_g": 50},
        ),
        context,
    )

    assert action.status == AIActionStatus.PROPOSED
    assert action.workspace_id == "workspace-1"
    assert action.user_id == "user-1"

    result = service.approve(action.id, context)

    assert result.action.status == AIActionStatus.EXECUTED
    assert result.action.execution_result is not None
    assert result.action.execution_result["mode"] == "mock"
    assert [entry.event for entry in result.audit_log] == [
        AuditEvent.PROPOSED,
        AuditEvent.APPROVED,
        AuditEvent.EXECUTED,
    ]


def test_reject_workflow_keeps_action_unexecuted(
    service: AIActionService,
    context: RequestContext,
) -> None:
    action = service.propose(
        ProposeActionRequest(
            type=AIActionType.CREATE_ALERT,
            title="Creer une alerte stock faible",
            payload={"alert_type": "low_stock", "message": "PLA blanc presque vide"},
        ),
        context,
    )

    result = service.reject(action.id, context)

    assert result.action.status == AIActionStatus.REJECTED
    assert result.action.execution_result is None
    assert [entry.event for entry in result.audit_log] == [
        AuditEvent.PROPOSED,
        AuditEvent.REJECTED,
    ]


@pytest.mark.parametrize(
    ("action_type", "payload"),
    [
        (
            AIActionType.UPDATE_STOCK_THRESHOLD,
            {"filament_id": "fil-pla-noir", "threshold": 150},
        ),
        (
            AIActionType.PROPOSE_SUPPLIER_ORDER,
            {"supplier": "BambuLab", "items": [{"sku": "PLA-BLK", "quantity": 2}]},
        ),
        (
            AIActionType.LINK_CONSUMPTION_TO_PROJECT,
            {"consumption_id": "cons-1", "project_id": "proj-drone"},
        ),
        (
            AIActionType.PREPARE_NOTIFICATION,
            {"channel": "email", "recipient": "user@example.com", "message": "Stock faible"},
        ),
    ],
)
def test_supported_sensitive_actions_can_be_proposed(
    service: AIActionService,
    context: RequestContext,
    action_type: AIActionType,
    payload: dict,
) -> None:
    action = service.propose(
        ProposeActionRequest(type=action_type, title=f"Action {action_type}", payload=payload),
        context,
    )

    assert action.type == action_type
    assert action.status == AIActionStatus.PROPOSED
    assert action.requires_approval is True


def test_isolation_by_workspace_and_user(service: AIActionService, context: RequestContext) -> None:
    action = service.propose(
        ProposeActionRequest(
            type=AIActionType.CREATE_CONSUMPTION,
            title="Enregistrer 20g",
            payload={"filament_id": "fil-pla-noir", "amount_g": 20},
        ),
        context,
    )

    with pytest.raises(HTTPException) as exc:
        service.approve(
            action.id,
            RequestContext(workspace_id="workspace-2", user_id="user-1"),
        )
    assert exc.value.status_code == 404

    with pytest.raises(HTTPException) as exc:
        service.approve(
            action.id,
            RequestContext(workspace_id="workspace-1", user_id="user-2"),
        )
    assert exc.value.status_code == 404


def test_invalid_payload_is_rejected(service: AIActionService, context: RequestContext) -> None:
    with pytest.raises(HTTPException) as exc:
        service.propose(
            ProposeActionRequest(
                type=AIActionType.CREATE_CONSUMPTION,
                title="Consommation incomplete",
                payload={"filament_id": "fil-pla-noir"},
            ),
            context,
        )

    assert exc.value.status_code == 422


def test_approved_action_cannot_be_rejected_after_execution(
    service: AIActionService,
    context: RequestContext,
) -> None:
    action = service.propose(
        ProposeActionRequest(
            type=AIActionType.PREPARE_NOTIFICATION,
            title="Preparer une notification",
            payload={"channel": "email", "recipient": "user@example.com", "message": "Bonjour"},
        ),
        context,
    )
    service.approve(action.id, context)

    with pytest.raises(HTTPException) as exc:
        service.reject(action.id, context)

    assert exc.value.status_code == 409


def test_action_route_handlers_use_context_and_service(
    service: AIActionService,
    context: RequestContext,
) -> None:
    action = propose_action(
        ProposeActionRequest(
            type=AIActionType.UPDATE_STOCK_THRESHOLD,
            title="Modifier le seuil",
            payload={"filament_id": "fil-pla-noir", "threshold": 100},
        ),
        context=context,
        service=service,
    )

    approved = approve_action(action.id, context=context, service=service)

    assert approved.action.status == AIActionStatus.EXECUTED


def test_reject_route_handler(
    service: AIActionService,
    context: RequestContext,
) -> None:
    action = propose_action(
        ProposeActionRequest(
            type=AIActionType.PROPOSE_SUPPLIER_ORDER,
            title="Commander du filament",
            payload={"supplier": "Prusament", "items": [{"sku": "PETG-RED", "quantity": 1}]},
        ),
        context=context,
        service=service,
    )

    rejected = reject_action(action.id, context=context, service=service)

    assert rejected.action.status == AIActionStatus.REJECTED
