/**
 * Headless checks for every game in RIZZ (`bun run arcade:check`).
 *
 * The games are pure simulations underneath their canvases and boards, so the
 * rules can be driven here — where a failure is a red line in a terminal instead
 * of a broken round in someone's voice call. Chess is checked with perft, the
 * published node counts, which proves the move generator (castling, en passant,
 * promotion) rather than just "it didn't throw".
 */
import { createWorld as createArena, stepBot } from "@/components/games/pixel-arena";
import { createWorld as createSnake, stepWorld as stepSnake } from "@/components/games/neon-snake";
import {
  createWorld as createRally,
  paddleGeometry,
  serve,
  stepWorld as stepRally,
  type RallyWorld,
} from "@/components/games/pixel-rally";
import {
  initialState as chessStart,
  perft,
  generateMoves,
  applyMove,
  bestMove,
  status,
  squareName,
} from "@/lib/games/chess";
import {
  applyMove as applyCheckers,
  generateMoves as checkersMoves,
  initialState as checkersStart,
  pieceCount,
  winnerOf,
} from "@/lib/games/checkers";
import {
  bestColumn,
  drop,
  emptyBoard as emptyC4,
  isFull,
  winnerOf as c4Winner,
} from "@/lib/games/connect4";
import { bestCell, emptyBoard as emptyTtt, winnerOf as tttWinner } from "@/lib/games/tictactoe";
import {
  applyMove as applyReversi,
  bestSquare,
  counts,
  initialState as reversiStart,
  legalMoves,
} from "@/lib/games/reversi";
import { canMove, score as g2048Score, slide, spawn, startGrid, bestTile } from "@/lib/games/g2048";
import {
  emptyBoard as emptyMines,
  isWon,
  plantMines,
  reveal,
  toggleFlag,
} from "@/lib/games/minesweeper";
import {
  conflictsIn,
  countSolutions,
  isComplete,
  makePuzzle,
  nextHint,
  solve,
} from "@/lib/games/sudoku";
import { bricksLeft, createBreakout, stepBreakout } from "@/lib/games/breakout";
import { createShooter, stepShooter } from "@/lib/games/shooter";

const fail: string[] = [];
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) fail.push(label);
};

const finite = (values: number[]) => values.every((value) => Number.isFinite(value));

// ---------------------------------------------------------------- chess -----
{
  const start = chessStart();
  check(
    "chess: 20 opening moves",
    generateMoves(start).length === 20,
    `${generateMoves(start).length}`,
  );
  check("chess: perft(1) = 20", perft(start, 1) === 20);
  check("chess: perft(2) = 400", perft(start, 2) === 400, `${perft(start, 2)}`);
  const p3 = perft(start, 3);
  check("chess: perft(3) = 8902", p3 === 8902, `${p3}`);

  const toSquare = (name: string) => name.charCodeAt(0) - 97 + (8 - Number(name[1])) * 8;

  // Castling is offered once the path is clear, and is never offered through
  // an attacked square (white is in check or the path is covered).
  let castling = chessStart();
  const walk = (board: typeof castling, from: string, to: string) => {
    const move = generateMoves(board).find(
      (m) => m.from === toSquare(from) && m.to === toSquare(to),
    );
    if (!move) throw new Error(`illegal test move ${from}${to}`);
    return applyMove(board, move);
  };
  // Alternating moves: e4 (frees f1), a6, Bc4, a5, Nf3 (frees g1), a4 — now both
  // squares between king and rook are empty.
  castling = walk(castling, "e2", "e4");
  castling = walk(castling, "a7", "a6");
  castling = walk(castling, "f1", "c4");
  castling = walk(castling, "a6", "a5");
  castling = walk(castling, "g1", "f3");
  castling = walk(castling, "a5", "a4");
  check(
    "chess: castling is generated on a clear board",
    generateMoves(castling).some((move) => move.castle === "k"),
    `${generateMoves(castling).length} moves`,
  );
  const castled = walk(castling, "e1", "g1");
  check(
    "chess: castling moves the rook too",
    castled.board[toSquare("g1")] === "wk" && castled.board[toSquare("f1")] === "wr",
    `${castled.board[toSquare("g1")]}/${castled.board[toSquare("f1")]}`,
  );

  // En passant: after a double step the pawn behind it is capturable.
  let ep = chessStart();
  ep = walk(ep, "e2", "e4");
  ep = walk(ep, "a7", "a6");
  ep = walk(ep, "e4", "e5");
  ep = walk(ep, "d7", "d5");
  const epMove = generateMoves(ep).find((move) => move.enPassant);
  check("chess: en passant is available", !!epMove, epMove ? squareName(epMove.to) : "none");
  const epDone = epMove ? applyMove(ep, epMove) : ep;
  check(
    "chess: en passant lands on d6 and clears d5",
    epDone.board[toSquare("d6")] === "wp" && epDone.board[toSquare("d5")] === null,
    `${epDone.board[toSquare("d6")]}/${epDone.board[toSquare("d5")]}`,
  );

  // Fool's mate, laid out by hand: 1.f3 e5 2.g4 — the e5 pawn clears the
  // queen's diagonal, so Qh4 is mate.
  let mate = chessStart();
  mate = walk(mate, "f2", "f3");
  mate = walk(mate, "e7", "e5");
  mate = walk(mate, "g2", "g4");
  const mateMove = bestMove(mate, 3);
  check(
    "chess: engine finds mate-in-one",
    mateMove?.to === toSquare("h4"),
    mateMove ? squareName(mateMove.to) : "none",
  );
  const mated = applyMove(mate, mateMove!);
  const finished = status(mated);
  check(
    "chess: the engine's move really is checkmate",
    finished.over && finished.result === "checkmate" && finished.winner === "b",
    `${finished.result}/${finished.winner}`,
  );
}

