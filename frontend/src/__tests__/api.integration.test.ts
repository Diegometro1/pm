import { describe, it, expect } from "vitest";

const BASE = process.env.TEST_BASE || "http://localhost:8000";

// Quick connectivity check at module load time. If the backend is unreachable,
// export an empty module so Vitest won't run these tests in restricted envs.
let reachable = false;
try {
    // top-level await is supported by Vitest; attempt a fast ping
    // eslint-disable-next-line no-undef
    // @ts-ignore - global fetch in test environment
    const resp = await fetch(`${BASE}/api/ping`, { method: "GET" });
    reachable = resp.ok;
} catch (e) {
    reachable = false;
}

if (!reachable) {
    // Skip integration tests when backend isn't reachable from the test runner.
    // eslint-disable-next-line no-console
    console.warn("Skipping integration tests: backend not reachable at", BASE);
} else {
    describe("backend API integration", () => {
        it("ping returns ok", async () => {
            const res = await fetch(`${BASE}/api/ping`);
            expect(res.ok).toBe(true);
            const body = await res.json();
            expect(body.status).toBe("ok");
        });

        it("can GET and PUT board", async () => {
            const getRes = await fetch(`${BASE}/api/board`);
            expect(getRes.ok).toBe(true);
            const board = await getRes.json();
            expect(board).toHaveProperty("columns");

            const payload = {
                id: "board-user",
                title: "Test Board",
                meta: {},
                columns: board.columns,
                cards: board.cards,
            };

            const putRes = await fetch(`${BASE}/api/board`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            expect(putRes.ok).toBe(true);

            const getRes2 = await fetch(`${BASE}/api/board`);
            const board2 = await getRes2.json();
            expect(board2.title || board2.id).toBeDefined();
        });
    });
}
