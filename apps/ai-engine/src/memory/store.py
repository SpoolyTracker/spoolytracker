from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Protocol

from src.core.config import get_settings
from src.memory.models import MemoryRecord, MemoryType


class MemoryStore(Protocol):
    def add(self, record: MemoryRecord) -> MemoryRecord:
        ...

    def list(self, workspace_id: str, user_id: str, memory_type: MemoryType | None = None) -> list[MemoryRecord]:
        ...

    def delete(self, memory_id: str, workspace_id: str, user_id: str) -> bool:
        ...

    def search(self, workspace_id: str, user_id: str, query: str, limit: int = 5) -> list[MemoryRecord]:
        ...


class SQLiteMemoryStore:
    """Local SQLite-backed memory store, intentionally swappable for vectors later."""

    def __init__(self, db_path: str | Path | None = None) -> None:
        self.db_path = Path(db_path or get_settings().memory_db_path)
        self._init_db()

    def add(self, record: MemoryRecord) -> MemoryRecord:
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO memories (
                    id, workspace_id, user_id, type, content, tags, metadata, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record.id,
                    record.workspace_id,
                    record.user_id,
                    record.type,
                    record.content,
                    json.dumps(record.tags),
                    json.dumps(record.metadata),
                    record.created_at.isoformat(),
                    record.updated_at.isoformat(),
                ),
            )
        return record

    def list(
        self,
        workspace_id: str,
        user_id: str,
        memory_type: MemoryType | None = None,
    ) -> list[MemoryRecord]:
        sql = "SELECT * FROM memories WHERE workspace_id = ? AND user_id = ?"
        params: list[str] = [workspace_id, user_id]
        if memory_type:
            sql += " AND type = ?"
            params.append(memory_type)
        sql += " ORDER BY created_at DESC"

        with self._connect() as conn:
            rows = conn.execute(sql, params).fetchall()
        return [self._row_to_record(row) for row in rows]

    def delete(self, memory_id: str, workspace_id: str, user_id: str) -> bool:
        with self._connect() as conn:
            cursor = conn.execute(
                "DELETE FROM memories WHERE id = ? AND workspace_id = ? AND user_id = ?",
                (memory_id, workspace_id, user_id),
            )
        return cursor.rowcount > 0

    def search(
        self,
        workspace_id: str,
        user_id: str,
        query: str,
        limit: int = 5,
    ) -> list[MemoryRecord]:
        tokens = [token for token in query.lower().replace("'", " ").split() if len(token) >= 3]
        records = self.list(workspace_id=workspace_id, user_id=user_id)
        scored: list[tuple[int, MemoryRecord]] = []
        for record in records:
            haystack = " ".join([record.content, " ".join(record.tags)]).lower()
            score = sum(1 for token in tokens if token in haystack)
            if score > 0:
                scored.append((score, record))

        scored.sort(key=lambda item: (item[0], item[1].created_at), reverse=True)
        return [record for _, record in scored[:limit]]

    def _init_db(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS memories (
                    id TEXT PRIMARY KEY,
                    workspace_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    type TEXT NOT NULL,
                    content TEXT NOT NULL,
                    tags TEXT NOT NULL,
                    metadata TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_memories_tenant
                ON memories (workspace_id, user_id, type, created_at)
                """
            )

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _row_to_record(self, row: sqlite3.Row) -> MemoryRecord:
        return MemoryRecord(
            id=row["id"],
            workspace_id=row["workspace_id"],
            user_id=row["user_id"],
            type=MemoryType(row["type"]),
            content=row["content"],
            tags=json.loads(row["tags"]),
            metadata=json.loads(row["metadata"]),
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
        )


class InMemoryStore:
    def __init__(self) -> None:
        self._records: dict[str, MemoryRecord] = {}

    def add(self, record: MemoryRecord) -> MemoryRecord:
        self._records[record.id] = record
        return record

    def list(
        self,
        workspace_id: str,
        user_id: str,
        memory_type: MemoryType | None = None,
    ) -> list[MemoryRecord]:
        records = [
            record
            for record in self._records.values()
            if record.workspace_id == workspace_id and record.user_id == user_id
        ]
        if memory_type:
            records = [record for record in records if record.type == memory_type]
        return sorted(records, key=lambda record: record.created_at, reverse=True)

    def delete(self, memory_id: str, workspace_id: str, user_id: str) -> bool:
        record = self._records.get(memory_id)
        if not record or record.workspace_id != workspace_id or record.user_id != user_id:
            return False
        del self._records[memory_id]
        return True

    def search(
        self,
        workspace_id: str,
        user_id: str,
        query: str,
        limit: int = 5,
    ) -> list[MemoryRecord]:
        tokens = [token for token in query.lower().replace("'", " ").split() if len(token) >= 3]
        matches = []
        for record in self.list(workspace_id, user_id):
            haystack = " ".join([record.content, " ".join(record.tags)]).lower()
            score = sum(1 for token in tokens if token in haystack)
            if score:
                matches.append((score, record))
        matches.sort(key=lambda item: (item[0], item[1].created_at), reverse=True)
        return [record for _, record in matches[:limit]]


memory_store = SQLiteMemoryStore()