// ------------------------------------------------------------- checkers -----
{
  const start = checkersStart();
  check(
    "checkers: 7 opening moves",
    checkersMoves(start).length === 7,
    `${checkersMoves(start).length}`,
  );
  check(
    "checkers: 12 pieces each",
    pieceCount(start.board, "r") === 12 && pieceCount(start.board, "b") === 12,
  );

  // A capture that is available must be played, even if a quiet move exists.
  const forced = checkersStart();
  forced.board = forced.board.map(() => null);
  forced.board[40] = "r"; // e3
  forced.board[33] = "R"; // f4 (king, so it can take upwards)
  forced.board[26] = "b"; // g5
  forced.board[19] = null;
  const moves = checkersMoves(forced);
  check(
    "checkers: captures are mandatory",
    moves.every((move) => move.captures.length > 0),
    `${moves.length} moves`,
  );
  const after = applyCheckers(forced, moves[0]);
  check("checkers: a jump removes the victim", pieceCount(after.board, "b") === 0);

  // Crowning: a red man landing on the far rank becomes a king.
  const crowning = checkersStart();
  crowning.board = crowning.board.map(() => null);
  crowning.board[8] = "r"; // a7 -> a8 is index 0
  const crownMoves = checkersMoves(crowning);
  const crowned = applyCheckers(crowning, crownMoves[0]);
  // a7 sits on the left edge, so the only forward diagonal is b8 (index 1).
  check(
    "checkers: reaching the far rank crowns a king",
    crowned.board[1] === "R",
    String(crowned.board[1]),
  );
  check(
    "checkers: winner detected when a side has no pieces",
    (() => {
      const empty = checkersStart();
      empty.board = empty.board.map((cell) => (cell === "r" ? null : cell));
      return winnerOf(empty) === "b";
    })(),
  );
}

// ----------------------------------------------------------- connect four ---
{
  let play = emptyC4();
  for (const col of [0, 1, 2, 3]) play = drop(play, col, 1)!;
  check("connect four: four in a row detected", c4Winner(play) === 1);
  const threat = drop(drop(drop(emptyC4(), 0, 2)!, 1, 2)!, 2, 2)!;
  check(
    "connect four: engine blocks an immediate four",
    bestColumn(threat, 1, 4) === 3,
    String(bestColumn(threat, 1, 4)),
  );
  const winning = drop(drop(drop(emptyC4(), 3, 2)!, 4, 2)!, 5, 2)!;
  const winColumn = bestColumn(winning, 2, 4);
  // Both ends complete the line, so the assertion is "a winning column", not a
  // specific one — the search is allowed to prefer either.
  check(
    "connect four: engine takes its own win",
    winColumn !== null && c4Winner(drop(winning, winColumn, 2)!) === 2,
    `column ${winColumn === null ? "none" : winColumn + 1}`,
  );
  check("connect four: empty board is not full", !isFull(emptyC4()));
}

