# Code Review — Full Repo

Date: 2026-08-22
Scope: entire repository at `feat/embed-frontend-and-api-tests` (backend, frontend, Docker/Compose, CI, docs, tests). Read every source file, config file, and doc in the tree except `frontend/node_modules`, `.venv`, and build output.

This does not re-list issues already fixed earlier in this session (Compose API proxy, card-column squeeze, healthcheck timeout, `details`/`description` schema rename, e2e login gap, persistence-test race, backend data volume) — those are resolved. Everything below is new.

---

## High priority

### 1. Fresh installs never show the demo board — and it's the reason several e2e tests were flaky
`frontend/src/lib/kanban.ts` defines a polished 5-column, 8-card `initialData` demo board, and `KanbanBoard.tsx` uses it as the initial React state. But `KanbanBoard.tsx`'s mount effect (`frontend/src/components/KanbanBoard.tsx:143-157`) immediately overwrites it with whatever `GET /api/board` returns. On a genuinely fresh backend, `backend/main.py:56-70` (`get_board`) creates and returns a bare 2-column, 0-card board — not the demo data. So:
- `initialData` is effectively dead code in any real deployment (visible for a few hundred ms at most).
- Any e2e test or manual QA pass that assumes "5 columns, `card-1` exists" (`kanban.spec.ts`, `persistence.spec.ts`) silently depends on someone having manually seeded the database beforehand — which is exactly what caused test failures earlier in this session once the backend container got recreated.

**Action:** decide on one source of truth for the "empty state." Either (a) have `backend/main.py`'s default-board fallback use the same seed content as `frontend/src/lib/kanban.ts`'s `initialData` (so a fresh install looks intentional), or (b) keep the bare 2-column default but delete `initialData`'s rich demo content and replace it with a genuinely empty placeholder so nothing implies otherwise. Either way, add a documented seed/reset step (e.g. a `scripts/seed.sh` or a pytest fixture) so e2e tests don't depend on incidental DB state.

### 2. No root `.dockerignore` — every image build ships ~550MB+ of build context
`docker-compose.yml`'s `frontend`, `frontend-dev`, and `backend` services all build with `context: .` (repo root). There is no `.dockerignore` at the root (only `frontend/.dockerignore`, which is not consulted for a root-context build). Confirmed with `du -sh`: `frontend/node_modules` (484MB) + `.venv` (67MB) + `welcome-to-docker` (1.3MB) + full `.git` history all get sent to the Docker daemon as build context on every build. Beyond the slowdown, this also risks bundling `.env` (which holds a real `OPENROUTER_API_KEY`) into the build context.

**Action:** add a root `.dockerignore` excluding at minimum: `.git`, `.venv`, `frontend/node_modules`, `frontend/.next`, `frontend/out`, `welcome-to-docker`, `data/`, `.env`, `*.log`.

### 3. `welcome-to-docker/` is a broken nested git repo committed by accident
`git ls-tree HEAD -- welcome-to-docker` shows mode `160000` (a gitlink/submodule entry) with no corresponding `.gitmodules` file. It was added in commit `3d528e6`. It's an unrelated Create-React-App Docker starter template, not referenced by any Dockerfile, compose file, or script in this project. Because there's no `.gitmodules`, a fresh `git clone` of this repo leaves other contributors with an empty, broken `welcome-to-docker/` directory.

**Action:** `git rm -r welcome-to-docker` (or `git rm --cached welcome-to-docker` if you want to keep the local files untracked) and confirm nothing references it.

### 4. AI-generated board updates are applied to UI state without schema validation, and save failures are silent
`backend/main.py`'s `ai_board` endpoint (`:101-113`) returns whatever `ai.call_board_ai` produces without validating `board_update` against `BOARD_SCHEMA` — that validation only happens later, in `put_board`, when the debounced autosave fires. Meanwhile `KanbanBoard.tsx:handleAskAI` (`:123-131`) applies `result.board_update` straight into React state with no shape-checking. If the LLM ever returns a malformed board (missing `id`/`title`, wrong `cards` shape, etc.), the UI updates immediately with bad data, and the subsequent autosave `PUT /api/board` will fail schema validation — but that failure is caught and silently discarded (`frontend/src/components/KanbanBoard.tsx:181-185`, `catch (e) { // ignore save errors }`). The user sees a possibly-broken board with zero indication anything went wrong or that their state isn't persisted.

**Action:** validate `board_update` against the schema server-side before returning it from `/api/ai/board` (reject/null it out on failure, same as any other malformed input), and surface save failures to the user in the UI (even a small toast/inline note) instead of swallowing them.

---

## Medium priority

### 5. Server-side API has no auth at all
`/api/board` (GET/PUT) and `/api/ai/board` have no authentication — the "login" (`frontend/src/lib/auth.ts`) is a client-side `localStorage` flag with zero server enforcement. Anyone who can reach port 8000 (exposed as `0.0.0.0:8000` in `docker-compose.yml`) can read or overwrite the board and burn OpenRouter API calls, no credentials required. This is explicitly scoped as acceptable for the MVP in `AGENTS.md`, so not asking you to build real auth — but it's currently not even mentioned as a known limitation anywhere in the docs, and the port is bound to all interfaces rather than `127.0.0.1`, so it's reachable from other machines on the same network by default.

**Action:** at minimum, document this limitation explicitly (e.g. in `AGENTS.md` or `docs/DB.md`), and consider binding the compose port mapping to `127.0.0.1:8000:8000` for local-only exposure until real auth exists.

