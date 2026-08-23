from fastapi import APIRouter, HTTPException
from jsonschema import ValidationError, validate

from .. import db
from ..board_data import DEFAULT_BOARD
from ..config import BOARD_SCHEMA, DB_PATH

router = APIRouter()


@router.get("/api/board")
def get_board():
    user_id = "user"
    board = db.get_board(DB_PATH, user_id)
    if not board:
        db.save_board(DB_PATH, user_id, DEFAULT_BOARD)
        return db.get_board(DB_PATH, user_id)
    return board


@router.put("/api/board")
def put_board(payload: dict):
    user_id = "user"
    try:
        validate(instance=payload, schema=BOARD_SCHEMA)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    db.save_board(DB_PATH, user_id, payload)
    return {"status": "ok"}
