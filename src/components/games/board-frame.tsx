import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Clock, RotateCcw } from "lucide-react";

/**
 * The shared chrome for the DOM-based games (chess, checkers, solitaire-style
 * grids …). Every board needs the same three things — a status line, a score or
 * progress chip, and a way to start over — and giving them one implementation
 * is what keeps twelve games from looking like twelve products.
 */
export function GameShell({
  status,
  chips,
  onRestart,
  restartLabel = "New game",
  children,
  footer,
  scroll = true,
}: {
  status: ReactNode;
  chips?: ReactNode;
  onRestart: () => void;
  restartLabel?: string;
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
}) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#08080a] text-white">
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-white/[0.06] bg-black/50 px-2 py-2">
        <p className="min-w-0 flex-1 truncate text-xs font-semibold text-white/80">{status}</p>
        {chips}
        <button
          type="button"
          onClick={onRestart}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-3 text-[11px] font-bold text-white/75 transition hover:text-white"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {restartLabel}
        </button>
      </div>

      <div
        className={`flex min-h-0 flex-1 justify-center p-2 sm:p-3 ${scroll ? "overflow-y-auto" : "overflow-hidden"}`}
      >
        {children}
      </div>

      {footer && (
        <div className="shrink-0 border-t border-white/[0.06] px-2 py-1.5 text-center text-[10px] text-white/45">
          {footer}
        </div>
      )}
    </div>
  );
}

/** Small status chip (score, moves, timer, captured pieces). */
export function GameChip({
  label,
  value,
  accent,
}: {
  label: string;
  value: ReactNode;
  accent?: string;
}) {
  return (
    <span className="flex items-baseline gap-1.5 rounded-lg border border-white/10 bg-black/40 px-2 py-1">
      <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/45">
        {label}
      </span>
      <span
        className="font-mono text-xs font-bold tabular-nums"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </span>
    </span>
  );
}

/** Elapsed-time chip, so timed games do not each re-implement an interval. */
export function GameTimer({ running, resetKey }: { running: boolean; resetKey: number }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    setSeconds(0);
  }, [resetKey]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  const minutes = Math.floor(seconds / 60);
  return (
    <GameChip
      label="time"
      value={
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {`${minutes}:${String(seconds % 60).padStart(2, "0")}`}
        </span>
      }
    />
  );
}

/** Persisted personal best for the games that have one. */
export function useBest(key: string) {
  const storageKey = `rizz:arcade:${key}:best`;
  const [best, setBest] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(storageKey);
    const value = raw ? Number(raw) : 0;
    if (Number.isFinite(value) && value > 0) setBest(value);
  }, [storageKey]);

  const report = useCallback(
    (value: number) => {
      setBest((current) => {
        if (value <= current) return current;
        try {
          window.localStorage.setItem(storageKey, String(value));
        } catch {
          /* private mode */
        }
        return value;
      });
    },
    [storageKey],
  );

  return [best, report] as const;
}
