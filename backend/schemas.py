from typing import Any, Dict, List

from pydantic import BaseModel, Field


class AIChatMessage(BaseModel):
    role: str
    content: str


class AIBoardRequest(BaseModel):
    question: str = Field(..., min_length=1)
    board: Dict[str, Any]
    conversation_history: List[AIChatMessage] = Field(default_factory=list)


class AIPrompt(BaseModel):
    prompt: str
