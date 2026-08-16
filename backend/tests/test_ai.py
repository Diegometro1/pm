import os
import pytest

from backend import ai


def test_call_openrouter_missing_key():
    # ensure a clear error is raised when API key missing
    env_key = os.environ.pop("OPENROUTER_API_KEY", None)
    try:
        with pytest.raises(RuntimeError):
            ai.call_openrouter("2+2")
    finally:
        if env_key is not None:
            os.environ["OPENROUTER_API_KEY"] = env_key


@pytest.mark.skipif(not os.getenv("OPENROUTER_API_KEY"), reason="No OPENROUTER_API_KEY set")
def test_call_openrouter_integration():
    # This integration test will attempt a live call. It is skipped when OPENROUTER_API_KEY is not set.
    resp = ai.call_openrouter("What is 2+2?", max_tokens=10)
    assert resp is not None
    assert isinstance(resp, str)
    # Expect '4' somewhere in the textual answer, but be permissive
    assert "4" in resp or "four" in resp.lower()
