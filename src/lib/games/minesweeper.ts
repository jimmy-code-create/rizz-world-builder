/**
 * MINESWEEPER — board generation, flood reveal and win detection.
 *
 * The first click is always safe: mines are placed *after* it, avoiding the
 * clicked cell and its neighbours, which is the behaviour players expect and
 * the reason a 50/50 opening guess never kills the game.
 */

export type Difficulty = "easy" | "medium" | "hard";
export type Cell = {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  adjacent: number;
};

export type Board = {
  rows: number;
  cols: number;
  mines: number;
  cells: Cell[];
};

export const DIFFICULTIES: Record<
  Difficulty,
  { rows: number; cols: number; mines: number; label: string }
> = {
  easy: { rows: 9, cols: 9, mines: 10, label: "Easy · 9×9, 10 mines" },
  medium: { rows: 12, cols: 12, mines: 24, label: "Medium · 12×12, 24 mines" },
  hard: { rows: 14, cols: 14, mines: 40, label: "Hard · 14×14, 40 mines" },
};

export function emptyBoard(rows: number, cols: number, mines: number): Board {
  return {
    rows,
    cols,
    mines,
    cells: Array.from({ length: rows * cols }, () => ({
      mine: false,
      revealed: false,
      flagged: false,
      adjacent: 0,
    })),
  };
}

function neighbours(board: Board, index: number): number[] {
  const row = Math.floor(index / board.cols);
  const col = index % board.cols;
  const result: number[] = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (!dr && !dc) continue;
      const r = row + dr;
      const c = col + dc;
      if (r < 0 || c < 0 || r >= board.rows || c >= board.cols) continue;
      result.push(r * board.cols + c);
    }
  }
  return result;
}

/** Places mines (never on `safeIndex` or its neighbours) and counts adjacencies. */
export function plantMines(board: Board, safeIndex: number, random = Math.random): Board {
  const next: Board = { ...board, cells: board.cells.map((cell) => ({ ...cell })) };
  const forbidden = new Set([safeIndex, ...neighbours(board, safeIndex)]);
  const candidates = next.cells.map((_, index) => index).filter((index) => !forbidden.has(index));
  const count = Math.min(next.mines, candidates.length);
  for (let placed = 0; placed < count; placed += 1) {
    const pick = Math.floor(random() * candidates.length);
    const index = candidates.splice(pick, 1)[0];
    next.cells[index].mine = true;
  }
  next.cells.forEach((cell, index) => {
    cell.adjacent = neighbours(next, index).filter((near) => next.cells[near].mine).length;
  });
  return next;
}

export function reveal(board: Board, index: number): Board {
  const next: Board = { ...board, cells: board.cells.map((cell) => ({ ...cell })) };
  const stack = [index];
  while (stack.length) {
    const current = stack.pop()!;
    const cell = next.cells[current];
    if (!cell || cell.revealed || cell.flagged) continue;
    cell.revealed = true;
    if (cell.mine || cell.adjacent > 0) continue;
    // Blank cell: everything around it opens too.
    for (const near of neighbours(next, current)) {
      if (!next.cells[near].revealed && !next.cells[near].flagged) stack.push(near);
    }
  }
  return next;
}

export function toggleFlag(board: Board, index: number): Board {
  const next: Board = { ...board, cells: board.cells.map((cell) => ({ ...cell })) };
  const cell = next.cells[index];
  if (cell && !cell.revealed) cell.flagged = !cell.flagged;
  return next;
}

export function isLost(board: Board): boolean {
  return board.cells.some((cell) => cell.mine && cell.revealed);
}

export function isWon(board: Board): boolean {
  return board.cells.every((cell) => cell.mine || cell.revealed);
}

export function flagCount(board: Board): number {
  return board.cells.filter((cell) => cell.flagged).length;
}

export function revealAll(board: Board, onlyMines = false): Board {
  return {
    ...board,
    cells: board.cells.map((cell) => ({
      ...cell,
      revealed: cell.revealed || cell.mine || !onlyMines,
    })),
  };
}
