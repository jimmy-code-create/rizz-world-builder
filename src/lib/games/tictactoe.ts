/** TIC-TAC-TOE — a perfect minimax opponent (the AI can be beaten only by a draw). */

export type Mark = "X" | "O";
export type TttBoard = (Mark | null)[];

export const LINES: number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export const emptyBoard = (): TttBoard => new Array(9).fill(null);

export function winnerOf(board: TttBoard): { mark: Mark; line: number[] } | null {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { mark: board[a] as Mark, line };
    }
  }
  return null;
}

export function isFull(board: TttBoard): boolean {
  return board.every(Boolean);
}

export function freeCells(board: TttBoard): number[] {
  const cells: number[] = [];
  board.forEach((cell, index) => {
    if (!cell) cells.push(index);
  });
  return cells;
}

function minimax(board: TttBoard, me: Mark, turn: Mark, depth: number): number {
  const win = winnerOf(board);
  if (win) return win.mark === me ? 10 - depth : depth - 10;
  const free = freeCells(board);
  if (free.length === 0) return 0;

  const scores = free.map((cell) => {
    const next = board.slice();
    next[cell] = turn;
    return minimax(next, me, turn === "X" ? "O" : "X", depth + 1);
  });
  return turn === me ? Math.max(...scores) : Math.min(...scores);
}

/** Perfect move: prefer the fastest win, then the slowest loss, then the centre. */
export function bestCell(board: TttBoard, me: Mark): number | null {
  const free = freeCells(board);
  if (free.length === 0) return null;
  const turn = me;
  let best: number | null = null;
  let bestScore = -Infinity;
  const ordered = free.slice().sort((a, b) => (a === 4 ? -1 : b === 4 ? 1 : 0));
  for (const cell of ordered) {
    const next = board.slice();
    next[cell] = me;
    const score = minimax(next, me, turn === "X" ? "O" : "X", 1);
    if (score > bestScore) {
      bestScore = score;
      best = cell;
    }
  }
  return best;
}
