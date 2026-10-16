import { useEffect, useRef, useState } from "react";
import { RotateCcw, Users } from "lucide-react";
import { ArcadeChip, useArcade, type ArcadeStats } from "@/components/games/use-arcade";

/**
 * PIXEL RALLY — top-versus-bottom paddle duel.
 *
 * Solo is a CPU opponent that gets sharper as the rally grows; duo turns the
 * same board into a pass-the-phone party game (bottom player drags, top player
 * uses W and S). Everything is in normalised 0-1 court space so the same physics
 * survives a phone in portrait, a fullscreen monitor and a floating PiP card.
 *
 * The simulation is a plain function of (world, input) — no canvas, no React —
 * so the rules can be reasoned about (and driven) on their own.
 */

export const TARGET = 7;
const PADDLE_HALF = 0.085;
const BALL_RADIUS = 0.016;
const SERVE_DELAY = 1.1;
const MAX_SPEED = 1.75;
const PADDLE_INSET = 0.055;
const PADDLE_THICKNESS = 0.022;
const BEST_KEY = "rizz:arcade:pixel-rally:best";

export type Mode = "solo" | "duo";

export type RallyWorld = {
  ball: { x: number; y: number; vx: number; vy: number };
  bottomX: number;
  topX: number;
  score: { bottom: number; top: number };
  serveIn: number;
  rally: number;
  bestRally: number;
  winner: "bottom" | "top" | null;
  cpuTarget: number;
  /** Reaction timer: the CPU may only re-aim this often. */
  cpuThink: number;
  trail: { x: number; y: number }[];
};

export type RallyInput = {
  dt: number;
  /** Court size in CSS pixels — collisions are checked in normalised space. */
  courtW: number;
  courtH: number;
  pointer: { x: number; y: number; down: boolean; inside: boolean };
  keys: Set<string>;
  mode: Mode;
  /** Where the pointer is, in court pixels (the frame's origin offsets applied). */
  pointerCourtX?: number;
};

function readBest(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(BEST_KEY);
  const value = raw ? Number(raw) : 0;
  return Number.isFinite(value) ? value : 0;
}

export function createWorld(): RallyWorld {
  return {
    ball: { x: 0.5, y: 0.5, vx: 0.42, vy: 0.62 },
    bottomX: 0.5,
    topX: 0.5,
    score: { bottom: 0, top: 0 },
    serveIn: SERVE_DELAY,
    rally: 0,
    bestRally: readBest(),
    winner: null,
    cpuTarget: 0.5,
    cpuThink: 0,
    trail: [],
  };
}

/** Kick the ball off towards one player. The serve is not a free point. */
export function serve(world: RallyWorld, towards: "bottom" | "top") {
  world.ball.x = 0.5;
  world.ball.y = towards === "bottom" ? 0.32 : 0.68;
  const angle = (Math.random() - 0.5) * 0.7;
  const speed = 0.62 + Math.min(0.5, world.rally * 0.012);
  world.ball.vx = Math.sin(angle) * speed;
  world.ball.vy = (towards === "bottom" ? -1 : 1) * Math.cos(angle) * speed;
  world.serveIn = SERVE_DELAY;
  world.rally = 0;
  world.trail = [];
}

function resetPoint(world: RallyWorld, scorer: "bottom" | "top") {
  world.score[scorer] += 1;
  if (world.score[scorer] >= TARGET) {
    world.winner = scorer;
    return;
  }
  // The player who was scored on serves.
  serve(world, scorer === "bottom" ? "top" : "bottom");
}

export function paddleGeometry(courtH: number) {
  return { y: courtH * PADDLE_INSET, h: Math.max(8, courtH * PADDLE_THICKNESS) };
}

