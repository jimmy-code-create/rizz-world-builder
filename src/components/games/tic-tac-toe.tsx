import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { GameChip, GameShell } from "@/components/games/board-frame";
import {
  bestCell,
  emptyBoard,
  freeCells,
  isFull,
  winnerOf,
  type Mark,
  type TttBoard,
} from "@/lib/games/tictactoe";

/**
 * TIC-TAC-TOE — the AI is perfect, so the honest goal is a draw. It plays a
 * random opening move to keep games from being identical, then never loses.
 */
export function TicTacToeGame({ players = 1 }: { players?: number }) {
  const [board, setBoard] = useState<TttBoard>(() => emptyBoard());
  const [human, setHuman] = useState<Mark>("X");
  const [busy, setBusy] = useState(false);
  const [tally, setTally] = useState({ win: 0, draw: 0, loss: 0 });

  const engine: Mark = human === "X" ? "O" : "X";
  const win = winnerOf(board);
  const full = isFull(board);

  const endState = win ? (win.mark === human ? "win" : "loss") : full ? "draw" : null;

  // Counting once per finished board: effects can re-run (StrictMode, a parent
  // re-render), and a score that jumps by two on one draw looks like a bug.
  const countedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!endState) return;
    const signature = `${endState}:${board.map((cell) => cell ?? "-").join("")}`;
    if (countedRef.current === signature) return;
    countedRef.current = signature;
    setTally((current) => ({
      win: current.win + (endState === "win" ? 1 : 0),
      draw: current.draw + (endState === "draw" ? 1 : 0),
      loss: current.loss + (endState === "loss" ? 1 : 0),
    }));
  }, [endState, board]);

  const play = useCallback((cell: number, mark: Mark) => {
    setBoard((current) => {
      const next = current.slice();
      next[cell] = mark;
      return next;
    });
  }, []);

  useEffect(() => {
    if (win || full) return;
    const turnIsEngine = (board.filter(Boolean).length % 2 === 0) !== (human === "X");
    if (!turnIsEngine) return;
    setBusy(true);
    const timer = window.setTimeout(() => {
      const cells = freeCells(board);
      const cell =
        cells.length === 9 ? cells[Math.floor(Math.random() * 9)] : bestCell(board, engine);
      if (cell !== null) play(cell, engine);
      setBusy(false);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [board, win, full, human, engine, play]);

  const restart = (nextHuman: Mark = human) => {
    setHuman(nextHuman);
    setBoard(emptyBoard());
  };

  return (
    <GameShell
      status={
        win
          ? win.mark === human
            ? "You win — but the engine never loses twice."
            : "Engine wins this round."
          : full
            ? "Draw — the best a perfect opponent allows."
            : busy
              ? "Engine is thinking…"
              : "Your move."
      }
      chips={
        <>
          <GameChip label="w" value={tally.win} accent="#c9ff3d" />
          <GameChip label="d" value={tally.draw} />
          <GameChip label="l" value={tally.loss} accent="#ff5d5d" />
        </>
      }
      onRestart={() => restart()}
      restartLabel="New round"
      footer={`You are ${human}. Switch sides any time — with a perfect AI, both sides draw.`}
    >
      <div className="flex w-full max-w-[min(100%,460px)] flex-col items-center gap-3">
        <div className="grid w-full grid-cols-3 gap-2">
          {board.map((cell, index) => {
            const inWin = win?.line.includes(index);
            return (
              <button
                key={index}
                type="button"
                disabled={!!cell || !!win || busy}
                onClick={() => play(index, human)}
                className={`grid aspect-square place-items-center rounded-2xl border text-[clamp(28px,10vw,64px)] font-bold transition ${
                  inWin
                    ? "border-primary bg-primary/20 text-primary"
                    : "border-white/10 bg-white/[0.04] text-white"
                } ${!cell && !win ? "hover:border-primary/50" : ""}`}
              >
                {cell === "X" ? "✕" : cell === "O" ? "◯" : ""}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => restart(human === "X" ? "O" : "X")}
            className="flex h-10 items-center gap-1.5 rounded-full border border-white/15 px-3 text-[11px] font-bold text-white/70 transition hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Play as {human === "X" ? "O" : "X"}
          </button>
          <span className="text-[11px] text-white/45">
            {players > 1 ? "Pass the phone between rounds" : "Perfect AI"}
          </span>
        </div>
      </div>
    </GameShell>
  );
}

export default TicTacToeGame;
