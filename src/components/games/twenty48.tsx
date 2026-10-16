import { useCallback, useEffect, useRef, useState } from "react";
import { GameChip, GameShell, useBest } from "@/components/games/board-frame";
import {
  bestTile,
  canMove,
  score as scoreOf,
  SIZE,
  slide,
  spawn,
  startGrid,
  type Direction,
  type Grid,
} from "@/lib/games/g2048";

/**
 * 2048 — arrow keys or WASD, or swipe anywhere on the board on a phone.
 *
 * Tiles are absolutely positioned so the board animates as a grid rather than a
 * list of numbers; the rules (including the "no double merge" one) live in
 * `@/lib/games/g2048`.
 */
const TILE_STYLES: Record<number, string> = {
  2: "bg-[#2a2a2e] text-white",
  4: "bg-[#3a3a3f] text-white",
  8: "bg-[#c9ff3d] text-[#0a0a0b]",
  16: "bg-[#b6f36b] text-[#0a0a0b]",
  32: "bg-[#ffb347] text-[#0a0a0b]",
  64: "bg-[#ff9f1c] text-[#0a0a0b]",
  128: "bg-[#ff8fab] text-[#0a0a0b]",
  256: "bg-[#ff6b9d] text-[#0a0a0b]",
  512: "bg-[#5ad8ff] text-[#0a0a0b]",
  1024: "bg-[#7dd3fc] text-[#0a0a0b]",
  2048: "bg-white text-[#0a0a0b]",
};

export function Twenty48Game() {
  const [grid, setGrid] = useState<Grid>(() => startGrid());
  const [score, setScore] = useState(0);
  const [best, reportBest] = useBest("2048");
  const [over, setOver] = useState(false);
  const [moves, setMoves] = useState(0);
  const gridRef = useRef(grid);
  gridRef.current = grid;

  const move = useCallback((direction: Direction) => {
    setGrid((current) => {
      const result = slide(current, direction);
      if (!result.moved) return current;
      const next = spawn(result.grid);
      setScore((value) => value + result.gained);
      setMoves((value) => value + 1);
      if (!canMove(next)) setOver(true);
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const map: Record<string, Direction> = {
        arrowup: "up",
        arrowdown: "down",
        arrowleft: "left",
        arrowright: "right",
        w: "up",
        s: "down",
        a: "left",
        d: "right",
      };
      const direction = map[event.key.toLowerCase()];
      if (!direction) return;
      event.preventDefault();
      move(direction);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move]);

  const swipe = useRef<{ x: number; y: number } | null>(null);
  const restart = () => {
    setGrid(startGrid());
    setScore(0);
    setMoves(0);
    setOver(false);
  };

  useEffect(() => {
    reportBest(bestTile(grid));
  }, [grid, reportBest]);

  return (
    <GameShell
      status={over ? "No moves left — board locked." : "Swipe or use the arrow keys."}
      chips={
        <>
          <GameChip label="score" value={score} accent="#c9ff3d" />
          <GameChip label="best tile" value={best} />
          <GameChip label="moves" value={moves} />
        </>
      }
      onRestart={restart}
      restartLabel={over ? "Try again" : "New game"}
      footer="Tiles merge once per slide — line up four of a kind to reach 2048."
    >
      <div
        className="relative w-full max-w-[min(100%,520px)] touch-none select-none"
        style={{ touchAction: "none" }}
        onPointerDown={(event) => {
          swipe.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerUp={(event) => {
          const start = swipe.current;
          swipe.current = null;
          if (!start) return;
          const dx = event.clientX - start.x;
          const dy = event.clientY - start.y;
          if (Math.hypot(dx, dy) < 24) return;
          if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? "right" : "left");
          else move(dy > 0 ? "down" : "up");
        }}
      >
        <div className="grid aspect-square w-full grid-cols-4 gap-1.5 rounded-2xl border border-white/10 bg-[#141416] p-2">
          {grid.map((value, index) => (
            <div key={index} className="grid place-items-center rounded-xl bg-black/35">
              <span
                className={`grid h-full w-full place-items-center rounded-xl font-display text-[clamp(16px,5.4vw,38px)] font-bold ${
                  value ? (TILE_STYLES[Math.min(value, 2048)] ?? "bg-white text-[#0a0a0b]") : ""
                }`}
              >
                {value || ""}
              </span>
            </div>
          ))}
        </div>
        {over && (
          <div className="absolute inset-0 grid place-items-center rounded-2xl bg-black/70 p-4 backdrop-blur">
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">
                Score {score}
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-white">Board locked</p>
              <p className="mt-0.5 text-xs text-white/60">Biggest tile: {bestTile(grid)}</p>
              <button
                type="button"
                onClick={restart}
                className="mt-3 h-11 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground"
              >
                New game
              </button>
            </div>
          </div>
        )}
      </div>
      <span className="sr-only">{`Largest tile ${bestTile(grid)}, total ${scoreOf(grid)}`}</span>
    </GameShell>
  );
}

export default Twenty48Game;
