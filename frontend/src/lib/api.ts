export type ServerBoard = {
    id: string;
    title?: string;
    meta?: Record<string, any>;
    columns: any[];
    cards: Record<string, any>;
};

export type AIMessage = {
    role: "user" | "assistant" | "system";
    content: string;
};

export type BoardAIRequest = {
    question: string;
    board: ServerBoard;
    conversation_history: AIMessage[];
};

export type BoardAIResult = {
    response: string;
    board_update: ServerBoard | null;
};

export async function loadBoard(): Promise<ServerBoard> {
    const res = await fetch('/api/board');
    if (!res.ok) throw new Error(`loadBoard failed: ${res.status}`);
    return await res.json();
}

export async function saveBoard(board: ServerBoard): Promise<void> {
    const res = await fetch('/api/board', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(board),
    });
    if (!res.ok) throw new Error(`saveBoard failed: ${res.status}`);
}

export async function askBoardAI(payload: BoardAIRequest): Promise<BoardAIResult> {
    const res = await fetch('/api/ai/board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`askBoardAI failed: ${res.status}`);
    const data = await res.json();
    return data.result as BoardAIResult;
}
