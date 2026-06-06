from src.actions.models import AIAction, AuditLogEntry


class InMemoryActionStore:
    def __init__(self) -> None:
        self._actions: dict[str, AIAction] = {}
        self._audit_logs: list[AuditLogEntry] = []

    def save_action(self, action: AIAction) -> AIAction:
        self._actions[action.id] = action
        return action

    def get_action(self, action_id: str) -> AIAction | None:
        return self._actions.get(action_id)

    def append_audit(self, entry: AuditLogEntry) -> AuditLogEntry:
        self._audit_logs.append(entry)
        return entry

    def get_audit_for_action(self, action_id: str) -> list[AuditLogEntry]:
        return [entry for entry in self._audit_logs if entry.action_id == action_id]

    def clear(self) -> None:
        self._actions.clear()
        self._audit_logs.clear()


action_store = InMemoryActionStore()