/** One simulation step: input, paddle AI, ball, scoring. Returns nothing — it mutates. */
export function stepWorld(world: RallyWorld, input: RallyInput) {
  const { dt, courtW, courtH, pointer, keys, mode } = input;
  if (world.winner) return;

  const geometry = paddleGeometry(courtH);
  const radiusX = BALL_RADIUS;
  const radiusY = (BALL_RADIUS * courtW) / courtH;
  const bottomFace = 1 - (geometry.y + geometry.h) / courtH;
  const topFace = (geometry.y + geometry.h) / courtH;

  // ---- input ---------------------------------------------------------------
  if (pointer.inside) {
    const courtX = input.pointerCourtX ?? pointer.x;
    world.bottomX = courtX / courtW;
  }
  if (keys.has("arrowleft")) world.bottomX -= dt * 1.4;
  if (keys.has("arrowright")) world.bottomX += dt * 1.4;
  world.bottomX = Math.min(1 - PADDLE_HALF, Math.max(PADDLE_HALF, world.bottomX));

  if (mode === "duo") {
    if (keys.has("a")) world.topX -= dt * 1.4;
    if (keys.has("d")) world.topX += dt * 1.4;
  } else {
    // CPU: sharpens as the rally grows, but it has two honest limits — a paddle
    // speed slower than the ball can travel sideways, and a reaction delay. The
    // first version re-aimed every single frame with a 0.06 error against a
    // 0.10 hit window, so it literally could not miss and a match never ended.
    const skill = 0.45 + Math.min(0.9, world.rally * 0.03);
    world.cpuThink -= dt;
    if (world.ball.vy < 0 && world.cpuThink <= 0) {
      world.cpuThink = 0.1 + Math.random() * 0.14;
      world.cpuTarget = world.ball.x + ((Math.random() - 0.5) * 0.36) / skill;
    }
    const drift = world.cpuTarget - world.topX;
    const maxSpeed = 0.5 + skill * 0.5;
    world.topX += Math.max(-maxSpeed, Math.min(maxSpeed, drift * 7)) * dt;
  }
  world.topX = Math.min(1 - PADDLE_HALF, Math.max(PADDLE_HALF, world.topX));

  // ---- ball ---------------------------------------------------------------
  if (world.serveIn > 0) {
    world.serveIn -= dt;
    return;
  }

  const ball = world.ball;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  if (ball.x < radiusX) {
    ball.x = radiusX;
    ball.vx = Math.abs(ball.vx);
  } else if (ball.x > 1 - radiusX) {
    ball.x = 1 - radiusX;
    ball.vx = -Math.abs(ball.vx);
  }

  const hitPaddle = (centerX: number, offsetScale: number) => {
    const offset = ball.x - centerX;
    if (Math.abs(offset) > PADDLE_HALF + radiusX) return false;
    // Where the paddle is hit decides the outgoing angle: edges throw the ball
    // wide, the middle sends it straight back.
    ball.vx += (offset / PADDLE_HALF) * 0.3 * offsetScale;
    world.rally += 1;
    return true;
  };

  if (ball.vy > 0 && ball.y + radiusY >= bottomFace) {
    if (hitPaddle(world.bottomX, 1)) ball.vy = -Math.abs(ball.vy) * 1.045;
  } else if (ball.vy < 0 && ball.y - radiusY <= topFace) {
    if (hitPaddle(world.topX, -1)) ball.vy = Math.abs(ball.vy) * 1.045;
  }

  // Cap total speed (and each axis) so a long rally stays playable.
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed > MAX_SPEED) {
    ball.vx = (ball.vx / speed) * MAX_SPEED;
    ball.vy = (ball.vy / speed) * MAX_SPEED;
  }
  ball.vx = Math.max(-1.2, Math.min(1.2, ball.vx));

  if (world.rally > world.bestRally) {
    world.bestRally = world.rally;
    try {
      window.localStorage.setItem(BEST_KEY, String(world.rally));
    } catch {
      /* private mode */
    }
  }

  if (ball.y < -radiusY) resetPoint(world, "bottom");
  else if (ball.y > 1 + radiusY) resetPoint(world, "top");

  world.trail.unshift({ x: ball.x, y: ball.y });
  if (world.trail.length > 12) world.trail.pop();
}

