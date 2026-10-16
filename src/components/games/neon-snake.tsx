import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { ArcadeChip, useArcade, type ArcadeStats } from "@/components/games/use-arcade";

/**
 * NEON SNAKE — grid snake against three rival snakes.
 *
 * Fixed grid, fixed tick, one mutable world. The rivals are honest opponents:
 * every tick they score the three legal turns by how much of the board they can
 * still reach and how close they land to food, so they cut you off rather than
 * wandering. Positional ambiguity is real — hitting *any* body is lethal.
 */

const COLS = 26;
const ROWS = 26;
const FOOD_COUNT = 4;
const BOT_COUNT = 3;
const START_LENGTH = 4;
const BEST_KEY = "rizz:arcade:neon-snake:best";
const COLORS = ["#c9ff3d", "#5ad8ff", "#ffb347", "#ff6b9d"];

type Cell = { x: number; y: number };

export type Snake = {
  id: number;
  cells: Cell[];
  dir: Cell;
  queued: Cell[];
  alive: boolean;
  respawnAt: number;
  score: number;
  color: string;
  bot: boolean;
};

export type World = {
  snakes: Snake[];
  food: Cell[];
  tickMs: number;
  accumulator: number;
  best: number;
  round: number;
};

const randInt = (max: number) => Math.floor(Math.random() * max);
const key = (cell: Cell) => `${cell.x},${cell.y}`;
const sameDir = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;
const opposite = (a: Cell, b: Cell) => a.x === -b.x && a.y === -b.y;

function freeCell(world: World): Cell {
  const taken = new Set<string>();
  for (const snake of world.snakes) for (const cell of snake.cells) taken.add(key(cell));
  for (const cell of world.food) taken.add(key(cell));
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const cell = { x: randInt(COLS), y: randInt(ROWS) };
    if (!taken.has(key(cell))) return cell;
  }
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (!taken.has(`${x},${y}`)) return { x, y };
    }
  }
  return { x: 0, y: 0 };
}

function spawnSnake(id: number, bot: boolean): Snake {
  const horizontal = id % 2 === 0;
  const startX = 3 + ((id * 5) % (COLS - 8));
  const startY = 3 + ((id * 7) % (ROWS - 8));
  const dir = horizontal ? { x: 1, y: 0 } : { x: 0, y: 1 };
  const cells: Cell[] = [];
  for (let i = 0; i < START_LENGTH; i += 1) {
    cells.push({
      x: Math.min(COLS - 1, Math.max(0, startX - dir.x * i)),
      y: Math.min(ROWS - 1, Math.max(0, startY - dir.y * i)),
    });
  }
  return {
    id,
    cells,
    dir,
    queued: [],
    alive: true,
    respawnAt: 0,
    score: 0,
    color: COLORS[id % COLORS.length],
    bot,
  };
}

export function createWorld(): World {
  const snakes = Array.from({ length: BOT_COUNT + 1 }, (_, index) => spawnSnake(index, index > 0));
  const world: World = {
    snakes,
    food: [],
    tickMs: 118,
    accumulator: 0,
    best: readBest(),
    round: 0,
  };
  for (let i = 0; i < FOOD_COUNT; i += 1) world.food.push(freeCell(world));
  return world;
}

function readBest(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(BEST_KEY);
  const value = raw ? Number(raw) : 0;
  return Number.isFinite(value) ? value : 0;
}

function occupied(world: World): Set<string> {
  const taken = new Set<string>();
  for (const snake of world.snakes) {
    if (!snake.alive) continue;
    // A tail cell is vacated this tick, so it never counts as a wall.
    for (let i = 0; i < snake.cells.length - 1; i += 1) taken.add(key(snake.cells[i]));
  }
  return taken;
}

/** How much open space a bot can see from a cell — keeps it out of dead ends. */
function openness(world: World, taken: Set<string>, from: Cell): number {
  let open = 0;
  for (const step of [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ]) {
    const cell = { x: from.x + step.x, y: from.y + step.y };
    if (cell.x < 0 || cell.y < 0 || cell.x >= COLS || cell.y >= ROWS) continue;
    if (!taken.has(key(cell))) open += 1;
  }
  return open;
}

function chooseBotDirection(world: World, snake: Snake): Cell {
  const head = snake.cells[0];
  const taken = occupied(world);
  const options = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ].filter((dir) => !opposite(dir, snake.dir));

  let best: Cell | null = null;
  let bestScore = -Infinity;
  for (const dir of options) {
    const next = { x: head.x + dir.x, y: head.y + dir.y };
    if (next.x < 0 || next.y < 0 || next.x >= COLS || next.y >= ROWS) continue;
    if (taken.has(key(next))) continue;
    let score = openness(world, taken, next) * 2.5;
    let nearest = Infinity;
    for (const food of world.food)
      nearest = Math.min(nearest, Math.abs(food.x - next.x) + Math.abs(food.y - next.y));
    score -= nearest * 1.6;
    // A little noise so three bots do not stack up in one lane.
    if (sameDir(dir, snake.dir)) score += 1.2;
    score += Math.random() * 2;
    if (score > bestScore) {
      bestScore = score;
      best = dir;
    }
  }
  return best ?? snake.dir;
}

