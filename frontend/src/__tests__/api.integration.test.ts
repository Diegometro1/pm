import { describe, it, expect, vi } from "vitest";

const BASE = process.env.TEST_BASE || "http://localhost:8000";

const checkReachable = async () => {
    try {
        // eslint-disable-next-line no-undef
        const resp = await fetch(`${BASE}/api/ping`, { method: "GET" });
        return resp.ok;
    } catch (error) {
        return false;
    }
};

describe("backend API integration", () => {
    it("ping returns ok", async () => {
        const reachable = await checkReachable();
        if (!reachable) {
            // eslint-disable-next-line no-console
            console.warn("Skipping integration tests: backend not reachable at", BASE);
            return;
        }

        const res = await fetch(`${BASE}/api/ping`);
        expect(res.ok).toBe(true);
        const body = await res.json();
        expect(body.status).toBe("ok");
    });

    it("can GET and PUT board", async () => {
        const reachable = await checkReachable();
        if (!reachable) {
            // eslint-disable-next-line no-console
            console.warn("Skipping integration tests: backend not reachable at", BASE);
            return;
        }

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
