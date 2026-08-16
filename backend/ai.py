import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests
from dotenv import load_dotenv

APP_DIR = Path(__file__).resolve().parent.parent
load_dotenv(APP_DIR / ".env")

OPENROUTER_URL = os.getenv("OPENROUTER_API_URL", "https://api.openrouter.ai/v1/chat/completions")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openai/gpt-oss-120b")


SYSTEM_PROMPT = """You are a kanban assistant.
Return valid JSON only.
Your JSON object must have exactly these keys:
- response: string
- board_update: object or null

Rules:
- Keep response brief but helpful.
- If the user asks for a board change, set board_update to the updated board object when appropriate.
- If no board change is needed, use null.
- Include the entire board JSON in board_update if a board update is proposed.
- Do not add markdown fences or commentary outside JSON.
"""

JSON_RESPONSE_FORMAT = {"type": "json_object"}


def build_ai_prompt(board: Dict[str, Any], question: str, history: Optional[List[Dict[str, str]]] = None) -> str:
    safe_history = history or []
    return json.dumps(
        {
            "board": board,
            "question": question,
            "conversation_history": safe_history,
        },
        ensure_ascii=False,
        indent=2,
    )


def _extract_json_from_response(raw: Any) -> Dict[str, Any]:
    if isinstance(raw, dict):
        if "response" in raw or "board_update" in raw:
            return raw
        if "choices" in raw and raw["choices"]:
            first = raw["choices"][0]
            if isinstance(first, dict):
                msg = first.get("message") or {}
                content = msg.get("content")
                if isinstance(content, str):
                    return _extract_json_from_response(content)
                if isinstance(content, list):
                    text_parts = []
                    for item in content:
                        if isinstance(item, dict) and "text" in item:
                            text_parts.append(item["text"])
                    if text_parts:
                        return _extract_json_from_response("".join(text_parts))
        if "text" in raw:
            return _extract_json_from_response(raw["text"])
        if "result" in raw:
            return _extract_json_from_response(raw["result"])
        raise ValueError(f"Unexpected OpenRouter payload shape: {raw!r}")

    if isinstance(raw, str):
        stripped = raw.strip()
        if stripped.startswith("```"):
            stripped = stripped.strip("`")
            if stripped.lower().startswith("json"):
                stripped = stripped[4:].strip()
        return json.loads(stripped)

    raise ValueError(f"Unable to parse OpenRouter response: {raw!r}")


def call_openrouter(
    prompt: str,
    max_tokens: int = 200,
    response_format: Optional[Dict[str, Any]] = None,
    messages: Optional[List[Dict[str, str]]] = None,
    system_prompt: Optional[str] = None,
) -> str:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY not set in environment")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    if messages is None:
        messages = [{"role": "user", "content": prompt}]
        if system_prompt:
            messages.insert(0, {"role": "system", "content": system_prompt})

    payload = {
        "model": OPENROUTER_MODEL,
        "messages": messages,
        "max_tokens": max_tokens,
    }
    if response_format is not None:
        payload["response_format"] = response_format

    resp = requests.post(OPENROUTER_URL, json=payload, headers=headers, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    choice = None
    if isinstance(data, dict) and "choices" in data and data["choices"]:
        first = data["choices"][0]
        if isinstance(first, dict):
            msg = first.get("message") or first.get("delta") or {}
            content = msg.get("content")
            if isinstance(content, str):
                choice = content
            elif isinstance(content, list):
                text_parts = []
                for item in content:
                    if isinstance(item, dict):
                        text = item.get("text") or item.get("content")
                        if isinstance(text, str):
                            text_parts.append(text)
                if text_parts:
                    choice = "".join(text_parts)

    if choice is None:
        if isinstance(data, dict):
            choice = data.get("text") or data.get("result")

    if choice is None:
        return str(data)

    return choice


def call_board_ai(board: Dict[str, Any], question: str, history: Optional[List[Dict[str, str]]] = None, max_tokens: int = 300) -> Dict[str, Any]:
    board_json = build_ai_prompt(board, question, history)
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": f"User request: {question}\n\nBoard JSON:\n{board_json}"})
    response_text = call_openrouter(
        prompt=question,
        max_tokens=max_tokens,
        response_format=JSON_RESPONSE_FORMAT,
        messages=messages,
        system_prompt=None,
    )
    parsed = _extract_json_from_response(response_text)
    if not isinstance(parsed, dict):
        raise ValueError("OpenRouter response was not a JSON object")
    if "response" not in parsed:
        parsed["response"] = "" if "board_update" in parsed and parsed["board_update"] else "I couldn't generate a response."
    if "board_update" not in parsed:
        parsed["board_update"] = None
    return parsed
