from fastapi import APIRouter, HTTPException
from jsonschema import ValidationError, validate

from .. import ai
from ..config import BOARD_SCHEMA
from ..schemas import AIBoardRequest, AIPrompt

router = APIRouter()


@router.post("/api/ai-test")
def ai_test(body: AIPrompt):
    """Simple AI test endpoint. Sends the prompt to OpenRouter and returns the text."""
    try:
        out = ai.call_openrouter(body.prompt, max_tokens=100)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return {"status": "ok", "response": out}


@router.post("/api/ai/board")
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
