from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from jsonschema import ValidationError, validate
from pydantic import BaseModel, Field
import json

from . import ai, db

APP_DIR = Path(__file__).resolve().parent.parent
DB_PATH = APP_DIR / "data" / "pm.db"
SCHEMA_PATH = APP_DIR / "docs" / "kanban_schema.json"

app = FastAPI()


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


DEFAULT_BOARD = {
    "id": "board-user",
    "title": "My Board",
    "meta": {},
    "columns": [
        {"id": "col-backlog", "title": "Backlog", "cardIds": ["card-1", "card-2"]},
        {"id": "col-discovery", "title": "Discovery", "cardIds": ["card-3"]},
        {"id": "col-progress", "title": "In Progress", "cardIds": ["card-4", "card-5"]},
        {"id": "col-review", "title": "Review", "cardIds": ["card-6"]},
        {"id": "col-done", "title": "Done", "cardIds": ["card-7", "card-8"]},
    ],
    "cards": {
        "card-1": {"id": "card-1", "title": "Align roadmap themes", "details": "Draft quarterly themes with impact statements and metrics."},
        "card-2": {"id": "card-2", "title": "Gather customer signals", "details": "Review support tags, sales notes, and churn feedback."},
        "card-3": {"id": "card-3", "title": "Prototype analytics view", "details": "Sketch initial dashboard layout and key drill-downs."},
        "card-4": {"id": "card-4", "title": "Refine status language", "details": "Standardize column labels and tone across the board."},
        "card-5": {"id": "card-5", "title": "Design card layout", "details": "Add hierarchy and spacing for scanning dense lists."},
        "card-6": {"id": "card-6", "title": "QA micro-interactions", "details": "Verify hover, focus, and loading states."},
        "card-7": {"id": "card-7", "title": "Ship marketing page", "details": "Final copy approved and asset pack delivered."},
        "card-8": {"id": "card-8", "title": "Close onboarding sprint", "details": "Document release notes and share internally."},
    },
}


@app.get("/api/board")
def get_board():
    user_id = "user"
    board = db.get_board(DB_PATH, user_id)
    if not board:
        db.save_board(DB_PATH, user_id, DEFAULT_BOARD)
        return db.get_board(DB_PATH, user_id)
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

    board_update = result.get("board_update")
    if board_update is not None:
        try:
            validate(instance=board_update, schema=BOARD_SCHEMA)
        except ValidationError:
            result["board_update"] = None
            result["response"] = (
                (result.get("response") or "").strip()
                + " (The AI's board update didn't match the expected format, so it wasn't applied.)"
            ).strip()

    return {"status": "ok", "result": result}


# Serve static export if present
static_dir = APP_DIR / "frontend" / "out"
if static_dir.exists():
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
