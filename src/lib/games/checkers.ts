/**
 * CHECKERS (American draughts) — rules engine + small search.
 *
 * Red is the player (moving up the board), black is the AI. Captures are
 * mandatory and the longest capture chain must be played, which is what makes
 * the AI's threats real rather than decorative.
 *
 * Squares are 0..63 with a8 = 0; only the dark squares are ever occupied.
 */

export type CheckersCell = null | "r" | "R" | "b" | "B";
export type CheckersSide = "r" | "b";
export type CheckersMove = {
  from: number;
  to: number;
  /** Every square visited, for a multi-jump. */
  path: number[];
  captures: number[];
  promote: boolean;
};

export type CheckersState = {
  board: CheckersCell[];
  turn: CheckersSide;
  /** Set while a multi-jump is in progress: the only piece that may move. */
  chainFrom: number | null;
};

export function initialState(): CheckersState {
  const board: CheckersCell[] = new Array(64).fill(null);
  for (let square = 0; square < 64; square += 1) {
    const file = square % 8;
    const rank = Math.floor(square / 8);
    if ((file + rank) % 2 === 0) continue; // dark squares only
    if (rank < 3) board[square] = "b";
    else if (rank > 4) board[square] = "r";
  }
  return { board, turn: "r", chainFrom: null };
}

function neighbour(square: number, dFile: number, dRank: number): number | null {
  const file = square % 8;
  const rank = Math.floor(square / 8);
  const nextFile = file + dFile;
  const nextRank = rank + dRank;
  if (nextFile < 0 || nextFile > 7 || nextRank < 0 || nextRank > 7) return null;
  return nextRank * 8 + nextFile;
}

export function sideOf(cell: CheckersCell): CheckersSide | null {
  if (!cell) return null;
  return cell === cell.toLowerCase()
    ? (cell as CheckersSide)
    : (cell.toLowerCase() as CheckersSide);
}

export function isKing(cell: CheckersCell): boolean {
  return cell === "R" || cell === "B";
}

/** Diagonal steps this piece may take: men only forward, kings both ways. */
function steps(cell: CheckersCell): [number, number][] {
  if (isKing(cell))
    return [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];
  return cell === "r"
    ? [
        [1, -1],
        [-1, -1],
      ]
    : [
        [1, 1],
        [-1, 1],
      ];
}

function jumpDirections(cell: CheckersCell): [number, number][] {
  return isKing(cell)
    ? [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]
    : steps(cell);
}

function collectsAllJumps(
  board: CheckersCell[],
  from: number,
  cell: string,
  captured: number[],
  taken: Set<number>,
  path: number[],
  out: CheckersMove[],
) {
  let extended = false;
  for (const [dFile, dRank] of jumpDirections(cell as CheckersCell)) {
    const over = neighbour(from, dFile, dRank);
    if (over === null) continue;
    const victim = board[over];
    if (!victim || sideOf(victim) === sideOf(cell as CheckersCell) || taken.has(over)) continue;
    const landing = neighbour(over, dFile, dRank);
    if (landing === null || board[landing]) continue;
    extended = true;
    const nextBoard = board.slice();
    nextBoard[from] = null;
    nextBoard[over] = null;
    const promoted =
      cell === "r" && Math.floor(landing / 8) === 0
        ? "R"
        : cell === "b" && Math.floor(landing / 8) === 7
          ? "B"
          : cell;
    nextBoard[landing] = promoted as CheckersCell;
    const nextTaken = new Set(taken);
    nextTaken.add(over);
    collectsAllJumps(
      nextBoard,
      landing,
      promoted,
      [...captured, over],
      nextTaken,
      [...path, landing],
      out,
    );
    // Promotion ends the turn, so chain only while still a man.
    if (promoted !== cell) {
      out.push({
        from: path[0],
        to: landing,
        path: [...path, landing],
        captures: [...captured, over],
        promote: true,
      });
    }
  }
  if (!extended && captured.length > 0) {
    out.push({
      from: path[0],
      to: path[path.length - 1],
      path,
      captures: captured,
      promote: false,
    });
  }
}

