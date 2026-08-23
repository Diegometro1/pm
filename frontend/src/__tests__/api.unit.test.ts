import { vi, describe, it, expect, beforeEach } from "vitest";
import { askBoardAI, loadBoard, saveBoard } from "@/lib/api";

const sample = {
    id: "board-user",
    title: "My Board",
    meta: {},
    columns: [{ id: "col-1", title: "To do", cardIds: [] }],
    cards: {},
};

describe("api helpers", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("loadBoard requests /api/board and returns json", async () => {
        vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(sample) })) as any);
        const b = await loadBoard();
        expect(b).toEqual(sample);
    });

    it("saveBoard sends PUT to /api/board", async () => {
        const mockFetch = vi.fn(() => Promise.resolve({ ok: true })) as any;
        vi.stubGlobal("fetch", mockFetch);
        await saveBoard(sample as any);
        expect(mockFetch).toHaveBeenCalled();
        const [[url, opts]] = mockFetch.mock.calls as any;
        expect(url).toMatch(/\/api\/board$/);
        expect(opts.method).toBe("PUT");
    });

    it("askBoardAI posts to /api/ai/board and returns the structured result", async () => {
        const mockFetch = vi.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ result: { response: "Added a card", board_update: sample } }),
            })
        ) as any;
        vi.stubGlobal("fetch", mockFetch);

        const result = await askBoardAI({
            question: "Add a task",
            board: sample,
            conversation_history: [{ role: "user", content: "Hi" }],
        });

        expect(result.response).toBe("Added a card");
        expect(mockFetch).toHaveBeenCalled();
        const [[url, opts]] = mockFetch.mock.calls as any;
        expect(url).toMatch(/\/api\/ai\/board$/);
        expect(opts.method).toBe("POST");
        expect(JSON.parse(opts.body).question).toBe("Add a task");
    });
});
