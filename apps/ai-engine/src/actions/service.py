from datetime import datetime, timezone

from fastapi import HTTPException, status

from src.actions.models import (
    AIAction,
    AIActionStatus,
    ActionDecisionResponse,
    AuditEvent,
    AuditLogEntry,
    ProposeActionRequest,
)
from src.actions.security import assert_action_access, validate_action_request
from src.actions.store import InMemoryActionStore, action_store
from src.security.context import RequestContext


class AIActionService:
    def __init__(self, store: InMemoryActionStore = action_store) -> None:
        self.store = store

    def propose(self, request: ProposeActionRequest, context: RequestContext) -> AIAction:
        validate_action_request(request)
        action = AIAction(
            type=request.type,
            title=request.title,
            payload=request.payload,
            workspace_id=context.workspace_id,
            user_id=context.user_id,
        )
        self.store.save_action(action)
        self._audit(
            action=action,
            event=AuditEvent.PROPOSED,
            user_id=context.user_id,
            message="Action proposee par le moteur IA.",
        )
        return action

    def approve(self, action_id: str, context: RequestContext) -> ActionDecisionResponse:
        action = self._get_accessible_action(action_id, context)
        if action.status != AIActionStatus.PROPOSED:
            self._audit(
                action=action,
                event=AuditEvent.DENIED,
                user_id=context.user_id,
                message="Approbation refusee: statut incompatible.",
                metadata={"current_status": action.status},
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"L'action ne peut pas etre approuvee depuis le statut {action.status}.",
            )

        action.status = AIActionStatus.APPROVED
        action.updated_at = datetime.now(timezone.utc)
        self.store.save_action(action)
        self._audit(
            action=action,
            event=AuditEvent.APPROVED,
            user_id=context.user_id,
            message="Action approuvee par l'utilisateur.",
        )

        self._execute_mock(action, context)
        return ActionDecisionResponse(
            action=action,
            audit_log=self.store.get_audit_for_action(action.id),
        )

    def reject(self, action_id: str, context: RequestContext) -> ActionDecisionResponse:
        action = self._get_accessible_action(action_id, context)
        if action.status != AIActionStatus.PROPOSED:
            self._audit(
                action=action,
                event=AuditEvent.DENIED,
                user_id=context.user_id,
                message="Rejet refuse: statut incompatible.",
                metadata={"current_status": action.status},
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"L'action ne peut pas etre rejetee depuis le statut {action.status}.",
            )

        action.status = AIActionStatus.REJECTED
        action.updated_at = datetime.now(timezone.utc)
        self.store.save_action(action)
        self._audit(
            action=action,
            event=AuditEvent.REJECTED,
            user_id=context.user_id,
            message="Action rejetee par l'utilisateur.",
        )
        return ActionDecisionResponse(
            action=action,
            audit_log=self.store.get_audit_for_action(action.id),
        )

    def _get_accessible_action(self, action_id: str, context: RequestContext) -> AIAction:
        action = self.store.get_action(action_id)
        if action is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action introuvable.")
        assert_action_access(action, context)
        return action

    def _execute_mock(self, action: AIAction, context: RequestContext) -> None:
        try:
            action.status = AIActionStatus.EXECUTED
            action.execution_result = {
                "mode": "mock",
                "message": "Execution mockee realisee sans modification persistante.",
            }
            action.updated_at = datetime.now(timezone.utc)
            self.store.save_action(action)
            self._audit(
                action=action,
                event=AuditEvent.EXECUTED,
                user_id=context.user_id,
                message="Action executee en mode mock.",
                metadata={"type": action.type},
            )
        except Exception as exc:
            action.status = AIActionStatus.FAILED
            action.failure_reason = str(exc)
            action.updated_at = datetime.now(timezone.utc)
            self.store.save_action(action)
            self._audit(
                action=action,
                event=AuditEvent.FAILED,
                user_id=context.user_id,
                message="Execution mockee echouee.",
                metadata={"error": str(exc)},
            )

    def _audit(
        self,
        action: AIAction,
        event: AuditEvent,
        user_id: str,
        message: str,
        metadata: dict | None = None,
    ) -> AuditLogEntry:
        return self.store.append_audit(
            AuditLogEntry(
                action_id=action.id,
                event=event,
                workspace_id=action.workspace_id,
                user_id=user_id,
                message=message,
                metadata=metadata or {},
            ),
        )


action_service = AIActionService()
