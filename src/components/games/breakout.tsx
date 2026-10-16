import { useEffect, useRef } from "react";
import { ArcadeChip, useArcade, type ArcadeStats } from "@/components/games/use-arcade";
import {
  bricksLeft,
  BRICK_COLS,
  BRICK_ROWS,
  createBreakout,
  nextLevel,
  stepBreakout,
  type BreakoutState,
} from "@/lib/games/breakout";

/**
 * BREAKOUT — the rule that makes it feel right is the paddle's angle: hitting
 * with the edge throws the ball wide, the middle sends it back straight. All of
 * that lives in the engine; this file only draws it.
 */
export function BreakoutGame({ fullscreen = false }: { fullscreen?: boolean }) {
  const stateRef = useRef<BreakoutState | null>(null);
  const levelFlashRef = useRef(0);

  const { canvasRef, stats, pointerHandlers } = useArcade(
    (frame, next: ArcadeStats) => {
      let state = stateRef.current;
      if (!state) {
        state = createBreakout(1);
        stateRef.current = state;
      }
      const { ctx, width, height, dt, pointer, keys, pressed } = frame;

      if (state.won && frame.now - levelFlashRef.current > 900) {
        levelFlashRef.current = frame.now;
        stateRef.current = nextLevel(state);
        state = stateRef.current;
      }

      stepBreakout(state, {
        dt,
        paddleX: pointer.inside ? pointer.x / width : null,
        keys,
        launch: pressed.has(" ") || pressed.has("enter") || pointer.down,
        width,
        height,
      });

      // ---- render ---------------------------------------------------------
      ctx.fillStyle = "#08080a";
      ctx.fillRect(0, 0, width, height);

      const brickW = width / BRICK_COLS;
      const brickH = height * 0.035;
      const top = height * 0.09;
      for (let row = 0; row < BRICK_ROWS; row += 1) {
        for (let col = 0; col < BRICK_COLS; col += 1) {
          if (!state.bricks[row * BRICK_COLS + col]) continue;
          const shade = 0.35 + (row / BRICK_ROWS) * 0.5;
          ctx.fillStyle = `rgba(201,255,61,${shade.toFixed(2)})`;
          ctx.fillRect(col * brickW + 3, top + row * brickH + 3, brickW - 6, brickH - 6);
        }
      }

      const paddleW = width * 0.22;
      const paddleH = Math.max(8, height * 0.018);
      ctx.fillStyle = "#f4f1e7";
      ctx.beginPath();
      const px = state.paddleX * width - paddleW / 2;
      const py = height * 0.9;
      ctx.moveTo(px + paddleH, py);
      ctx.arcTo(px + paddleW, py, px + paddleW, py + paddleH, paddleH);
      ctx.arcTo(px + paddleW, py + paddleH, px, py + paddleH, paddleH);
      ctx.arcTo(px, py + paddleH, px, py, paddleH);
      ctx.arcTo(px, py, px + paddleW, py, paddleH);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#c9ff3d";
      ctx.beginPath();
      ctx.arc(
        state.ball.x * width,
        state.ball.y * height,
        Math.max(3, Math.min(width, height) * 0.018),
        0,
        Math.PI * 2,
      );
      ctx.fill();

      if (!state.launched && !state.over) {
        ctx.font = `700 ${Math.round(Math.min(width, height) * 0.04)}px "Instrument Sans", sans-serif`;
        ctx.textAlign = "center";
        ctx.fillStyle = "#f4f1e7";
        ctx.fillText("Tap or press space to launch", width / 2, height * 0.78);
      }

      if (state.won || state.over) {
        ctx.fillStyle = "rgba(8,8,10,0.72)";
        ctx.fillRect(0, 0, width, height);
        ctx.textAlign = "center";
        ctx.fillStyle = state.won ? "#c9ff3d" : "#ff5d5d";
        ctx.font = `800 ${Math.round(Math.min(width, height) * 0.075)}px "Bricolage Grotesque", sans-serif`;
        ctx.fillText(state.won ? "Level cleared" : "Game over", width / 2, height * 0.46);
        ctx.fillStyle = "#f4f1e7";
        ctx.font = `600 ${Math.round(Math.min(width, height) * 0.035)}px "Instrument Sans", sans-serif`;
        ctx.fillText(`Score ${state.score}`, width / 2, height * 0.54);
        ctx.fillText("New game to go again", width / 2, height * 0.6);
      }

      next.score = state.score;
      next.lives = state.lives;
      next.level = state.level;
      next.bricks = bricksLeft(state);
      next.hits = state.hits;
    },
    { keys: ["arrowleft", "arrowright", "a", "d", " ", "enter"] },
  );

  // Restarting swaps in a fresh level without remounting the canvas.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "r") return;
      const state = stateRef.current;
      if (!state) return;
      const fresh = createBreakout(1);
      fresh.score = 0;
      stateRef.current = fresh;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#08080a]">
      <canvas
        ref={canvasRef}
        {...pointerHandlers}
        className="h-full w-full touch-none select-none"
        style={{ touchAction: "none" }}
        aria-label="Breakout game area"
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-center gap-1.5 p-2">
        <ArcadeChip label="score" value={Number(stats.score ?? 0)} accent="#c9ff3d" />
        <ArcadeChip label="lives" value={Number(stats.lives ?? 3)} />
        <ArcadeChip label="level" value={Number(stats.level ?? 1)} />
        <ArcadeChip label="bricks" value={Number(stats.bricks ?? 0)} />
        {!fullscreen && (
          <span className="ml-auto rounded-lg border border-white/10 bg-black/45 px-2 py-1 text-[10px] font-semibold text-white/60 backdrop-blur">
            Drag to move · tap to launch
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => {
          const fresh = createBreakout(1);
          fresh.score = 0;
          stateRef.current = fresh;
        }}
        className="absolute bottom-2 right-2 rounded-full border border-white/15 bg-black/50 px-3 py-1.5 text-[11px] font-semibold text-white/70 backdrop-blur transition hover:text-white"
      >
        New game
      </button>
    </div>
  );
}

export default BreakoutGame;
