import sqlite3
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

DB_SCHEMA = """
CREATE TABLE IF NOT EXISTS boards (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    data TEXT NOT NULL,
    created_at TEXT,
    updated_at TEXT
);
"""


def init_db(db_path: Path):
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.execute(DB_SCHEMA)
    conn.commit()
    conn.close()


def _connect(db_path: Path):
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    return conn


def get_board(db_path: Path, user_id: str) -> Optional[dict]:
    conn = _connect(db_path)
    cur = conn.execute("SELECT data FROM boards WHERE user_id = ?", (user_id,))
    row = cur.fetchone()
    conn.close()
    if not row:
        return None
    return json.loads(row["data"])


def save_board(db_path: Path, user_id: str, board: dict):
    now = datetime.now(timezone.utc).isoformat()
    conn = _connect(db_path)
    cur = conn.execute("SELECT created_at FROM boards WHERE user_id = ?", (user_id,))
    existing = cur.fetchone()
    created_at = existing["created_at"] if existing and existing["created_at"] else now

    board = {**board, "meta": {**board.get("meta", {}), "created_at": created_at, "updated_at": now}}
    data = json.dumps(board)

    # upsert
    conn.execute(
        "INSERT INTO boards (id, user_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
        " ON CONFLICT(user_id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at",
        (board.get("id", user_id), user_id, data, created_at, now),
    )
    conn.commit()
    conn.close()