export function PixelRally({
  players = 1,
  fullscreen = false,
}: {
  players?: number;
  fullscreen?: boolean;
}) {
  const [mode, setMode] = useState<Mode>("solo");
  const modeRef = useRef<Mode>("solo");
  modeRef.current = mode;
  const worldRef = useRef<RallyWorld | null>(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    const world = createWorld();
    serve(world, "top");
    worldRef.current = world;
  }, [round, mode]);

  const { canvasRef, stats, pointerHandlers } = useArcade(
    (frame, next: ArcadeStats) => {
      let world = worldRef.current;
      if (!world) {
        world = createWorld();
        worldRef.current = world;
      }
      const { ctx, width, height, dt, pointer, keys } = frame;
      const scale = Math.min(width, height / 1.6);
      const courtW = Math.min(width, scale * 0.98);
      const courtH = Math.min(height, courtW * 1.6);
      const originX = (width - courtW) / 2;
      const originY = (height - courtH) / 2;
      const geometry = paddleGeometry(courtH);
      const paddleW = PADDLE_HALF * 2 * courtW;

      stepWorld(world, {
        dt,
        courtW,
        courtH,
        pointer,
        keys,
        mode: modeRef.current,
        pointerCourtX: pointer.x - originX,
      });

      // ---- render ---------------------------------------------------------
      ctx.fillStyle = "#08080a";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#0d0d10";
      ctx.fillRect(originX, originY, courtW, courtH);
      ctx.strokeStyle = "rgba(201,255,61,0.22)";
      ctx.lineWidth = 2;
      ctx.strokeRect(originX, originY, courtW, courtH);

      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.setLineDash([courtH * 0.02, courtH * 0.026]);
      ctx.beginPath();
      ctx.moveTo(originX + courtW / 2, originY);
      ctx.lineTo(originX + courtW / 2, originY + courtH);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = `800 ${Math.round(courtW * 0.18)}px "Bricolage Grotesque", sans-serif`;
      ctx.textAlign = "center";
      ctx.globalAlpha = 0.09;
      ctx.fillStyle = "#f4f1e7";
      ctx.fillText(String(world.score.bottom), originX + courtW / 2, originY + courtH * 0.72);
      ctx.fillText(String(world.score.top), originX + courtW / 2, originY + courtH * 0.36);
      ctx.globalAlpha = 1;

      const drawPaddle = (centerX: number, y: number, color: string) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        const x = originX + centerX * courtW - paddleW / 2;
        const radius = geometry.h / 2;
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + paddleW, y, x + paddleW, y + geometry.h, radius);
        ctx.arcTo(x + paddleW, y + geometry.h, x, y + geometry.h, radius);
        ctx.arcTo(x, y + geometry.h, x, y, radius);
        ctx.arcTo(x, y, x + paddleW, y, radius);
        ctx.closePath();
        ctx.fill();
      };
      drawPaddle(world.bottomX, originY + courtH - geometry.y - geometry.h, "#c9ff3d");
      drawPaddle(
        world.topX,
        originY + geometry.y,
        modeRef.current === "duo" ? "#ff6b9d" : "#ffb347",
      );

      world.trail.forEach((point, index) => {
        ctx.globalAlpha = 0.22 * (1 - index / world.trail.length);
        ctx.fillStyle = "#f4f1e7";
        ctx.beginPath();
        ctx.arc(
          originX + point.x * courtW,
          originY + point.y * courtH,
          Math.max(0.1, BALL_RADIUS * courtW * (1 - index / 16)),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#f4f1e7";
      ctx.beginPath();
      ctx.arc(
        originX + world.ball.x * courtW,
        originY + world.ball.y * courtH,
        Math.max(0.1, BALL_RADIUS * courtW),
        0,
        Math.PI * 2,
      );
      ctx.fill();

      if (world.serveIn > 0 && !world.winner) {
        ctx.globalAlpha = 0.75;
        ctx.font = `700 ${Math.round(courtW * 0.06)}px "Instrument Sans", sans-serif`;
        ctx.fillStyle = "#c9ff3d";
        ctx.fillText(
          `Serve in ${Math.max(1, Math.ceil(world.serveIn))}`,
          originX + courtW / 2,
          originY + courtH / 2,
        );
        ctx.globalAlpha = 1;
      }

      // ---- HUD bridge ------------------------------------------------------
      next.you = world.score.bottom;
      next.rival = world.score.top;
      next.rally = world.rally;
      next.best = world.bestRally;
      next.over = world.winner
        ? world.winner === "bottom"
          ? "You win"
          : modeRef.current === "duo"
            ? "P2 wins"
            : "CPU wins"
        : "";
    },
    // Arrows drive the bottom paddle; A/D drive the top one in duo mode.
    { keys: ["arrowleft", "arrowright", "a", "d", "w", "s", " "] },
  );

  const rivalLabel = mode === "duo" ? "p2" : "cpu";

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#08080a]">
      <canvas
        ref={canvasRef}
        {...pointerHandlers}
        className="h-full w-full touch-none select-none"
        style={{ touchAction: "none" }}
        aria-label="Pixel Rally game area"
      />

      <div className="absolute inset-x-0 top-0 flex flex-wrap items-center gap-1.5 p-2">
        <ArcadeChip label="you" value={Number(stats.you ?? 0)} accent="#c9ff3d" />
        <ArcadeChip
          label={rivalLabel}
          value={Number(stats.rival ?? 0)}
          accent={mode === "duo" ? "#ff6b9d" : "#ffb347"}
        />
        <ArcadeChip label="rally" value={Number(stats.rally ?? 0)} />
        <ArcadeChip label="best" value={Number(stats.best ?? 0)} />
        <button
          type="button"
          onClick={() => setMode((current) => (current === "solo" ? "duo" : "solo"))}
          className="pointer-events-auto ml-auto flex items-center gap-1.5 rounded-full border border-white/15 bg-black/50 px-3 py-1.5 text-[11px] font-semibold text-white/70 backdrop-blur transition hover:text-white"
        >
          <Users className="h-3.5 w-3.5" />
          {mode === "solo" ? "Play vs CPU" : "2 players, one screen"}
        </button>
      </div>

      <button
        type="button"
        onClick={() => setRound((value) => value + 1)}
        className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-full border border-white/15 bg-black/50 px-3 py-1.5 text-[11px] font-semibold text-white/70 backdrop-blur transition hover:text-white"
      >
        <RotateCcw className="h-3.5 w-3.5" /> {stats.over ? "Rematch" : "Restart"}
      </button>

      {!fullscreen && (
        <p className="pointer-events-none absolute bottom-2 left-2 rounded-lg border border-white/10 bg-black/45 px-2 py-1 text-[10px] font-semibold text-white/55 backdrop-blur">
          {mode === "duo" ? "Bottom: drag or arrows · Top: A / D" : "Drag or arrows to move"}
        </p>
      )}

      {stats.over ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="rounded-2xl border border-[#c9ff3d]/40 bg-black/75 px-6 py-5 text-center backdrop-blur">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">
              First to {TARGET}
            </p>
            <p className="mt-1 font-display text-2xl font-bold text-[#f4f1e7]">
              {String(stats.over)}
            </p>
            <p className="mt-0.5 text-xs text-white/60">Tap rematch to run it back.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default PixelRally;
