export type ServerBoard = {
    id: string;
    title?: string;
    meta?: Record<string, any>;
    columns: any[];
    cards: Record<string, any>;
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
