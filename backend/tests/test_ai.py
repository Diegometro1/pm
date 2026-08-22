import json
import os
from types import SimpleNamespace

import pytest

from backend import ai


def test_call_openrouter_missing_key():
    env_key = os.environ.pop("OPENROUTER_API_KEY", None)
    try:
        with pytest.raises(RuntimeError):
            ai.call_openrouter("2+2")
    finally:
        if env_key is not None:
            os.environ["OPENROUTER_API_KEY"] = env_key


def test_call_board_ai_missing_key_returns_fallback_response():
    env_key = os.environ.pop("OPENROUTER_API_KEY", None)
    try:
        board = {
            "id": "board-1",
            "title": "Team Board",
            "columns": [{"id": "col-1", "title": "To do", "cardIds": []}],
            "cards": {},
        }
        result = ai.call_board_ai(board, "Add a task called Ship demo")
        assert "not configured" in result["response"].lower()
        assert result["board_update"] is None
    finally:
        if env_key is not None:
            os.environ["OPENROUTER_API_KEY"] = env_key


def test_call_openrouter_rejects_placeholder_key(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "your_openrouter_api_key_here")
    with pytest.raises(RuntimeError, match="not configured|placeholder"):
        ai.call_openrouter("2+2")


def test_build_ai_prompt_includes_board_question_history():
    board = {
        "id": "board-1",
        "title": "Team Board",
        "columns": [{"id": "col-1", "title": "To do", "cardIds": []}],
        "cards": {},
    }
    prompt = ai.build_ai_prompt(board, "Add a task", [{"role": "user", "content": "Hello"}])
    assert "Team Board" in prompt
    assert "Add a task" in prompt
    assert "Hello" in prompt


def test_extract_json_from_response_handles_stringified_json():
    payload = '{"response": "done", "board_update": null}'
    parsed = ai._extract_json_from_response(payload)
    assert parsed["response"] == "done"
    assert parsed["board_update"] is None


def test_call_openrouter_requests_json_object_mode(monkeypatch):
    captured = {}

    class FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return {"choices": [{"message": {"content": '{"response": "done", "board_update": null}'}}]}

    def fake_post(url, json, headers, timeout):
        captured["url"] = url
        captured["json"] = json
        captured["headers"] = headers
        captured["timeout"] = timeout
        return FakeResponse()

    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr("backend.ai.requests.post", fake_post)

    messages = [
        {"role": "system", "content": "Be concise."},
        {"role": "user", "content": "2+2"},
    ]
    result = ai.call_openrouter("2+2", max_tokens=25, response_format={"type": "json_object"}, messages=messages)

    assert result == '{"response": "done", "board_update": null}'
    assert captured["json"]["messages"] == messages
    assert captured["json"]["response_format"] == {"type": "json_object"}


def _has_real_openrouter_key() -> bool:
    value = os.getenv("OPENROUTER_API_KEY", "")
    return bool(value and value.strip() and value.strip().lower() != "your_openrouter_api_key_here")


@pytest.mark.skipif(not _has_real_openrouter_key(), reason="No real OPENROUTER_API_KEY configured")
def test_call_openrouter_integration():
    resp = ai.call_openrouter("What is 2+2?", max_tokens=10)
    assert resp is not None
    assert isinstance(resp, str)
    assert "4" in resp or "four" in resp.lower()


@pytest.mark.skipif(not _has_real_openrouter_key(), reason="No real OPENROUTER_API_KEY configured")
def test_call_board_ai_integration():
    board = {
        "id": "board-1",
        "title": "Team Board",
        "columns": [{"id": "col-1", "title": "To do", "cardIds": []}],
        "cards": {},
    }
    result = ai.call_board_ai(board, "Add a task called Ship demo", history=[{"role": "user", "content": "Hi"}])
    assert isinstance(result, dict)
    assert "response" in result
    assert "board_update" in result
