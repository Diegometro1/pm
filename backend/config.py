import json
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent.parent
DB_PATH = APP_DIR / "data" / "pm.db"
SCHEMA_PATH = APP_DIR / "docs" / "kanban_schema.json"
FRONTEND_STATIC_DIR = APP_DIR / "frontend" / "out"


def _load_board_schema() -> dict:
    with open(SCHEMA_PATH, "r") as fh:
        return json.load(fh)


BOARD_SCHEMA = _load_board_schema()
