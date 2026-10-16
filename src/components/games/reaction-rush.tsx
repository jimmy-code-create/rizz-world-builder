import { useCallback, useEffect, useRef, useState } from "react";
import { Zap } from "lucide-react";
import { GameChip, GameShell, useBest } from "@/components/games/board-frame";

/**
 * REACTION RUSH — a 4x4 grid, one tile lights up at a time, 30 seconds on the
 * clock. It is the game that works when you are mostly talking: glance, tap,
 * back to the conversation.
 */
const CELLS = 16;
const ROUND_MS = 30_000;

export function ReactionRushGame() {
  const [active, setActive] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [remaining, setRemaining] = useState(ROUND_MS);
  const [running, setRunning] = useState(false);
  const [best, reportBest] = useBest("reaction-rush");
  const litAt = useRef(0);
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    for (const timer of timers.current) window.clearTimeout(timer);
    timers.current = [];
  }, []);

  const lightNext = useCallback(() => {
    setActive((current) => {
      let next = Math.floor(Math.random() * CELLS);
      if (next === current) next = (next + 1 + Math.floor(Math.random() * (CELLS - 1))) % CELLS;
      return next;
    });
    litAt.current = performance.now();
    // A tile that is ignored counts as a miss and moves on.
    timers.current.push(
      window.setTimeout(() => {
        setMisses((count) => count + 1);
        setStreak(0);
        lightNext();
      }, 1500),
    );
  }, []);

  const start = useCallback(() => {
    clearTimers();
    setScore(0);
    setMisses(0);
    setStreak(0);
    setBestStreak(0);
    setRemaining(ROUND_MS);
    setRunning(true);
    lightNext();
  }, [clearTimers, lightNext]);

  useEffect(() => {
    if (!running) return;
    const tick = window.setInterval(() => {
      setRemaining((value) => {
        if (value <= 200) {
          setRunning(false);
          clearTimers();
          setActive(null);
          return 0;
        }
        return value - 200;
      });
    }, 200);
    return () => window.clearInterval(tick);
  }, [running, clearTimers]);

  useEffect(() => {
    reportBest(score);
  }, [score, reportBest]);

  useEffect(() => clearTimers, [clearTimers]);

  const hit = (cell: number) => {
    if (!running) return;
    if (cell !== active) {
      setMisses((count) => count + 1);
      setStreak(0);
      return;
    }
    const reaction = performance.now() - litAt.current;
    // Faster reactions score more, capped so a lucky tap cannot run away with it.
    const points = Math.max(5, Math.round(60 - reaction / 22));
    setScore((value) => value + points + Math.min(20, streak));
    setStreak((value) => {
      const next = value + 1;
      setBestStreak((bestValue) => (next > bestValue ? next : bestValue));
      return next;
    });
    lightNext();
  };

  const accuracy =
    score + misses > 0 ? Math.round((1 - misses / (score / 20 + misses)) * 100) : 100;

  return (
    <GameShell
      status={
        running
          ? `Go! ${(remaining / 1000).toFixed(1)}s left`
          : score > 0
            ? `Finished with ${score} points.`
            : "30 seconds. Tap the lit tile as fast as you can."
      }
      chips={
        <>
          <GameChip label="score" value={score} accent="#c9ff3d" />
          <GameChip label="streak" value={streak} />
          <GameChip label="best" value={Math.max(best, bestStreak)} />
        </>
      }
      onRestart={start}
      restartLabel={running ? "Restart" : "Start"}
      footer={
        running
          ? `Misses ${misses} · accuracy ${Math.max(0, Math.min(100, accuracy))}%`
          : "Streaks multiply a hit's value — and ignoring a tile breaks the streak."
      }
    >
      <div className="flex w-full max-w-[min(100%,460px)] flex-col items-center gap-3">
        <div className="grid w-full grid-cols-4 gap-2">
          {Array.from({ length: CELLS }).map((_, cell) => (
            <button
              key={cell}
              type="button"
              onClick={() => hit(cell)}
              aria-label={`tile ${cell + 1}`}
              className={`grid aspect-square place-items-center rounded-2xl border transition duration-75 ${
                active === cell
                  ? "border-primary bg-primary text-[#0a0a0b] shadow-[0_0_24px_rgba(201,255,61,0.5)]"
                  : "border-white/10 bg-white/[0.04] text-transparent hover:border-white/25"
              }`}
            >
              <Zap className="h-6 w-6" />
            </button>
          ))}
        </div>
        {!running && (
          <button
            type="button"
            onClick={start}
            className="h-11 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground transition hover:brightness-105"
          >
            {score > 0 ? "Play again" : "Start round"}
          </button>
        )}
      </div>
    </GameShell>
  );
}

export default ReactionRushGame;
