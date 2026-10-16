/**
 * CHESS ENGINE — board, legal moves, status and a small search.
 *
 * Kept free of React and of any canvas: the board UI reads this, and the rules
 * can be driven headlessly (see `scripts/arcade-check.ts`, which runs perft and
 * therefore proves that move generation, castling, en passant and promotion
 * match the published node counts).
 *
 * Squares are 0..63, a8 = 0 … h1 = 63. Pieces are two-letter codes ("wp", "bk")
 * so a board prints readably in a debugger.
 */

export type Color = "w" | "b";
export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";
export type Piece = `${Color}${PieceType}`;
export type Move = {
  from: number;
  to: number;
  promo?: PieceType;
  capture?: Piece;
  enPassant?: boolean;
  castle?: "k" | "q";
};

export type ChessState = {
  board: (Piece | null)[];
  turn: Color;
  castling: { wk: boolean; wq: boolean; bk: boolean; bq: boolean };
  /** Square a pawn may capture onto, or null. */
  ep: number | null;
  halfmove: number;
  fullmove: number;
};

export const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
export const PIECE_VALUE: Record<PieceType, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
};
export const PIECE_NAME: Record<PieceType, string> = {
  p: "Pawn",
  n: "Knight",
  b: "Bishop",
  r: "Rook",
  q: "Queen",
  k: "King",
};

export function squareName(square: number): string {
  return `${FILES[square % 8]}${8 - Math.floor(square / 8)}`;
}

export function initialState(): ChessState {
  const board: (Piece | null)[] = new Array(64).fill(null);
  const back: PieceType[] = ["r", "n", "b", "q", "k", "b", "n", "r"];
  for (let file = 0; file < 8; file += 1) {
    board[file] = `b${back[file]}`;
    board[8 + file] = "bp";
    board[48 + file] = "wp";
    board[56 + file] = `w${back[file]}`;
  }
  return {
    board,
    turn: "w",
    castling: { wk: true, wq: true, bk: true, bq: true },
    ep: null,
    halfmove: 0,
    fullmove: 1,
  };
}

const KNIGHT_JUMPS: [number, number][] = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
];
const KING_STEPS: [number, number][] = [
  [0, 1],
  [1, 1],
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, -1],
  [-1, 0],
  [-1, 1],
];
const DIAGONALS: [number, number][] = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
const ORTHOGONALS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/**
 * Board neighbour: (file + dFile, rank + dRank), or null when it falls off.
 * Every piece walk in this file goes through here — index arithmetic on a
 * 0..63 array is exactly where the classic wrap-around bugs live.
 */
function offset(from: number, dFile: number, dRank: number): number | null {
  const file = from % 8;
  const rank = Math.floor(from / 8);
  const nextFile = file + dFile;
  const nextRank = rank + dRank;
  if (nextFile < 0 || nextFile > 7 || nextRank < 0 || nextRank > 7) return null;
  return nextRank * 8 + nextFile;
}

export function kingSquare(board: (Piece | null)[], color: Color): number {
  const king: Piece = `${color}k`;
  for (let i = 0; i < 64; i += 1) if (board[i] === king) return i;
  return -1;
}

export function isAttacked(board: (Piece | null)[], square: number, by: Color): boolean {
  // Pawns: a white pawn attacks the square in front of it, one file either side.
  const dRank = by === "w" ? 1 : -1;
  for (const dFile of [-1, 1]) {
    const from = offset(square, dFile, dRank);
    if (from !== null && board[from] === `${by}p`) return true;
  }
  for (const [dFile, dRankJump] of KNIGHT_JUMPS) {
    const target = offset(square, dFile, dRankJump);
    if (target !== null && board[target] === `${by}n`) return true;
  }
  for (const [dFile, dRankStep] of KING_STEPS) {
    const target = offset(square, dFile, dRankStep);
    if (target !== null && board[target] === `${by}k`) return true;
  }
  for (const [dFile, dRankRay] of DIAGONALS) {
    for (
      let cursor = offset(square, dFile, dRankRay);
      cursor !== null;
      cursor = offset(cursor, dFile, dRankRay)
    ) {
      const piece = board[cursor];
      if (!piece) continue;
      if (piece[0] === by && (piece[1] === "b" || piece[1] === "q")) return true;
      break;
    }
  }
  for (const [dFile, dRankRay] of ORTHOGONALS) {
    for (
      let cursor = offset(square, dFile, dRankRay);
      cursor !== null;
      cursor = offset(cursor, dFile, dRankRay)
    ) {
      const piece = board[cursor];
      if (!piece) continue;
      if (piece[0] === by && (piece[1] === "r" || piece[1] === "q")) return true;
      break;
    }
  }
  return false;
}

