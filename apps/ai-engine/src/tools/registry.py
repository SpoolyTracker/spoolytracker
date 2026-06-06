from collections.abc import Awaitable, Callable
from typing import Any

from pydantic import BaseModel, ConfigDict


ToolHandler = Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]


class ToolDefinition(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    name: str
    description: str
    handler: ToolHandler


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, ToolDefinition] = {}

    def register(self, tool: ToolDefinition) -> None:
        self._tools[tool.name] = tool

    def get(self, name: str) -> ToolDefinition | None:
        return self._tools.get(name)

    def list(self) -> list[ToolDefinition]:
        return list(self._tools.values())
