import { useEffect, useRef } from "react";
import { ArcadeChip, useArcade, type ArcadeStats } from "@/components/games/use-arcade";
import { createShooter, SHIP_HALF, stepShooter, type ShooterState } from "@/lib/games/shooter";

/**
 * NEON VOID — a vertical space shooter with auto-fire, waves and a score that
 * keeps climbing. Drag anywhere to fly, hold to shoot; the simulation is in
 * `@/lib/games/shooter`, this is the camera on it.
 */
export function SpaceShooterGame({ fullscreen = false }: { fullscreen?: boolean }) {
  const stateRef = useRef<ShooterState | null>(null);

  const { canvasRef, stats, pointerHandlers } = useArcade(
    (frame, next: ArcadeStats) => {
      let state = stateRef.current;
      if (!state) {
        state = createShooter();
        stateRef.current = state;
      }
      const { ctx, width, height, dt, pointer, keys } = frame;

      stepShooter(state, {
        dt,
        shipX: pointer.inside ? pointer.x / width : null,
        keys,
        firing: pointer.down || keys.has(" ") || keys.has("enter"),
      });

      // ---- render ---------------------------------------------------------
      ctx.fillStyle = "#05050a";
      ctx.fillRect(0, 0, width, height);

      // Starfield: deterministic positions, so it never flickers.
      for (let i = 0; i < 60; i += 1) {
        const x = ((i * 97) % 100) / 100;
        const y = ((i * 53 + frame.now / 22) % 100) / 100;
        ctx.fillStyle = `rgba(244,241,231,${0.08 + (i % 3) * 0.05})`;
        ctx.fillRect(x * width, y * height, 2, 2);
      }

      const unit = Math.min(width, height);
      const shipX = state.shipX * width;
      const shipY = height * 0.9;
      ctx.fillStyle = "#c9ff3d";
      ctx.beginPath();
      ctx.moveTo(shipX, shipY - unit * 0.045);
      ctx.lineTo(shipX + unit * 0.035, shipY + unit * 0.03);
      ctx.lineTo(shipX, shipY + unit * 0.012);
      ctx.lineTo(shipX - unit * 0.035, shipY + unit * 0.03);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#5ad8ff";
      for (const bullet of state.bullets) {
        ctx.fillRect(bullet.x * width - 1.5, bullet.y * height - unit * 0.018, 3, unit * 0.018);
      }

      for (const enemy of state.enemies) {
        const ex = enemy.x * width;
        const ey = enemy.y * height;
        ctx.fillStyle = enemy.hp > 1 ? "#ff6b9d" : "#ffb347";
        ctx.beginPath();
        ctx.arc(ex, ey, unit * 0.026, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(10,10,11,0.6)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      if (state.over) {
        ctx.fillStyle = "rgba(5,5,10,0.75)";
        ctx.fillRect(0, 0, width, height);
        ctx.textAlign = "center";
        ctx.fillStyle = "#ff5d5d";
        ctx.font = `800 ${Math.round(unit * 0.075)}px "Bricolage Grotesque", sans-serif`;
        ctx.fillText("Ship down", width / 2, height * 0.45);
        ctx.fillStyle = "#f4f1e7";
        ctx.font = `600 ${Math.round(unit * 0.035)}px "Instrument Sans", sans-serif`;
        ctx.fillText(`Score ${state.score} · Best ${state.best}`, width / 2, height * 0.53);
        ctx.fillText("New game to launch again", width / 2, height * 0.59);
      }

      next.score = state.score;
      next.best = state.best;
      next.lives = state.lives;
      next.wave = state.wave;
      next.enemies = state.enemies.length;
    },
    { keys: ["arrowleft", "arrowright", "a", "d", " ", "enter"] },
  );

  useEffect(() => {
    void SHIP_HALF;
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#05050a]">
      <canvas
        ref={canvasRef}
        {...pointerHandlers}
        className="h-full w-full touch-none select-none"
        style={{ touchAction: "none" }}
        aria-label="Space shooter game area"
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-center gap-1.5 p-2">
        <ArcadeChip label="score" value={Number(stats.score ?? 0)} accent="#c9ff3d" />
        <ArcadeChip label="best" value={Number(stats.best ?? 0)} />
        <ArcadeChip label="lives" value={Number(stats.lives ?? 3)} />
        <ArcadeChip label="wave" value={Number(stats.wave ?? 1)} />
        {!fullscreen && (
          <span className="ml-auto rounded-lg border border-white/10 bg-black/45 px-2 py-1 text-[10px] font-semibold text-white/60 backdrop-blur">
            Drag to fly · hold to fire
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => {
          stateRef.current = createShooter();
        }}
        className="absolute bottom-2 right-2 rounded-full border border-white/15 bg-black/50 px-3 py-1.5 text-[11px] font-semibold text-white/70 backdrop-blur transition hover:text-white"
      >
        New game
      </button>
    </div>
  );
}

export default SpaceShooterGame;
