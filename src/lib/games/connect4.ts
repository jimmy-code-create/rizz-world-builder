/** CONNECT FOUR — 7 columns x 6 rows, minimax AI with immediate win/block. */

export const COLS = 7;
export const ROWS = 6;
export type Player = 1 | 2;
export type Board = number[]; // 42 cells, row-major from the top

export const emptyBoard = (): Board => new Array(COLS * ROWS).fill(0);

const index = (col: number, row: number) => row * COLS + col;

/** Lowest empty row in a column, or null when the column is full. */
export function dropRow(board: Board, col: number): number | null {
  for (let row = ROWS - 1; row >= 0; row -= 1) {
    if (!board[index(col, row)]) return row;
  }
  return null;
}

export function drop(board: Board, col: number, player: Player): Board | null {
  const row = dropRow(board, col);
  if (row === null) return null;
  const next = board.slice();
  next[index(col, row)] = player;
  return next;
}

export function legalColumns(board: Board): number[] {
  const columns: number[] = [];
  for (let col = 0; col < COLS; col += 1) if (dropRow(board, col) !== null) columns.push(col);
  return columns;
}

const DIRECTIONS: [number, number][] = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

export function winningLine(board: Board, player: Player): number[] | null {
  for (let col = 0; col < COLS; col += 1) {
    for (let row = 0; row < ROWS; row += 1) {
      if (board[index(col, row)] !== player) continue;
      for (const [dc, dr] of DIRECTIONS) {
        const line: number[] = [];
        for (let step = 0; step < 4; step += 1) {
          const c = col + dc * step;
          const r = row + dr * step;
          if (c < 0 || c >= COLS || r < 0 || r >= ROWS) break;
          if (board[index(c, r)] !== player) break;
          line.push(index(c, r));
        }
        if (line.length === 4) return line;
      }
    }
  }
  return null;
}

export function winnerOf(board: Board): Player | null {
  if (winningLine(board, 1)) return 1;
  if (winningLine(board, 2)) return 2;
  return null;
}

export function isFull(board: Board): boolean {
  return board.every((cell) => cell !== 0);
}

function scoreWindow(cells: number[], player: Player): number {
  const mine = cells.filter((cell) => cell === player).length;
  const theirs = cells.filter((cell) => cell !== 0 && cell !== player).length;
  if (mine > 0 && theirs > 0) return 0;
  if (mine === 4) return 100000;
  if (mine === 3) return 40;
  if (mine === 2) return 8;
  return 0;
}

function evaluate(board: Board, player: Player): number {
  const opponent = player === 1 ? 2 : 1;
  let score = 0;
  // The centre column is worth owning: every long threat goes through it.
  for (let row = 0; row < ROWS; row += 1) {
    const centre = board[index(3, row)];
    if (centre === player) score += 6;
    else if (centre === opponent) score -= 6;
  }
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      for (const [dc, dr] of DIRECTIONS) {
        const window: number[] = [];
        for (let step = 0; step < 4; step += 1) {
          const c = col + dc * step;
          const r = row + dr * step;
          if (c < 0 || c >= COLS || r < 0 || r >= ROWS) break;
          window.push(board[index(c, r)]);
        }
        if (window.length === 4)
          score += scoreWindow(window, player) - scoreWindow(window, opponent);
      }
    }
  }
  return score;
}

function negamax(board: Board, player: Player, depth: number, alpha: number, beta: number): number {
  const winner = winnerOf(board);
  if (winner === player) return 100000 + depth;
  if (winner && winner !== player) return -100000 - depth;
  if (depth === 0 || isFull(board)) return evaluate(board, player);

  let best = -Infinity;
  const opponent = player === 1 ? 2 : 1;
  for (const col of legalColumns(board)) {
    const next = drop(board, col, player)!;
    const score = -negamax(next, opponent, depth - 1, -beta, -alpha);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/** Returns a column: an immediate win first, then an immediate block, then search. */
export function bestColumn(board: Board, player: Player, depth = 5): number | null {
  const opponent = player === 1 ? 2 : 1;
  const columns = legalColumns(board);
  if (columns.length === 0) return null;

  for (const col of columns) {
    if (winningLine(drop(board, col, player)!, player)) return col;
  }
  for (const col of columns) {
    if (winningLine(drop(board, col, opponent)!, opponent)) return col;
  }

  let best: number | null = null;
  let bestScore = -Infinity;
  const ordered = columns.slice().sort((a, b) => Math.abs(3 - a) - Math.abs(3 - b));
  for (const col of ordered) {
    const score = -negamax(drop(board, col, player)!, opponent, depth - 1, -Infinity, Infinity);
    if (score > bestScore) {
      bestScore = score;
      best = col;
    }
  }
  return best;
}