### 6. Backend dependencies are unpinned (`>=`)
`backend/requirements.txt` uses `>=` for every dependency (`fastapi>=0.109.0`, etc.) with no lockfile. A build today and a build in six months can resolve to different transitive versions, which is a reproducibility risk for both CI and the Docker image.

**Action:** pin exact versions (or generate a `requirements.lock`/use `pip-compile`) so `docker build` is reproducible.

### 7. `created_at`/`updated_at` are documented but never populated
`docs/DB.md` and `docs/kanban_schema.json` both describe `meta.created_at`/`meta.updated_at` as real fields, but no code path ever sets them — the frontend always sends `meta: {}` (`KanbanBoard.tsx:113,177`), and `db.py:save_board` (`:42`) only persists `updated_at` if the caller already provided one, defaulting to `""` otherwise. The `boards` table's own `created_at`/`updated_at` columns are therefore always empty strings in practice.

**Action:** either have the backend stamp these timestamps itself on save (simplest, and matches the documented intent), or remove the fields from the docs/schema if they're not meant to be used yet.

### 8. CI's Playwright/AI integration tests depend on a live third-party network call
`.github/workflows/ci.yml` passes `OPENROUTER_API_KEY` from repo secrets into the pytest run. `backend/tests/test_ai.py`'s `test_call_openrouter_integration` and `test_call_board_ai_integration` are gated on a real key being present (`_has_real_openrouter_key()`), so whenever that secret is configured, CI makes live calls to OpenRouter and its outcome depends on that service being up and returning an expected-shaped answer — a source of CI flakiness unrelated to code correctness.

**Action:** keep these as opt-in local/manual tests (e.g. a separate `pytest -m integration` marker excluded from the default CI run) rather than letting CI's default `pytest backend/tests -q` invocation pick them up automatically whenever the secret exists.

### 9. Local board state silently gains untyped fields from AI/server responses
`KanbanBoard.tsx`'s `board` state is typed `BoardData` (`{columns, cards}` only — see `frontend/src/lib/kanban.ts:13-16`), but the AI-merge in `handleAskAI` (`:125-130`) does `{...prev, ...nextBoard, columns: ..., cards: ...}` where `nextBoard: ServerBoard` also carries `id`, `title`, `meta`. TypeScript's excess-property check doesn't catch this because the extra fields arrive via a spread of a differently-typed variable rather than as literal properties, so it compiles cleanly but the runtime object no longer matches its declared type. Currently harmless (nothing reads those extra fields off local state), but it's a foot-gun for future changes.

**Action:** narrow the merge to `{ columns: nextBoard.columns ?? prev.columns, cards: nextBoard.cards ?? prev.cards }` (drop the `...prev, ...nextBoard` spread) so the state always matches its declared type.

---

## Low priority / cleanup

### 10. Part 1 of `docs/PLAN.md` was never fully carried out
The plan (`docs/PLAN.md:5`) asked to "create an AGENTS.md file inside the frontend directory" — this was never done (`backend/AGENTS.md` and `scripts/AGENTS.md` exist but are one-line placeholders: `"This file should be updated with a description of the Backend"` / `"This folder will contain start and stop scripts..."`). It also asked to enrich `PLAN.md` itself with per-part checklists, tests, and success criteria — the file still reads as a single-paragraph-per-part outline with no checkboxes.

**Action:** low-cost either way — either fill these in now for the next contributor's benefit, or drop the Part 1 requirement from `PLAN.md` if it's no longer wanted.

### 11. No root `README.md`
There's `AGENTS.md` at the root (agent-facing) and `frontend/README.md`, but nothing human-facing at the repo root explaining what this project is, how to run it, or where to look first. `CLAUDE.md` (added this session) covers the agent-productivity angle but isn't a substitute for a README.

**Action:** consider a short root `README.md` pointing at `AGENTS.md`/`docs/PLAN.md` for details.

### 12. Stray empty file at repo root
`docker-build.log` (0 bytes, gitignored, not tracked) is just build-log cruft sitting in the working tree.

**Action:** `rm docker-build.log` — trivial.

### 13. SQLite opened per-request with no WAL mode or busy timeout
`backend/db.py` opens a brand-new `sqlite3.connect()` per call with default settings. Fine for a single-user MVP with SQLite's default serialization, but if this ever gets concurrent writers (e.g. multiple browser tabs autosaving, or a future multi-user mode), it'll start throwing `database is locked` errors under load.

**Action:** no change needed now; worth a one-line comment noting the assumption if/when multi-user support (already schema-ready per `docs/DB.md`) gets built.

---

## What's already solid (worth preserving as you iterate)

- Test coverage is good in breadth: backend unit tests for `db.py`/`ai.py`, frontend unit tests (`kanban.test.ts`'s `moveCard` logic, `api.unit.test.ts`'s fetch contracts, `KanbanBoard.test.tsx`'s integration-style render tests with a mocked `fetch`), and e2e coverage for the real drag-and-drop/login/persistence flows.
- `api.integration.test.ts` self-skips with a console warning when the backend isn't reachable rather than failing — a good pattern other integration tests in this repo could copy.
- The AI fallback behavior (`ai.py:call_openrouter` refusing to call out with a missing/placeholder key, `call_board_ai` catching failures into a user-facing message) is a clean, simple defensive pattern — resist the urge to add more error-handling layers on top of it.
- `docs/DB.md`'s schema-design writeup is a good model for how the rest of the repo's design docs could look (rationale + tradeoffs + success criteria, not just a schema dump).