function die(world: World, snake: Snake) {
  snake.alive = false;
  snake.respawnAt = 2.4;
  snake.score = 0;
  if (!snake.bot) {
    const best = Math.max(world.best, world.snakes[0].cells.length - START_LENGTH);
    if (best > world.best) {
      world.best = best;
      try {
        window.localStorage.setItem(BEST_KEY, String(best));
      } catch {
        /* private mode */
      }
    }
  }
}

export function stepWorld(world: World) {
  const taken = occupied(world);

  for (const snake of world.snakes) {
    if (!snake.alive) continue;
    if (snake.bot) {
      snake.dir = chooseBotDirection(world, snake);
    } else if (snake.queued.length) {
      const next = snake.queued.shift()!;
      if (!opposite(next, snake.dir)) snake.dir = next;
    }
  }

  for (const snake of world.snakes) {
    if (!snake.alive) continue;
    const head = snake.cells[0];
    const next = { x: head.x + snake.dir.x, y: head.y + snake.dir.y };
    const outOfBounds = next.x < 0 || next.y < 0 || next.x >= COLS || next.y >= ROWS;
    const bitesBody =
      taken.has(key(next)) || snake.cells.slice(0, -1).some((cell) => sameDir(cell, next));
    if (outOfBounds || bitesBody) {
      die(world, snake);
      continue;
    }
    snake.cells.unshift(next);
    const foodIndex = world.food.findIndex((food) => sameDir(food, next));
    if (foodIndex >= 0) {
      world.food[foodIndex] = freeCell(world);
      snake.score += 1;
      world.tickMs = Math.max(68, world.tickMs - 1.4);
    } else {
      snake.cells.pop();
    }
  }

  // Respawns keep the arena populated for as long as someone is playing.
  for (const snake of world.snakes) {
    if (snake.alive) continue;
    snake.respawnAt -= world.tickMs / 1000;
    if (snake.respawnAt <= 0) {
      const fresh = spawnSnake(snake.id, snake.bot);
      fresh.score = snake.score;
      Object.assign(snake, fresh);
    }
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function NeonSnake({
  players = 1,
  fullscreen = false,
}: {
  players?: number;
  fullscreen?: boolean;
}) {
  const worldRef = useRef<World | null>(null);
  const [round, setRound] = useState(0);
  const [dead, setDead] = useState(false);

  useEffect(() => {
    worldRef.current = createWorld();
    worldRef.current.round = round;
    setDead(false);
  }, [round]);

  const { canvasRef, stats, pointerHandlers } = useArcade(
    (frame, next: ArcadeStats) => {
      let world = worldRef.current;
      if (!world) {
        world = createWorld();
        worldRef.current = world;
      }
      const { ctx, width, height, dt, keys, pressed } = frame;

      // Queue at most two turns; the next tick consumes one. This is what makes
      // a fast flick (up then left) land correctly instead of eating the input.
      const player = world.snakes[0];
      if (player.alive && player.queued.length < 2) {
        const wants = (name: string, dx: number, dy: number) =>
          (pressed.has(name) || keys.has(name)) &&
          !sameDir(player.queued[player.queued.length - 1] ?? player.dir, { x: dx, y: dy });
        if (wants("arrowup", 0, -1) || wants("w", 0, -1)) player.queued.push({ x: 0, y: -1 });
        else if (wants("arrowdown", 0, 1) || wants("s", 0, 1)) player.queued.push({ x: 0, y: 1 });
        else if (wants("arrowleft", -1, 0) || wants("a", -1, 0))
          player.queued.push({ x: -1, y: 0 });
        else if (wants("arrowright", 1, 0) || wants("d", 1, 0)) player.queued.push({ x: 1, y: 0 });
      }

      world.accumulator += dt * 1000;
      let guard = 0;
      while (world.accumulator >= world.tickMs && guard < 4) {
        world.accumulator -= world.tickMs;
        stepWorld(world);
        guard += 1;
        if (!world.snakes[0].alive) break;
      }

      if (!world.snakes[0].alive && !dead) setDead(true);
      if (world.snakes[0].alive && dead) setDead(false);

      // ---- render ----------------------------------------------------------
      const cell = Math.floor(Math.min(width / COLS, height / ROWS));
      const boardW = cell * COLS;
      const boardH = cell * ROWS;
      const offsetX = (width - boardW) / 2;
      const offsetY = (height - boardH) / 2;

      ctx.fillStyle = "#08080a";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#0d0d10";
      ctx.fillRect(offsetX, offsetY, boardW, boardH);
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      for (let x = 1; x < COLS; x += 1) {
        ctx.beginPath();
        ctx.moveTo(offsetX + x * cell, offsetY);
        ctx.lineTo(offsetX + x * cell, offsetY + boardH);
        ctx.stroke();
      }
      for (let y = 1; y < ROWS; y += 1) {
        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY + y * cell);
        ctx.lineTo(offsetX + boardW, offsetY + y * cell);
        ctx.stroke();
      }

      const pulse = 0.55 + 0.45 * Math.sin(frame.now / 260);
      for (const food of world.food) {
        ctx.globalAlpha = pulse;
        ctx.fillStyle = "#f4f1e7";
        roundRect(
          ctx,
          offsetX + food.x * cell + cell * 0.28,
          offsetY + food.y * cell + cell * 0.28,
          cell * 0.44,
          cell * 0.44,
          cell * 0.16,
        );
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      for (const snake of world.snakes) {
        if (!snake.alive) continue;
        const length = snake.cells.length;
        snake.cells.forEach((segment, index) => {
          const fade = 1 - index / (length + 4);
          ctx.globalAlpha = snake.bot ? 0.35 + fade * 0.5 : 0.5 + fade * 0.5;
          ctx.fillStyle = snake.color;
          roundRect(
            ctx,
            offsetX + segment.x * cell + cell * 0.08,
            offsetY + segment.y * cell + cell * 0.08,
            cell * 0.84,
            cell * 0.84,
            cell * 0.24,
          );
          ctx.fill();
        });
        // A bright head keeps "which one is me" obvious at speed.
        const head = snake.cells[0];
        ctx.globalAlpha = 1;
        ctx.fillStyle = snake.color;
        roundRect(
          ctx,
          offsetX + head.x * cell + cell * 0.04,
          offsetY + head.y * cell + cell * 0.04,
          cell * 0.92,
          cell * 0.92,
          cell * 0.3,
        );
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      const ranked = world.snakes
        .filter((snake) => snake.alive)
        .sort((a, b) => b.cells.length - a.cells.length);
      next.score = player.cells.length - START_LENGTH + player.score * 2;
      next.best = world.best;
      next.alive = world.snakes.filter((snake) => snake.alive).length;
      next.top = ranked[0]
        ? `${ranked[0].color === COLORS[0] ? "you" : "rival"} · ${ranked[0].cells.length}`
        : "—";
    },
    {
      onSwipe: (direction) => {
        const world = worldRef.current;
        const player = world?.snakes[0];
        if (!world || !player || !player.alive || player.queued.length >= 2) return;
        const map = {
          up: { x: 0, y: -1 },
          down: { x: 0, y: 1 },
          left: { x: -1, y: 0 },
          right: { x: 1, y: 0 },
        } as const;
        const dir = map[direction];
        if (!opposite(dir, player.dir)) player.queued.push(dir);
      },
    },
  );

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#08080a]">
      <canvas
        ref={canvasRef}
        {...pointerHandlers}
        className="h-full w-full touch-none select-none"
        style={{ touchAction: "none" }}
        aria-label="Neon Snake game area"
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-center gap-1.5 p-2">
        <ArcadeChip label="score" value={Number(stats.score ?? 0)} accent="#5ad8ff" />
        <ArcadeChip label="best" value={Number(stats.best ?? 0)} />
        <ArcadeChip label="alive" value={Number(stats.alive ?? 0)} />
        <ArcadeChip label="top" value={String(stats.top ?? "—")} />
        {!fullscreen && (
          <span className="ml-auto rounded-lg border border-white/10 bg-black/45 px-2 py-1 text-[10px] font-semibold text-white/60 backdrop-blur">
            Arrows / WASD · swipe to turn
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => setRound((value) => value + 1)}
        className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-full border border-white/15 bg-black/50 px-3 py-1.5 text-[11px] font-semibold text-white/70 backdrop-blur transition hover:text-white"
      >
        <RotateCcw className="h-3.5 w-3.5" /> New round
      </button>

      {dead && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="rounded-2xl border border-white/10 bg-black/70 px-5 py-4 text-center backdrop-blur">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">
              Wiped out
            </p>
            <p className="mt-1 font-display text-lg font-bold text-[#f4f1e7]">
              Respawn in a moment
            </p>
            <p className="mt-0.5 text-xs text-white/60">Rivals keep the board warm.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default NeonSnake;
