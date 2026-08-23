"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { createId, initialData, moveCard, type BoardData } from "@/lib/kanban";
import { askBoardAI, loadBoard, saveBoard, type AIMessage, type ServerBoard } from "@/lib/api";

type KanbanBoardProps = {
  onLogout?: () => void;
};

export const KanbanBoard = ({ onLogout }: KanbanBoardProps) => {
  const [board, setBoard] = useState<BoardData>(() => initialData);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [aiInput, setAiInput] = useState("");
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([
    { role: "assistant", content: "Ask me to add, move, or rename cards on the board." },
  ]);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const cardsById = useMemo(() => board.cards, [board.cards]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);

    if (!over || active.id === over.id) {
      return;
    }

    setBoard((prev) => ({
      ...prev,
      columns: moveCard(prev.columns, active.id as string, over.id as string),
    }));
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    setBoard((prev) => ({
      ...prev,
      columns: prev.columns.map((column) =>
        column.id === columnId ? { ...column, title } : column
      ),
    }));
  };

  const handleAddCard = (columnId: string, title: string, details: string) => {
    const id = createId("card");
    setBoard((prev) => ({
      ...prev,
      cards: {
        ...prev.cards,
        [id]: { id, title, details: details || "No details yet." },
      },
      columns: prev.columns.map((column) =>
        column.id === columnId
          ? { ...column, cardIds: [...column.cardIds, id] }
          : column
      ),
    }));
  };

  const handleDeleteCard = (columnId: string, cardId: string) => {
    setBoard((prev) => ({
      ...prev,
      cards: Object.fromEntries(
        Object.entries(prev.cards).filter(([id]) => id !== cardId)
      ),
      columns: prev.columns.map((column) =>
        column.id === columnId
          ? { ...column, cardIds: column.cardIds.filter((id) => id !== cardId) }
          : column
      ),
    }));
  };

  const activeCard = activeCardId ? cardsById[activeCardId] : null;

  const handleAskAI = async () => {
    const question = aiInput.trim();
    if (!question || isAiLoading) return;

    const nextHistory: AIMessage[] = [...aiMessages, { role: "user", content: question }];
    setAiMessages(nextHistory);
    setAiInput("");
    setIsAiLoading(true);

    try {
      const result = await askBoardAI({
        question,
        board: {
          id: "board-user",
          title: "My Board",
          meta: {},
          columns: board.columns,
          cards: board.cards,
        },
        conversation_history: nextHistory,
      });

      setAiMessages((prev) => [...prev, { role: "assistant", content: result.response || "I updated the board." }]);

      const nextBoard = result.board_update;
      if (nextBoard && typeof nextBoard === "object") {
        setBoard((prev) => ({
          ...prev,
          ...nextBoard,
          columns: nextBoard.columns ?? prev.columns,
          cards: nextBoard.cards ?? prev.cards,
        }));
      }
    } catch (error) {
      setAiMessages((prev) => [
        ...prev,
        { role: "assistant", content: "I couldn't reach the AI service right now." },
      ]);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Load board from backend on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const server = await loadBoard();
        if (cancelled) return;
        setBoard({ columns: server.columns, cards: server.cards });
      } catch (e) {
        // ignore load errors, keep initial data
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist board to backend (simple debounce)
  const saveTimeout = useRef<number | null>(null);
  useEffect(() => {
    // don't save on first render
    if (saveTimeout.current === undefined) {
      saveTimeout.current = null;
      return;
    }

    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
    }
    // schedule save
    // @ts-ignore - window.setTimeout returns number in browser
    saveTimeout.current = window.setTimeout(async () => {
      const payload: ServerBoard = {
        id: "board-user",
        title: "My Board",
        meta: {},
        columns: board.columns,
        cards: board.cards,
      };
      try {
        await saveBoard(payload);
      } catch (e) {
        // ignore save errors
      }
    }, 500);

    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board]);

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative mx-auto grid min-h-screen max-w-[1500px] gap-10 px-6 pb-16 pt-12 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-10">
          <header className="flex flex-col gap-6 rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                  Single Board Kanban
                </p>
                <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
                  Kanban Studio
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--gray-text)]">
                  Keep momentum visible. Rename columns, drag cards between stages,
                  and capture quick notes without getting buried in settings.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-5 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                    Focus
                  </p>
                  <p className="mt-2 text-lg font-semibold text-[var(--primary-blue)]">
                    One board. Five columns. Zero clutter.
                  </p>
                </div>
                {onLogout ? (
                  <button
                    type="button"
                    onClick={onLogout}
                    className="rounded-full border border-[var(--stroke)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)] transition hover:bg-[var(--surface)]"
                  >
                    Log out
                  </button>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              {board.columns.map((column) => (
                <div
                  key={column.id}
                  className="flex items-center gap-2 rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]"
                >
                  <span className="h-2 w-2 rounded-full bg-[var(--accent-yellow)]" />
                  {column.title}
                </div>
              ))}
            </div>
          </header>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <section className="flex gap-6 overflow-x-auto pb-2">
              {board.columns.map((column) => (
                <div key={column.id} className="w-[280px] shrink-0">
                  <KanbanColumn
                    column={column}
                    cards={column.cardIds.map((cardId) => board.cards[cardId]).filter(Boolean)}
                    onRename={handleRenameColumn}
                    onAddCard={handleAddCard}
                    onDeleteCard={handleDeleteCard}
                  />
                </div>
              ))}
            </section>
            <DragOverlay>
              {activeCard ? (
                <div className="w-[260px]">
                  <KanbanCardPreview card={activeCard} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>

        <aside className="rounded-[28px] border border-[var(--stroke)] bg-white/90 p-5 shadow-[var(--shadow)] backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                AI planner
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-[var(--navy-dark)]">
                Ask the board
              </h2>
            </div>
          </div>

          <div className="flex max-h-[540px] flex-col gap-3 overflow-y-auto pr-1">
            {aiMessages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`rounded-2xl border px-3 py-2 text-sm leading-6 ${message.role === "user"
                  ? "border-[var(--primary-blue)] bg-[var(--surface)] text-[var(--navy-dark)]"
                  : "border-[var(--stroke)] bg-[var(--surface-strong)] text-[var(--navy-dark)]"
                  }`}
              >
                {message.content}
              </div>
            ))}
            {isAiLoading ? <div className="text-xs uppercase tracking-[0.2em] text-[var(--gray-text)]">Thinking…</div> : null}
          </div>

          <div className="mt-4 space-y-3">
            <textarea
              value={aiInput}
              onChange={(event) => setAiInput(event.target.value)}
              placeholder="Ask the AI to update the board"
              rows={4}
              className="w-full rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none ring-0 placeholder:text-[var(--gray-text)]"
            />
            <button
              type="button"
              onClick={handleAskAI}
              disabled={isAiLoading || !aiInput.trim()}
              className="w-full rounded-full bg-[var(--secondary-purple)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAiLoading ? "Sending..." : "Send"}
            </button>
          </div>
        </aside>
      </main>
    </div>
  );
};