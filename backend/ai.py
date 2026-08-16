import os
import requests
from typing import Optional

OPENROUTER_URL = os.getenv("OPENROUTER_API_URL", "https://api.openrouter.ai/v1/chat/completions")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openai/gpt-oss-120b")


def call_openrouter(prompt: str, max_tokens: int = 200) -> str:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY not set in environment")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
    }

    resp = requests.post(OPENROUTER_URL, json=payload, headers=headers, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    # Try to extract a text response in a few possible shapes
    # OpenRouter/Chat-like: data['choices'][0]['message']['content'] or string
    choice = None
    if isinstance(data, dict) and "choices" in data and data["choices"]:
        first = data["choices"][0]
        if isinstance(first, dict):
            # Prefer message.content.text or message.content
            msg = first.get("message") or first.get("delta") or {}
            if isinstance(msg, dict):
                content = msg.get("content")
                if isinstance(content, dict):
                    # sometimes content may be {'text': '...'}
                    text = content.get("text") or content.get("content")
                    if text:
                        choice = text
                elif isinstance(content, str):
                    choice = content
            # fallback to first.get('text')
            if not choice:
                choice = first.get("text") or first.get("response")

    # If nothing found, try a legacy 'text' or 'result' field
    if not choice:
        if isinstance(data, dict):
            choice = data.get("text") or data.get("result")

    # As last resort, return the full JSON
    if not choice:
        return str(data)

    return choice