export function inCheck(state: ChessState, color: Color): boolean {
  const king = kingSquare(state.board, color);
  if (king < 0) return false;
  return isAttacked(state.board, king, color === "w" ? "b" : "w");
}

const PROMOTIONS: PieceType[] = ["q", "r", "b", "n"];

/** Pseudo-legal moves (castling included), before the king-safety filter. */
function pseudoMoves(state: ChessState): Move[] {
  const moves: Move[] = [];
  const { board, turn } = state;
  for (let from = 0; from < 64; from += 1) {
    const piece = board[from];
    if (!piece || piece[0] !== turn) continue;
    const type = piece[1] as PieceType;
    const add = (to: number, extra: Partial<Move> = {}) =>
      moves.push({ from, to, capture: board[to] ?? extra.capture, ...extra });

    if (type === "p") {
      const forward = turn === "w" ? -1 : 1;
      const startRank = turn === "w" ? 6 : 1;
      const promoRank = turn === "w" ? 0 : 7;
      const one = offset(from, 0, forward);
      if (one !== null && !board[one]) {
        const rank = Math.floor(one / 8);
        if (rank === promoRank) for (const promo of PROMOTIONS) add(one, { promo });
        else add(one);
        const two = offset(from, 0, forward * 2);
        if (Math.floor(from / 8) === startRank && two !== null && !board[two]) add(two);
      }
      for (const dFile of [-1, 1]) {
        const to = offset(from, dFile, forward);
        if (to === null) continue;
        const target = board[to];
        if (target && target[0] !== turn) {
          if (Math.floor(to / 8) === promoRank) for (const promo of PROMOTIONS) add(to, { promo });
          else add(to);
        } else if (!target && state.ep === to) {
          add(to, { enPassant: true, capture: `${turn === "w" ? "b" : "w"}p` });
        }
      }
      continue;
    }

    if (type === "n" || type === "k") {
      const deltas = type === "n" ? KNIGHT_JUMPS : KING_STEPS;
      for (const [dFile, dRank] of deltas) {
        const to = offset(from, dFile, dRank);
        if (to === null) continue;
        const target = board[to];
        if (!target || target[0] !== turn) add(to);
      }
      continue;
    }

    const directions: [number, number][] =
      type === "r" ? ORTHOGONALS : type === "b" ? DIAGONALS : [...ORTHOGONALS, ...DIAGONALS];
    for (const [dFile, dRank] of directions) {
      let cursor = from;
      for (;;) {
        const to = offset(cursor, dFile, dRank);
        if (to === null) break;
        const target = board[to];
        if (!target) add(to);
        else {
          if (target[0] !== turn) add(to);
          break;
        }
        cursor = to;
      }
    }
  }

  // Castling: rights, empty path, and the king may not start, cross or land in check.
  const king = turn === "w" ? 60 : 4;
  const rights =
    turn === "w" ? [state.castling.wk, state.castling.wq] : [state.castling.bk, state.castling.bq];
  const enemy: Color = turn === "w" ? "b" : "w";
  if (board[king] === `${turn}k` && !isAttacked(board, king, enemy)) {
    if (rights[0] && !board[king + 1] && !board[king + 2] && board[king + 3] === `${turn}r`) {
      if (!isAttacked(board, king + 1, enemy) && !isAttacked(board, king + 2, enemy)) {
        moves.push({ from: king, to: king + 2, castle: "k" });
      }
    }
    if (
      rights[1] &&
      !board[king - 1] &&
      !board[king - 2] &&
      !board[king - 3] &&
      board[king - 4] === `${turn}r`
    ) {
      if (!isAttacked(board, king - 1, enemy) && !isAttacked(board, king - 2, enemy)) {
        moves.push({ from: king, to: king - 2, castle: "q" });
      }
    }
  }

  return moves;
}

export function applyMove(state: ChessState, move: Move): ChessState {
  const board = state.board.slice();
  const piece = board[move.from];
  if (!piece) return state;
  const turn = state.turn;
  const castling = { ...state.castling };

  board[move.from] = null;
  if (move.enPassant) {
    board[turn === "w" ? move.to + 8 : move.to - 8] = null;
  }
  board[move.to] = move.promo ? (`${turn}${move.promo}` as Piece) : piece;

  if (move.castle) {
    if (move.castle === "k") {
      board[move.to - 1] = board[move.to + 1];
      board[move.to + 1] = null;
    } else {
      board[move.to + 1] = board[move.to - 2];
      board[move.to - 2] = null;
    }
  }

  if (piece[1] === "k") {
    if (turn === "w") {
      castling.wk = false;
      castling.wq = false;
    } else {
      castling.bk = false;
      castling.bq = false;
    }
  }
  if (move.from === 63 || move.to === 63) castling.wk = false;
  if (move.from === 56 || move.to === 56) castling.wq = false;
  if (move.from === 7 || move.to === 7) castling.bk = false;
  if (move.from === 0 || move.to === 0) castling.bq = false;

  const ep =
    piece[1] === "p" && Math.abs(move.to - move.from) === 16 ? (move.from + move.to) / 2 : null;

  return {
    board,
    turn: turn === "w" ? "b" : "w",
    castling,
    ep,
    halfmove: move.capture || piece[1] === "p" ? 0 : state.halfmove + 1,
    fullmove: turn === "b" ? state.fullmove + 1 : state.fullmove,
  };
}

