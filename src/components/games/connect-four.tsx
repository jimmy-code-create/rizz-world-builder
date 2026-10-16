import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot } from "lucide-react";
import { GameChip, GameShell } from "@/components/games/board-frame";
import {
  bestColumn,
  COLS,
  drop,
  emptyBoard,
  isFull,
  legalColumns,
  ROWS,
  winningLine,
  winnerOf,
  type Board,
  type Player,
} from "@/lib/games/connect4";

/** CONNECT FOUR — you are the lime discs; the AI searches five plies ahead. */
export function ConnectFourGame({ players = 1 }: { players?: number }) {
  const [board, setBoard] = useState<Board>(() => emptyBoard());
  const [thinking, setThinking] = useState(false);
  const [moves, setMoves] = useState(0);
  const [history, setHistory] = useState<number[]>([]);

  const winner = useMemo(() => winnerOf(board), [board]);
  const winLine = useMemo(() => (winner ? winningLine(board, winner) : null), [board, winner]);
  const draw = !winner && isFull(board);
  const myTurn = !winner && !draw && board.filter(Boolean).length % 2 === 0;

  const play = useCallback((col: number, player: Player) => {
    setBoard((current) => drop(current, col, player) ?? current);
    setMoves((count) => count + 1);
    setHistory((list) => [...list, col + 1]);
  }, []);

  useEffect(() => {
    if (winner || draw || myTurn) return;
    setThinking(true);
    const timer = window.setTimeout(() => {
      const col = bestColumn(board, 2, players > 1 ? 5 : 4);
      if (col !== null) play(col, 2);
      setThinking(false);
    }, 340);
    return () => window.clearTimeout(timer);
  }, [board, winner, draw, myTurn, players, play]);

  const clickColumn = (col: number) => {
    if (!myTurn || thinking) return;
    if (!legalColumns(board).includes(col)) return;
    play(col, 1);
  };

  return (
    <GameShell
      status={
        winner
          ? winner === 1
            ? "Four in a row — you win!"
            : "The engine connects four."
          : draw
            ? "Board full — a draw."
            : thinking
              ? "Engine is thinking…"
              : "Drop a disc."
      }
      chips={
        <>
          <GameChip label="discs" value={moves} />
          <GameChip
            label="you"
            value={board.filter((cell) => cell === 1).length}
            accent="#c9ff3d"
          />
          <GameChip
            label="cpu"
            value={board.filter((cell) => cell === 2).length}
            accent="#ffb347"
          />
        </>
      }
      onRestart={() => {
        setBoard(emptyBoard());
        setMoves(0);
        setHistory([]);
      }}
      footer={
        history.length
          ? `Columns: ${history.slice(-10).join(" · ")}`
          : "Tap a column. The engine wins immediately when it can, and blocks when it must."
      }
    >
      <div className="flex w-full max-w-[min(100%,560px)] flex-col items-center gap-2">
        <div
          className="grid w-full grid-cols-7 gap-1 rounded-2xl border border-white/10 bg-[#141416] p-2"
          style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: COLS }).map((_, col) => (
            <button
              key={`top-${col}`}
              type="button"
              onClick={() => clickColumn(col)}
              aria-label={`Drop in column ${col + 1}`}
              className="-mb-1 grid h-6 place-items-center rounded-full text-[10px] font-bold text-white/35 transition hover:text-primary disabled:opacity-30"
              disabled={!!winner || draw}
            >
              {col + 1}
            </button>
          ))}
          {Array.from({ length: ROWS }).map((_, row) =>
            Array.from({ length: COLS }).map((__, col) => {
              const index = row * COLS + col;
              const cell = board[index];
              const highlight = winLine?.includes(index);
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => clickColumn(col)}
                  aria-label={`Column ${col + 1}, row ${row + 1}`}
                  className="grid aspect-square place-items-center rounded-full bg-black/40"
                >
                  <span
                    className={`h-[86%] w-[86%] rounded-full border transition ${
                      cell === 1
                        ? "border-primary/60 bg-primary"
                        : cell === 2
                          ? "border-[#3a3a3f] bg-[#e6e3d8]"
                          : "border-white/[0.06] bg-white/[0.03]"
                    } ${highlight ? "ring-2 ring-white" : ""}`}
                  />
                </button>
              );
            }),
          )}
        </div>
        <p className="flex items-center gap-1.5 text-[11px] text-white/50">
          <Bot className="h-3.5 w-3.5" /> Engine plays white
        </p>
      </div>
    </GameShell>
  );
}

export default ConnectFourGame;
