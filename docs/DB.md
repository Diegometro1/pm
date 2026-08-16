Database design proposal — Part 5: Database modeling for Kanban

Overview
--------
This project will use SQLite for the MVP and store each user's Kanban board as a JSON document in the database. Storing the board as JSON keeps the initial implementation simple, portable (single-file DB), and easy to version and snapshot.

Schema
------
We propose a small schema with a single table to persist boards:

- Table: `boards`
  - `id` TEXT PRIMARY KEY -- UUID for the board
  - `user_id` TEXT NOT NULL -- reference for the owner (string for now)
  - `data` JSON NOT NULL -- the Kanban board JSON following `docs/kanban_schema.json`
  - `created_at` TEXT -- ISO datetime
  - `updated_at` TEXT -- ISO datetime

Reasoning / Tradeoffs
---------------------
- Simplicity: single table + JSON column is easiest to implement and maintain for MVP.
- Querying: SQLite's JSON functions allow extracting and querying inside the JSON when needed.
- Migration: If we later need normalized tables (users, columns, cards), we can migrate by reading `data` and splitting into new tables.
- Performance: For small personal boards JSON-in-row is performant; if boards grow large we can normalize later.

Storage & Backups
-----------------
- The SQLite DB will be created at `./data/pm.db` (or a configurable path via environment variable).
- Include a simple backup/restore script that copies the DB to `./data/backups/pm-YYYYMMDD.db`.

API considerations
------------------
- The backend will expose routes to Get/Put the board for the current user. The API will validate incoming payloads against `docs/kanban_schema.json` before saving.
- Concurrency: optimistic concurrency can be added by tracking `updated_at` and returning 409 conflict when out-of-date. For MVP, last-write-wins is acceptable.

Success criteria
----------------
- A working SQLite DB file is created on first backend start.
- A `boards` table exists and can save and load a valid board JSON for the hardcoded user.
- The board JSON validates against `docs/kanban_schema.json` before persisting.

Next steps (after sign-off)
---------------------------
1. Implement a tiny DB helper (create DB file, create `boards` table if missing).
2. Add backend routes to read and write the board for a given user (Part 6).
3. Add tests that exercise DB creation, save, load, and validation.

Sign-off
--------
Please review this approach. If you approve, reply with "approve" and I'll implement the DB helper and the API routes described in Part 6.
