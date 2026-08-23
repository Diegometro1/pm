import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { KanbanBoard } from "@/components/KanbanBoard";

const getDefaultBoard = () => ({
  id: "board-user",
  title: "My Board",
  meta: {},
  columns: [
    { id: "col-backlog", title: "Backlog", cardIds: ["card-1"] },
    { id: "col-discovery", title: "Discovery", cardIds: [] },
    { id: "col-progress", title: "In Progress", cardIds: [] },
    { id: "col-review", title: "Review", cardIds: [] },
    { id: "col-done", title: "Done", cardIds: [] },
  ],
  cards: {
    "card-1": { id: "card-1", title: "Existing card", details: "Initial note" },
  },
});

const mockFetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input.toString();

  if (url.endsWith("/api/board")) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(getDefaultBoard()),
    }) as any;
  }

  if (url.endsWith("/api/ai/board") && init?.method === "POST") {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        result: {
          response: "Added a task",
          board_update: {
            ...getDefaultBoard(),
            columns: [
              { id: "col-backlog", title: "Backlog", cardIds: ["card-1", "card-new"] },
              { id: "col-discovery", title: "Discovery", cardIds: [] },
              { id: "col-progress", title: "In Progress", cardIds: [] },
              { id: "col-review", title: "Review", cardIds: [] },
              { id: "col-done", title: "Done", cardIds: [] },
            ],
            cards: {
              "card-1": { id: "card-1", title: "Existing card", details: "Initial note" },
              "card-new": { id: "card-new", title: "New AI card", details: "From AI" },
            },
          },
        },
      }),
    }) as any;
  }

  return Promise.resolve({ ok: true, json: () => Promise.resolve({}) }) as any;
});

describe("KanbanBoard", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch as any);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders five columns", async () => {
    render(<KanbanBoard />);
    expect(await screen.findAllByTestId(/column-/i)).toHaveLength(5);
  });

  it("renames a column", async () => {
    render(<KanbanBoard />);
    const column = (await screen.findAllByTestId(/column-/i))[0];
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    expect(input).toHaveValue("New Name");
  });

  it("adds and removes a card", async () => {
    render(<KanbanBoard />);
    const column = (await screen.findAllByTestId(/column-/i))[0];
    const addButton = within(column).getByRole("button", {
      name: /add a card/i,
    });
    await userEvent.click(addButton);

    const titleInput = within(column).getByPlaceholderText(/card title/i);
    await userEvent.type(titleInput, "New card");
    const detailsInput = within(column).getByPlaceholderText(/details/i);
    await userEvent.type(detailsInput, "Notes");

    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    expect(within(column).getByText("New card")).toBeInTheDocument();

    const deleteButton = within(column).getByRole("button", {
      name: /delete new card/i,
    });
    await userEvent.click(deleteButton);

    expect(within(column).queryByText("New card")).not.toBeInTheDocument();
  });

  it("sends a prompt to the AI and applies a returned board update", async () => {
    render(<KanbanBoard />);

    const input = await screen.findByPlaceholderText(/ask the ai to update the board/i);
    await userEvent.type(input, "Add a task");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText("Added a task")).toBeInTheDocument();
    expect(await screen.findByText("New AI card")).toBeInTheDocument();
  });
});
