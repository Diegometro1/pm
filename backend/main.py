from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from . import db
from .config import DB_PATH, FRONTEND_STATIC_DIR
from .routers import board, board_ai, health

app = FastAPI()

app.include_router(health.router)
app.include_router(board.router)
app.include_router(board_ai.router)


@app.on_event("startup")
def startup_event():
    db.init_db(DB_PATH)


# Serve static export if present
if FRONTEND_STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_STATIC_DIR, html=True), name="static")