// ---------------------------------------------------------- tic tac toe -----
{
  const board = emptyTtt();
  board[0] = "O";
  board[1] = "O";
  board[4] = "X";
  check("tic tac toe: engine takes its win", bestCell(board, "O") === 2);
  const mustBlock = emptyTtt();
  mustBlock[0] = "X";
  mustBlock[1] = "X";
  check("tic tac toe: engine blocks", bestCell(mustBlock, "O") === 2);
  check(
    "tic tac toe: win detection",
    tttWinner(["X", "X", "X", null, null, null, null, null, null])?.mark === "X",
  );
}

// --------------------------------------------------------------- reversi ----
{
  const start = reversiStart();
  check(
    "reversi: four opening moves",
    legalMoves(start, "b").length === 4,
    `${legalMoves(start, "b").length}`,
  );
  const placed = applyReversi(start, legalMoves(start, "b")[0].square, "b")!;
  const totals = counts(placed);
  check(
    "reversi: placing flips a disc",
    totals.b === 4 && totals.w === 1,
    `${totals.b}-${totals.w}`,
  );
  check("reversi: engine always returns a legal square", bestSquare(start, "w", 2) !== null);
}

// ------------------------------------------------------------------ 2048 ----
{
  const grid = [2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const left = slide(grid, "left");
  check(
    "2048: [2,2,2,2] merges to [4,4]",
    left.grid[0] === 4 && left.grid[1] === 4 && left.grid[2] === 0,
    left.grid.slice(0, 4).join(","),
  );
  check("2048: merge score is 8", left.gained === 8, `${left.gained}`);
  const right = slide(grid, "right");
  check("2048: right shift packs the far end", right.grid[3] === 4 && right.grid[2] === 4);
  const noMove = slide([2, 4, 8, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "left");
  check("2048: an unchanged slide reports no movement", !noMove.moved);
  const started = startGrid();
  check(
    "2048: a new game starts with two tiles",
    started.filter(Boolean).length === 2,
    `${started.filter(Boolean).length}`,
  );
  const spawned = spawn([2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 4]);
  check("2048: spawn fills a free cell", spawned[14] !== 0);
  check(
    "2048: best tile and score helpers",
    bestTile([2, 8, 4]) === 8 && g2048Score([2, 8, 4]) === 14,
  );
  check(
    "2048: a full board with no merges cannot move",
    !canMove([2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2]),
  );
}

// ----------------------------------------------------------- minesweeper ----
{
  const board = emptyMines(9, 9, 10);
  const planted = plantMines(board, 40);
  check("minesweeper: mines are placed", planted.cells.filter((cell) => cell.mine).length === 10);
  const safe = new Set([40, 39, 41, 31, 49, 30, 32, 48, 50]);
  check(
    "minesweeper: the first click and its neighbours are safe",
    planted.cells.every((cell, index) => !safe.has(index) || !cell.mine),
  );
  const opened = reveal(planted, 40);
  check(
    "minesweeper: opening a blank cell floods",
    opened.cells.filter((cell) => cell.revealed).length > 1,
    `${opened.cells.filter((cell) => cell.revealed).length} opened`,
  );
  const flagged = toggleFlag(planted, 0);
  check(
    "minesweeper: flags toggle",
    flagged.cells[0].flagged && !toggleFlag(flagged, 0).cells[0].flagged,
  );
  const solved = {
    ...planted,
    cells: planted.cells.map((cell) => ({ ...cell, revealed: !cell.mine })),
  };
  check("minesweeper: clearing every safe cell wins", isWon(solved));
}

// --------------------------------------------------------------- sudoku -----
{
  const { puzzle, solution } = makePuzzle("easy");
  check(
    "sudoku: the puzzle has holes",
    puzzle.filter((value) => value === 0).length >= 30,
    `${puzzle.filter((value) => value === 0).length} holes`,
  );
  check(
    "sudoku: exactly one solution",
    countSolutions(puzzle, 3) === 1,
    `${countSolutions(puzzle, 3)}`,
  );
  check(
    "sudoku: the solver reproduces the solution",
    solve(puzzle)?.join("") === solution.join(""),
  );
  check("sudoku: the solution is complete and clean", isComplete(solution));
  check(
    "sudoku: conflicts are detected",
    conflictsIn([1, 1, 0, 0, 0, 0, 0, 0, 0, ...new Array(72).fill(0)]).size === 2,
  );
  const hint = nextHint(puzzle);
  check("sudoku: a hint exists and is right", !!hint && solution[hint.index] === hint.value);
}

// -------------------------------------------------------------- breakout ----
{
  const state = createBreakout(1);
  check("breakout: the wall starts full", bricksLeft(state) === 40, `${bricksLeft(state)}`);
  let frames = 0;
  let broke = 0;
  for (let i = 0; i < 6000 && !state.over && !state.won; i += 1) {
    stepBreakout(state, {
      dt: 1 / 60,
      paddleX: state.ball.x,
      keys: new Set([" "]),
      launch: true,
      width: 400,
      height: 640,
    });
    frames += 1;
    broke = bricksLeft(state);
    if (!finite([state.ball.x, state.ball.y, state.ball.vx, state.ball.vy, state.paddleX])) break;
    if (Math.abs(state.ball.x) > 3 || Math.abs(state.ball.y) > 4) break;
  }
  check(
    "breakout: a perfect paddle clears bricks",
    broke < 40,
    `${40 - broke} broken in ${frames} frames`,
  );
  check(
    "breakout: no NaN and no escape",
    finite([state.ball.x, state.ball.y]) && Math.abs(state.ball.y) < 4,
  );
  check("breakout: lives are tracked", state.lives >= 0 && state.lives <= 3, `${state.lives}`);
}

// ---------------------------------------------------------- space shooter ---
{
  const state = createShooter();
  for (let i = 0; i < 3000; i += 1) {
    stepShooter(
      state,
      {
        dt: 1 / 60,
        shipX: Math.min(0.9, Math.max(0.1, state.enemies[0]?.x ?? 0.5)),
        keys: new Set(),
        firing: true,
      },
      Math.random,
    );
    if (state.over) break;
  }
  check(
    "space shooter: enemies spawn",
    state.score > 0 || state.enemies.length > 0,
    `score ${state.score}`,
  );
  check(
    "space shooter: score and best stay finite",
    finite([state.score, state.best, state.shipX]),
  );
  check(
    "space shooter: bullets are cleaned up",
    state.bullets.every((bullet) => bullet.y > -0.05),
  );
  check("space shooter: waves advance", state.wave >= 1, `wave ${state.wave}`);
}

// --------------------------------------------------------------- arena -----
{
  const world = createArena(6);
  const startPositions = world.bots.map((bot) => ({ x: bot.x, y: bot.y }));
  for (let step = 0; step < 4000; step += 1) {
    for (const bot of world.bots) {
      if (bot.alive) stepBot(world, bot, 1 / 60);
    }
  }
  const moved = world.bots.some(
    (bot, index) =>
      Math.abs(bot.x - startPositions[index].x) > 20 ||
      Math.abs(bot.y - startPositions[index].y) > 20,
  );
  check("arena: bots move around", moved);
  check(
    "arena: bots stay inside the arena",
    world.bots.every((bot) => bot.x >= 0 && bot.y >= 0 && bot.x <= 2600 && bot.y <= 2600),
  );
  check(
    "arena: no NaN positions or masses",
    world.bots.every((bot) => finite([bot.x, bot.y, bot.mass]) && bot.mass > 0),
  );
  check("arena: pellets stay stocked", world.pellets.length === 320, `${world.pellets.length}`);
}

// ----------------------------------------------------------------- snake ----
{
  const world = createSnake();
  const startLength = world.snakes[0].cells.length;
  let playerFood = 0;
  let deaths = 0;
  let maxLength = startLength;
  for (let tick = 0; tick < 4000; tick += 1) {
    const before = world.snakes[0].alive;
    const head = world.snakes[0].cells[0];
    const food = [...world.food].sort(
      (a, b) =>
        Math.abs(a.x - head.x) +
        Math.abs(a.y - head.y) -
        (Math.abs(b.x - head.x) + Math.abs(b.y - head.y)),
    )[0];
    if (food) {
      const dx = food.x - head.x;
      const dy = food.y - head.y;
      if (Math.abs(dx) > Math.abs(dy)) world.snakes[0].queued.push({ x: Math.sign(dx), y: 0 });
      else world.snakes[0].queued.push({ x: 0, y: Math.sign(dy) });
    }
    const scoreBefore = world.snakes[0].score;
    stepSnake(world);
    if (world.snakes[0].score > scoreBefore) playerFood += 1;
    if (before && !world.snakes[0].alive) deaths += 1;
    maxLength = Math.max(maxLength, world.snakes[0].cells.length);
  }
  check("snake: player ate food over 4000 ticks", playerFood > 0, `${playerFood} food`);
  check("snake: player grew", maxLength > startLength, `max length ${maxLength}`);
  check(
    "snake: rivals stay alive and respawn",
    world.snakes.slice(1).some((snake) => snake.alive),
  );
  check(
    "snake: tick speed stays in range",
    world.tickMs >= 68 && world.tickMs <= 118,
    `${world.tickMs}ms`,
  );
  // The driver above steers at food with no collision avoidance, so it dies a
  // lot on purpose: the point is that every death respawns a legal snake.
  check(
    "snake: deaths respawn a fresh body",
    deaths > 0 && world.snakes[0].cells.length >= 4,
    `${deaths} deaths`,
  );
}

// ----------------------------------------------------------------- rally ----
{
  const world: RallyWorld = createRally();
  serve(world, "top");
  let points = 0;
  for (let step = 0; step < 60000 && !world.winner; step += 1) {
    const before = world.score.bottom + world.score.top;
    stepRally(world, {
      dt: 1 / 60,
      courtW: 400,
      courtH: 640,
      pointer: { x: world.ball.x * 400, y: 600, down: true, inside: true },
      keys: new Set<string>(),
      mode: "solo",
    });
    if (world.score.bottom + world.score.top > before) points += 1;
    if (
      !finite([world.ball.x, world.ball.y, world.ball.vx, world.ball.vy, world.bottomX, world.topX])
    ) {
      check("rally: no NaN in ball/paddles", false);
      break;
    }
  }
  check("rally: points are scored", points > 0, `${points} points`);
  check(
    "rally: match ends at the target",
    world.winner === "bottom" || world.winner === "top",
    String(world.winner),
  );
  check(
    "rally: winner reached the target",
    world.score[world.winner ?? "bottom"] >= 7,
    `${world.score.bottom}-${world.score.top}`,
  );
  check("rally: best rally tracked", world.bestRally > 0, `${world.bestRally} hits`);
  const geometry = paddleGeometry(640);
  check(
    "rally: paddle geometry is sane",
    geometry.h >= 8 && geometry.y > 0,
    JSON.stringify(geometry),
  );

  const duo = createRally();
  serve(duo, "top");
  const topBefore = duo.topX;
  for (let step = 0; step < 30; step += 1) {
    stepRally(duo, {
      dt: 1 / 60,
      courtW: 400,
      courtH: 640,
      pointer: { x: 0, y: 0, down: false, inside: false },
      keys: new Set(["d"]),
      mode: "duo",
    });
  }
  check(
    "rally: duo mode moves the second paddle",
    duo.topX > topBefore,
    `${topBefore} → ${duo.topX}`,
  );

  const beatable = createRally();
  serve(beatable, "top");
  for (let step = 0; step < 90000 && !beatable.winner; step += 1) {
    stepRally(beatable, {
      dt: 1 / 60,
      courtW: 400,
      courtH: 640,
      pointer: { x: beatable.ball.x * 400, y: 600, down: true, inside: true },
      keys: new Set<string>(),
      mode: "solo",
    });
  }
  check(
    "rally: a perfect player can win against the CPU",
    beatable.winner === "bottom",
    `${beatable.score.bottom}-${beatable.score.top}`,
  );
}

console.log(
  fail.length === 0
    ? "\nALL CHECKS PASSED"
    : `\n${fail.length} CHECK(S) FAILED: ${fail.join(", ")}`,
);
process.exit(fail.length === 0 ? 0 : 1);
