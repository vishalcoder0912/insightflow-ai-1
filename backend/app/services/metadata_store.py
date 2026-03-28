"""Metadata store backed by SQLite for dataset and chat persistence."""

from __future__ import annotations

import json
import logging
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from threading import RLock
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)


class MetadataStore:
    """Persist lightweight app metadata in a local SQLite database."""

    def __init__(self) -> None:
        data_dir = Path(settings.data_dir)
        data_dir.mkdir(parents=True, exist_ok=True)
        self._db_path = data_dir / "metadata.db"
        self._lock = RLock()
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(str(self._db_path), check_same_thread=False)

    def _initialize(self) -> None:
        with self._lock:
            with self._connect() as conn:
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS dataset_state (
                        id TEXT PRIMARY KEY,
                        payload TEXT NOT NULL,
                        updated_at TEXT NOT NULL
                    )
                    """
                )
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS chat_logs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        created_at TEXT NOT NULL,
                        user_message TEXT NOT NULL,
                        response_text TEXT NOT NULL,
                        sql_text TEXT NOT NULL,
                        source TEXT NOT NULL,
                        rows_returned INTEGER NOT NULL DEFAULT 0
                    )
                    """
                )

    def save_dataset(self, dataset_id: str, payload: dict[str, Any]) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self._lock:
            with self._connect() as conn:
                conn.execute(
                    """
                    INSERT INTO dataset_state (id, payload, updated_at)
                    VALUES (?, ?, ?)
                    ON CONFLICT(id) DO UPDATE
                    SET payload = excluded.payload, updated_at = excluded.updated_at
                    """,
                    (dataset_id, json.dumps(payload), now),
                )

    def get_dataset(self, dataset_id: str) -> dict[str, Any] | None:
        with self._lock:
            with self._connect() as conn:
                row = conn.execute(
                    "SELECT payload FROM dataset_state WHERE id = ?",
                    (dataset_id,),
                ).fetchone()
        if not row:
            return None
        try:
            return json.loads(row[0])
        except json.JSONDecodeError:
            logger.warning("Invalid dataset JSON payload in metadata DB.")
            return None

    def clear_dataset(self, dataset_id: str) -> None:
        with self._lock:
            with self._connect() as conn:
                conn.execute("DELETE FROM dataset_state WHERE id = ?", (dataset_id,))

    def log_chat(
        self,
        *,
        user_message: str,
        response_text: str,
        sql_text: str,
        source: str,
        rows_returned: int,
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self._lock:
            with self._connect() as conn:
                conn.execute(
                    """
                    INSERT INTO chat_logs (
                        created_at, user_message, response_text, sql_text, source, rows_returned
                    ) VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (now, user_message, response_text, sql_text, source, rows_returned),
                )

    def get_recent_chats(self, limit: int = 20) -> list[dict[str, Any]]:
        safe_limit = max(1, min(limit, 200))
        with self._lock:
            with self._connect() as conn:
                rows = conn.execute(
                    """
                    SELECT id, created_at, user_message, response_text, sql_text, source, rows_returned
                    FROM chat_logs
                    ORDER BY id DESC
                    LIMIT ?
                    """,
                    (safe_limit,),
                ).fetchall()

        return [
            {
                "id": row[0],
                "created_at": row[1],
                "user_message": row[2],
                "response_text": row[3],
                "sql_text": row[4],
                "source": row[5],
                "rows_returned": row[6],
            }
            for row in rows
        ]

    def status(self) -> dict[str, Any]:
        with self._lock:
            with self._connect() as conn:
                dataset_count = conn.execute("SELECT COUNT(*) FROM dataset_state").fetchone()[0]
                chat_count = conn.execute("SELECT COUNT(*) FROM chat_logs").fetchone()[0]
                last_dataset_row = conn.execute(
                    "SELECT updated_at FROM dataset_state ORDER BY updated_at DESC LIMIT 1"
                ).fetchone()

        return {
            "backend": "sqlite",
            "db_path": str(self._db_path),
            "dataset_count": int(dataset_count),
            "chat_count": int(chat_count),
            "last_dataset_update": last_dataset_row[0] if last_dataset_row else None,
        }


metadata_store = MetadataStore()
