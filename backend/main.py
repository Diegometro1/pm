from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from jsonschema import ValidationError, validate
from pydantic import BaseModel, Field
import json

from . import ai, db
from . import ai

APP_DIR = Path(__file__).resolve().parent.parent
DB_PATH = APP_DIR / "data" / "pm.db"
SCHEMA_PATH = APP_DIR / "docs" / "kanban_schema.json"

app = FastAPI()


class BoardPayload(BaseModel):
    data: dict


class AIChatMessage(BaseModel):
    role: str
    content: str


class AIBoardRequest(BaseModel):
    question: str = Field(..., min_length=1)
    board: Dict[str, Any]
    conversation_history: List[AIChatMessage] = Field(default_factory=list)


@app.on_event("startup")
def startup_event():
    db.init_db(DB_PATH)


def _load_schema():
    with open(SCHEMA_PATH, "r") as fh:
        return json.load(fh)


BOARD_SCHEMA = _load_schema()


@app.get("/api/ping")
def ping():
    return {"status": "ok", "message": "pong"}


@app.get("/api/board")
def get_board():
    user_id = "user"
    board = db.get_board(DB_PATH, user_id)
    if not board:
        # create a default minimal board
        default = {
            "id": "board-user",
            "title": "My Board",
            "meta": {"created_at": "", "updated_at": ""},
            "columns": [
                {"id": "col-1", "title": "To do", "cardIds": []},
                {"id": "col-2", "title": "Done", "cardIds": []},
            ],
            "cards": {},
        }
        db.save_board(DB_PATH, user_id, default)
        return default
    return board


@app.put("/api/board")
def put_board(payload: dict):
    user_id = "user"
    # validate payload against schema
    try:
        validate(instance=payload, schema=BOARD_SCHEMA)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    db.save_board(DB_PATH, user_id, payload)
    return {"status": "ok"}



class AIPrompt(BaseModel):
    prompt: str


@app.post("/api/ai-test")
def ai_test(body: AIPrompt):
    """Simple AI test endpoint. Sends the prompt to OpenRouter and returns the text."""
    try:
        out = ai.call_openrouter(body.prompt, max_tokens=100)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return {"status": "ok", "response": out}


@app.post("/api/ai/board")
def ai_board(payload: AIBoardRequest):
    """Ask the AI to answer a board-related question and optionally update the board."""
    try:
        result = ai.call_board_ai(
            board=payload.board,
            question=payload.question,
            history=[msg.model_dump() for msg in payload.conversation_history],
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return {"status": "ok", "result": result}


# Serve static export if present
static_dir = APP_DIR / "frontend" / "out"
if static_dir.exists():
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
