/**
 * REVERSI (OTHELLO) — legal-move generation, flipping and a corner-aware AI.
 *
 * Black moves first and is the player here; White is the AI.
 */

export type Disc = "b" | "w";
export type ReversiBoard = (Disc | null)[];

const DIRECTIONS: [number, number][] = [
  [1, 1],
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

export function initialState(): ReversiBoard {
  const board: ReversiBoard = new Array(64).fill(null);
  board[27] = "w"; // d4
  board[28] = "b"; // e4
  board[35] = "b"; // d5
  board[36] = "w"; // e5
  return board;
}

function neighbour(square: number, dFile: number, dRank: number): number | null {
  const file = square % 8;
  const rank = Math.floor(square / 8);
  const nextFile = file + dFile;
  const nextRank = rank + dRank;
  if (nextFile < 0 || nextFile > 7 || nextRank < 0 || nextRank > 7) return null;
  return nextRank * 8 + nextFile;
}

export function other(disc: Disc): Disc {
  return disc === "b" ? "w" : "b";
}

/** Discs this move would flip; empty means the move is illegal. */
export function flipsFor(board: ReversiBoard, square: number, disc: Disc): number[] {
  if (board[square]) return [];
  const flips: number[] = [];
  for (const [dFile, dRank] of DIRECTIONS) {
    const captured: number[] = [];
    let cursor = neighbour(square, dFile, dRank);
    while (cursor !== null && board[cursor] === other(disc)) {
      captured.push(cursor);
      cursor = neighbour(cursor, dFile, dRank);
    }
    if (captured.length > 0 && cursor !== null && board[cursor] === disc) flips.push(...captured);
  }
  return flips;
}

export function legalMoves(board: ReversiBoard, disc: Disc): { square: number; flips: number[] }[] {
  const moves: { square: number; flips: number[] }[] = [];
  for (let square = 0; square < 64; square += 1) {
    const flips = flipsFor(board, square, disc);
    if (flips.length > 0) moves.push({ square, flips });
  }
  return moves;
}

export function applyMove(board: ReversiBoard, square: number, disc: Disc): ReversiBoard | null {
  const flips = flipsFor(board, square, disc);
  if (flips.length === 0) return null;
  const next = board.slice();
  next[square] = disc;
  for (const flip of flips) next[flip] = disc;
  return next;
}

export function counts(board: ReversiBoard): { b: number; w: number } {
  let b = 0;
  let w = 0;
  for (const disc of board) {
    if (disc === "b") b += 1;
    else if (disc === "w") w += 1;
  }
  return { b, w };
}

const CORNERS = new Set([0, 7, 56, 63]);

function evaluate(board: ReversiBoard, disc: Disc): number {
  const mine = counts(board);
  const own = disc === "b" ? mine.b : mine.w;
  const theirs = disc === "b" ? mine.w : mine.b;
  let score = (own - theirs) * 2;
  for (const corner of CORNERS) {
    if (board[corner] === disc) score += 30;
    else if (board[corner] === other(disc)) score -= 30;
  }
  score += legalMoves(board, disc).length * 3;
  return score;
}

function negamax(
  board: ReversiBoard,
  disc: Disc,
  depth: number,
  alpha: number,
  beta: number,
): number {
  const moves = legalMoves(board, disc);
  if (moves.length === 0) {
    // Passing: if the opponent cannot move either, the game is decided by count.
    if (legalMoves(board, other(disc)).length === 0) {
      const totals = counts(board);
      const own = disc === "b" ? totals.b : totals.w;
      const theirs = disc === "b" ? totals.w : totals.b;
      return own === theirs ? 0 : own > theirs ? 100000 : -100000;
    }
    return -negamax(board, other(disc), depth, -beta, -alpha);
  }
  if (depth === 0) return evaluate(board, disc);

  let best = -Infinity;
  const ordered = moves
    .slice()
    .sort((a, b) => (CORNERS.has(b.square) ? 1 : 0) - (CORNERS.has(a.square) ? 1 : 0));
  for (const move of ordered) {
    const score = -negamax(
      applyMove(board, move.square, disc)!,
      other(disc),
      depth - 1,
      -beta,
      -alpha,
    );
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

export function bestSquare(board: ReversiBoard, disc: Disc, depth = 3): number | null {
  const moves = legalMoves(board, disc);
  if (moves.length === 0) return null;
  let best: number | null = null;
  let bestScore = -Infinity;
  for (const move of moves) {
    const score =
      -negamax(applyMove(board, move.square, disc)!, other(disc), depth - 1, -Infinity, Infinity) +
      (CORNERS.has(move.square) ? 5 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = move.square;
    }
  }
  return best;
}
