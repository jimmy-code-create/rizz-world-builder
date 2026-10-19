import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, RefreshCw } from "lucide-react";
import { GameChip, GameShell } from "@/components/games/board-frame";
import { useArcadeWin } from "@/lib/games/arcade-record";
import {
  applyMove,
  bestSquare,
  counts,
  flipsFor,
  initialState,
  legalMoves,
  other,
  type Disc,
  type ReversiBoard,
} from "@/lib/games/reversi";

/** REVERSI (OTHELLO) — you play black (first move), the AI searches 3 plies. */
export function ReversiGame({ players = 1 }: { players?: number }) {
  const [board, setBoard] = useState<ReversiBoard>(() => initialState());
  const [turn, setTurn] = useState<Disc>("b");
  const [thinking, setThinking] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState(players > 1 ? 4 : 3);

  const mine = turn === "b";
  const myMoves = useMemo(() => (mine ? legalMoves(board, "b") : []), [board, mine]);
  const totals = useMemo(() => counts(board), [board]);
  const over = myMoves.length === 0 && !mine && legalMoves(board, "w").length === 0;
  useArcadeWin("reversi", over && totals.b > totals.w);
  const passed = mine && myMoves.length === 0 && legalMoves(board, "w").length > 0;

  const hover = useMemo(
    () =>
      mine
        ? new Map(myMoves.map((move) => [move.square, flipsFor(board, move.square, "b")]))
        : new Map<number, number[]>(),
    [board, mine, myMoves],
  );

  const place = useCallback((square: number, disc: Disc) => {
    setBoard((current) => applyMove(current, square, disc) ?? current);
    setTurn(other(disc));
    setLog((entries) => [...entries, `${disc === "b" ? "You" : "AI"} ${square}`]);
  }, []);

  // The AI moves on its turn, passes when it must, and never stalls the game.
  useEffect(() => {
    if (over || mine) return;
    const moves = legalMoves(board, "w");
    if (moves.length === 0) {
      const timer = window.setTimeout(() => setTurn("b"), 500);
      return () => window.clearTimeout(timer);
    }
    setThinking(true);
    const timer = window.setTimeout(() => {
      const square = bestSquare(board, "w", difficulty);
      if (square !== null) place(square, "w");
      setThinking(false);
    }, 420);
    return () => window.clearTimeout(timer);
  }, [board, mine, over, difficulty, place]);

  const winnerText = over
    ? totals.b === totals.w
      ? "A draw."
      : totals.b > totals.w
        ? "You win!"
        : "The AI takes it."
    : passed
      ? "No legal move — you have to pass."
      : thinking
        ? "AI is thinking…"
        : "Your move — the dots are legal.";

  return (
    <GameShell
      status={winnerText}
      chips={
        <>
          <GameChip label="you" value={totals.b} accent="#c9ff3d" />
          <GameChip label="ai" value={totals.w} accent="#ffb347" />
          <GameChip label="empty" value={64 - totals.b - totals.w} />
        </>
      }
      onRestart={() => {
        setBoard(initialState());
        setTurn("b");
        setLog([]);
      }}
      footer={
        over
          ? "Corners are everything: they can never be flipped."
          : "Tap a highlighted square to flip discs in every direction you sandwich."
      }
    >
      <div className="flex w-full max-w-[min(100%,560px)] flex-col items-center gap-2">
        <div className="grid w-full grid-cols-8 overflow-hidden rounded-xl border border-white/10 bg-[#0f5a3a] shadow-lg">
          {board.map((disc, square) => {
            const flips = hover.get(square);
            return (
              <button
                key={square}
                type="button"
                disabled={!mine || over}
                onClick={() => place(square, "b")}
                aria-label={`square ${square}`}
                className="relative aspect-square border border-black/20 transition hover:bg-black/10 disabled:cursor-default"
              >
                {disc && (
                  <span
                    className={`absolute inset-[12%] rounded-full shadow ${
                      disc === "b" ? "bg-[#141416] ring-1 ring-white/20" : "bg-[#f4f1e7]"
                    }`}
                  />
                )}
                {flips && !disc && (
                  <span
                    className="absolute inset-[34%] rounded-full border-2 border-primary bg-primary/30"
                    title={`flips ${flips.length}`}
                  />
                )}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDifficulty((value) => (value === 3 ? 4 : 3))}
            className="flex h-10 items-center gap-1.5 rounded-full border border-white/15 px-3 text-[11px] font-bold text-white/70 transition hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" /> AI depth {difficulty}
          </button>
          <span className="flex items-center gap-1.5 text-[11px] text-white/50">
            <Bot className="h-3.5 w-3.5" /> {log.length} moves played
          </span>
        </div>
      </div>
    </GameShell>
  );
}

export default ReversiGame;