export function movesFor(state: CheckersState, from: number): CheckersMove[] {
  const cell = state.board[from];
  if (!cell || sideOf(cell) !== state.turn) return [];
  if (state.chainFrom !== null && state.chainFrom !== from) return [];

  const jumps: CheckersMove[] = [];
  collectsAllJumps(state.board, from, cell, [], new Set(), [from], jumps);
  const all: CheckersMove[] = jumps.map((move) => ({ ...move, from }));
  const quiet: CheckersMove[] = [];
  for (const [dFile, dRank] of steps(cell)) {
    const to = neighbour(from, dFile, dRank);
    if (to === null || state.board[to]) continue;
    const promote =
      cell === "r" ? Math.floor(to / 8) === 0 : cell === "b" ? Math.floor(to / 8) === 7 : false;
    quiet.push({ from, to, path: [from, to], captures: [], promote });
  }
  return [...all, ...quiet];
}

export function generateMoves(state: CheckersState): CheckersMove[] {
  const moves: CheckersMove[] = [];
  for (let square = 0; square < 64; square += 1) {
    if (sideOf(state.board[square]) !== state.turn) continue;
    moves.push(...movesFor(state, square).filter((move) => move.captures.length > 0));
  }
  if (moves.length > 0) {
    // American rules: if you can capture, you must — and you must take the most.
    const longest = Math.max(...moves.map((move) => move.captures.length));
    return moves.filter((move) => move.captures.length === longest);
  }
  for (let square = 0; square < 64; square += 1) {
    if (sideOf(state.board[square]) !== state.turn) continue;
    moves.push(...movesFor(state, square).filter((move) => move.captures.length === 0));
  }
  return moves;
}

export function applyMove(state: CheckersState, move: CheckersMove): CheckersState {
  const board = state.board.slice();
  const cell = board[move.from]!;
  // Replay the path so multi-jumps clear every victim in between.
  let cursor = move.from;
  board[move.from] = null;
  for (const landing of move.path.slice(1)) {
    const over = (cursor + landing) / 2;
    if (board[over] && sideOf(board[over]) !== sideOf(cell)) board[over] = null;
    cursor = landing;
  }
  let landed: CheckersCell = cell;
  if (cell === "r" && Math.floor(cursor / 8) === 0) landed = "R";
  if (cell === "b" && Math.floor(cursor / 8) === 7) landed = "B";
  board[cursor] = landed;

  return {
    board,
    turn: state.turn === "r" ? "b" : "r",
    chainFrom: null,
  };
}

export function pieceCount(board: CheckersCell[], side: CheckersSide): number {
  return board.filter((cell) => sideOf(cell) === side).length;
}

export function winnerOf(state: CheckersState): CheckersSide | null {
  const reds = pieceCount(state.board, "r");
  const blacks = pieceCount(state.board, "b");
  if (reds === 0) return "b";
  if (blacks === 0) return "r";
  if (generateMoves(state).length === 0) return state.turn === "r" ? "b" : "r";
  return null;
}

function evaluate(state: CheckersState): number {
  let score = 0;
  for (let square = 0; square < 64; square += 1) {
    const cell = state.board[square];
    if (!cell) continue;
    const side = sideOf(cell)!;
    const value = isKing(cell) ? 260 : 100;
    // Advancing men are worth more: it is how the game is actually won.
    const rank = Math.floor(square / 8);
    const advance = isKing(cell) ? 0 : side === "r" ? (7 - rank) * 4 : rank * 4;
    score += side === "r" ? value + advance : -(value + advance);
  }
  return score;
}

function negamax(state: CheckersState, depth: number, alpha: number, beta: number): number {
  const over = winnerOf(state);
  if (over === "r") return 100000 + depth;
  if (over === "b") return -100000 - depth;
  if (depth === 0) return state.turn === "r" ? evaluate(state) : -evaluate(state);
  const moves = generateMoves(state);
  if (moves.length === 0) return state.turn === "r" ? -100000 : 100000;

  let best = -Infinity;
  const ordered = moves.slice().sort((a, b) => b.captures.length - a.captures.length);
  for (const move of ordered) {
    const score = -negamax(applyMove(state, move), depth - 1, -beta, -alpha);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

export function bestMove(state: CheckersState, depth = 5): CheckersMove | null {
  const moves = generateMoves(state);
  if (moves.length === 0) return null;
  let best: CheckersMove | null = null;
  let bestScore = -Infinity;
  for (const move of moves) {
    const score = -negamax(applyMove(state, move), depth - 1, -Infinity, Infinity) + Math.random();
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}
