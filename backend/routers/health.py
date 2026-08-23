from fastapi import APIRouter

router = APIRouter()


@router.get("/api/ping")
def ping():
    return {"status": "ok", "message": "pong"}
