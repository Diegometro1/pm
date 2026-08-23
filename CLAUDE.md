# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A Project Management MVP: a single-user Kanban board with drag-and-drop, backed by FastAPI + SQLite, with an AI chat sidebar (via OpenRouter) that can read and edit the board. Full business requirements and constraints are in `AGENTS.md`; the phased build plan (and what's done vs. pending) is in `docs/PLAN.md`; the board schema design is in `docs/DB.md`.

## Architecture

- **Frontend** (`frontend/`): Next.js 16 / React 19, built as a **static export** (`next build && next export` → `frontend/out`), not run as a Next server in production.
- **Backend** (`backend/`): FastAPI app (`backend/main.py`) that both serves the API and mounts the frontend's static export at `/` (`StaticFiles(directory=APP_DIR/"frontend/out")`). This is the production entrypoint — one process, one port (8000).
- **Database** (`backend/db.py`): SQLite at `data/pm.db`, one row per user in a `boards` table, with the entire Kanban board stored as a JSON blob validated against `docs/kanban_schema.json` (see `docs/DB.md` for rationale). There's currently one hardcoded `user_id = "user"` in `main.py` — multi-user support is schema-ready but not wired up.
- **AI** (`backend/ai.py`): calls OpenRouter (`openai/gpt-oss-120b` by default) via `call_board_ai`, which sends the full board JSON + user question + conversation history and expects a JSON response `{response, board_update}` (`board_update` is either `null` or a complete replacement board). If `OPENROUTER_API_KEY` is missing/placeholder, it fails gracefully with a fixed message instead of erroring — don't "fix" that fallback into a hard error.
- **Auth**: `frontend/src/lib/auth.ts` — a fake client-side gate (hardcoded `user`/`password`, flag in `localStorage`). No server-side session/token; this is by design for the MVP per `AGENTS.md`.
- Frontend talks to the backend only through `frontend/src/lib/api.ts` (`/api/board` GET/PUT, `/api/ai/board` POST).

### Two different dev/test topologies — don't confuse them

1. **Docker Compose** (`docker-compose.yml`, `scripts/start.sh` / `stop.sh`): `frontend` service serves the built Next app on :3000 and `backend` serves FastAPI on :8000 as **separate containers** — the frontend here talks to the backend via the browser hitting a different origin, not via the embedded-static-export path. There's also a `frontend-dev` service (port 3001) for live-reload dev with volume mounts.
2. **Docker image / CI / Playwright** (`Dockerfile`, `backend/Dockerfile`, `playwright.config.ts`): frontend is exported to static files and served *by* uvicorn on :8000 — this is the "real" production shape and what E2E tests run against.

When changing how frontend and backend talk to each other, check both topologies.

## Common commands

Backend (from repo root, needs `backend/requirements.txt` installed, e.g. into `.venv`):
```bash
pytest backend/tests -q                    # all backend tests
pytest backend/tests/test_ai.py -q         # single file
uvicorn backend.main:app --reload --port 8000
```

Frontend (from `frontend/`):
```bash
npm run dev            # Next dev server (localhost:3000)
npm run build           # production build
npm run export          # static export to frontend/out (needed for backend to serve /)
npm run test:unit        # vitest, jsdom
npm run test:unit:watch
npm run test:e2e         # playwright — auto-boots uvicorn per playwright.config.ts, targets :8000
npm run test:all         # unit then e2e
```
Run a single vitest file: `npx vitest run src/lib/kanban.test.ts`. Run a single playwright spec: `npx playwright test tests/kanban.spec.ts`.

Integration tests in `src/__tests__/api.integration.test.ts` hit a real backend at `TEST_BASE` (default `http://localhost:8000`) and self-skip (with a console warning, not a failure) if it's unreachable — start the backend first if you want them to actually run.

Docker Compose:
```bash
scripts/start.sh   # docker-compose up -d --build frontend backend
scripts/stop.sh    # docker-compose down
```

## Conventions (from AGENTS.md)

- Keep it simple: no over-engineering, no defensive programming for cases that can't happen, no speculative features.
- Identify root cause before fixing; don't guess-and-check.
- No emojis, ever.
- Use `uv` as the Python package manager inside Docker (per AGENTS.md decision — note current Dockerfiles use plain `pip`, so check which is authoritative before assuming).