export function generateMoves(state: ChessState): Move[] {
  const enemy: Color = state.turn === "w" ? "b" : "w";
  return pseudoMoves(state).filter((move) => {
    const next = applyMove(state, move);
    const king = kingSquare(next.board, state.turn);
    return king >= 0 && !isAttacked(next.board, king, enemy);
  });
}

export type ChessStatus = {
  over: boolean;
  result: "checkmate" | "stalemate" | null;
  winner: Color | null;
  check: boolean;
  moves: Move[];
};

export function status(state: ChessState): ChessStatus {
  const moves = generateMoves(state);
  const check = inCheck(state, state.turn);
  if (moves.length > 0) return { over: false, result: null, winner: null, check, moves };
  if (check) {
    return {
      over: true,
      result: "checkmate",
      winner: state.turn === "w" ? "b" : "w",
      check,
      moves,
    };
  }
  return { over: true, result: "stalemate", winner: null, check, moves };
}

/** Static evaluation from White's point of view (centipawns). */
export function evaluate(state: ChessState): number {
  let score = 0;
  for (let square = 0; square < 64; square += 1) {
    const piece = state.board[square];
    if (!piece) continue;
    const file = square % 8;
    const rank = Math.floor(square / 8);
    const centre = (file === 3 || file === 4 ? 12 : 0) + (rank >= 2 && rank <= 5 ? 8 : 0);
    const advance = piece[1] === "p" ? (piece[0] === "w" ? (6 - rank) * 6 : (rank - 1) * 6) : 0;
    const value = PIECE_VALUE[piece[1] as PieceType] + centre + advance;
    score += piece[0] === "w" ? value : -value;
  }
  return score;
}

function negamax(state: ChessState, depth: number, alpha: number, beta: number): number {
  const moves = generateMoves(state);
  if (moves.length === 0) return inCheck(state, state.turn) ? -100000 - depth : 0;
  if (depth === 0) return state.turn === "w" ? evaluate(state) : -evaluate(state);

  let best = -Infinity;
  const ordered = moves
    .slice()
    .sort(
      (a, b) =>
        (b.capture ? PIECE_VALUE[b.capture[1] as PieceType] : 0) -
        (a.capture ? PIECE_VALUE[a.capture[1] as PieceType] : 0),
    );
  for (const move of ordered) {
    const score = -negamax(applyMove(state, move), depth - 1, -beta, -alpha);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/** Best move for whoever is to play. Depth 3 is already a decent club player. */
export function bestMove(state: ChessState, depth = 3): Move | null {
  const moves = generateMoves(state);
  if (moves.length === 0) return null;
  let best: Move | null = null;
  let bestScore = -Infinity;
  const ordered = moves
    .slice()
    .sort(
      (a, b) =>
        (b.capture ? PIECE_VALUE[b.capture[1] as PieceType] : 0) -
        (a.capture ? PIECE_VALUE[a.capture[1] as PieceType] : 0),
    );
  for (const move of ordered) {
    const score =
      -negamax(applyMove(state, move), depth - 1, -Infinity, Infinity) + Math.random() * 4;
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}

/** Node count for a depth — the standard rules test (1, 20, 400, 8902 …). */
export function perft(state: ChessState, depth: number): number {
  const moves = generateMoves(state);
  if (depth <= 1) return moves.length;
  let nodes = 0;
  for (const move of moves) nodes += perft(applyMove(state, move), depth - 1);
  return nodes;
}

/** Compact, readable label: "Nf3", "exd5", "O-O", "e8=Q". */
export function moveLabel(state: ChessState, move: Move): string {
  if (move.castle) return move.castle === "k" ? "O-O" : "O-O-O";
  const piece = state.board[move.from];
  const type = (piece?.[1] ?? "p") as PieceType;
  const letter = type === "p" ? "" : type.toUpperCase();
  const capture = move.capture ? (type === "p" ? `${FILES[move.from % 8]}x` : "x") : "";
  const promo = move.promo ? `=${move.promo.toUpperCase()}` : "";
  return `${letter}${capture}${squareName(move.to)}${promo}`;
}
