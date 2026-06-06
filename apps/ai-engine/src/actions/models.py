from datetime import datetime, timezone
from enum import StrEnum
from uuid import uuid4

from pydantic import BaseModel, Field


class AIActionStatus(StrEnum):
    PROPOSED = "proposed"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXECUTED = "executed"
    FAILED = "failed"


class AIActionType(StrEnum):
    CREATE_CONSUMPTION = "create_consumption"
    UPDATE_STOCK_THRESHOLD = "update_stock_threshold"
    CREATE_ALERT = "create_alert"
    PROPOSE_SUPPLIER_ORDER = "propose_supplier_order"
    LINK_CONSUMPTION_TO_PROJECT = "link_consumption_to_project"
    PREPARE_NOTIFICATION = "prepare_notification"


class AIAction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    type: AIActionType
    status: AIActionStatus = AIActionStatus.PROPOSED
    title: str = Field(min_length=1, max_length=200)
    payload: dict
    workspace_id: str = Field(min_length=1)
    user_id: str = Field(min_length=1)
    requires_approval: bool = True
    execution_result: dict | None = None
    failure_reason: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AuditEvent(StrEnum):
    PROPOSED = "action.proposed"
    APPROVED = "action.approved"
    REJECTED = "action.rejected"
    EXECUTED = "action.executed"
    FAILED = "action.failed"
    DENIED = "action.denied"


class AuditLogEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    action_id: str
    event: AuditEvent
    workspace_id: str
    user_id: str
    message: str
    metadata: dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProposeActionRequest(BaseModel):
    type: AIActionType
    title: str = Field(min_length=1, max_length=200)
    payload: dict = Field(default_factory=dict)


class ActionDecisionResponse(BaseModel):
    action: AIAction
    audit_log: list[AuditLogEntry]
