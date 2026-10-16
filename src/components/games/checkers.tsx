import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, Flag } from "lucide-react";
import { GameChip, GameShell } from "@/components/games/board-frame";
import {
  applyMove,
  bestMove,
  generateMoves,
  initialState,
  isKing,
  pieceCount,
  sideOf,
  winnerOf,
  type CheckersMove,
  type CheckersState,
} from "@/lib/games/checkers";

/** CHECKERS — American rules (captures are mandatory and must be the longest). */
export function CheckersGame({ players = 1 }: { players?: number }) {
  const [state, setState] = useState<CheckersState>(() => initialState());
  const [selected, setSelected] = useState<number | null>(null);
  const [thinking, setThinking] = useState(false);
  const [chain, setChain] = useState<string[]>([]);

  const winner = useMemo(() => winnerOf(state), [state]);
  const legal = useMemo(() => generateMoves(state), [state]);
  const myTurn = state.turn === "r" && !winner;

  const play = useCallback((move: CheckersMove) => {
    setState((current) => applyMove(current, move));
    setChain((moves) => [
      ...moves,
      `${move.captures.length ? "×" : ""}${move.captures.length || `${move.from}→${move.to}`}`,
    ]);
    setSelected(null);
  }, []);

  useEffect(() => {
    if (state.turn !== "b" || winner) return;
    setThinking(true);
    const timer = window.setTimeout(() => {
      const move = bestMove(state, players > 1 ? 5 : 4);
      if (move) play(move);
      setThinking(false);
    }, 320);
    return () => window.clearTimeout(timer);
  }, [state, winner, players, play]);

  const destinations =
    selected === null ? [] : legal.filter((move) => move.from === selected).map((move) => move.to);

  const onSquare = (square: number) => {
    if (!myTurn || thinking) return;
    const cell = state.board[square];
    if (selected !== null && destinations.includes(square)) {
      // Two equal-capture paths can land on the same square; they are equivalent.
      const move = legal.find(
        (candidate) => candidate.from === selected && candidate.to === square,
      );
      if (move) play(move);
      return;
    }
    if (cell && sideOf(cell) === "r") {
      const hasMoves = legal.some((move) => move.from === square);
      setSelected(hasMoves ? square : null);
      return;
    }
    setSelected(null);
  };

  const statusText = winner
    ? winner === "r"
      ? "You win — nice chain."
      : "Black wins this one."
    : thinking
      ? "Computer is thinking…"
      : legal[0]?.captures.length
        ? "Capture is mandatory — take the longest chain."
        : "Your move.";

  return (
    <GameShell
      status={statusText}
      chips={
        <>
          <GameChip label="you" value={pieceCount(state.board, "r")} accent="#c9ff3d" />
          <GameChip label="black" value={pieceCount(state.board, "b")} accent="#ffb347" />
          <GameChip label="kings" value={state.board.filter((cell) => isKing(cell)).length} />
        </>
      }
      onRestart={() => {
        setState(initialState());
        setSelected(null);
        setChain([]);
      }}
      footer={
        chain.length
          ? chain.slice(-8).join("  ")
          : "Men move forward, kings both ways. Reach the far rank to crown one."
      }
    >
      <div className="flex w-full max-w-[min(100%,560px)] flex-col items-center gap-2">
        <div className="grid w-full grid-cols-8 overflow-hidden rounded-xl border border-white/10 shadow-lg">
          {state.board.map((cell, square) => {
            const file = square % 8;
            const rank = Math.floor(square / 8);
            const dark = (file + rank) % 2 === 1;
            const isTarget = destinations.includes(square);
            return (
              <button
                key={square}
                type="button"
                onClick={() => onSquare(square)}
                aria-label={`square ${square}`}
                className={`relative aspect-square transition ${
                  dark ? "bg-[#2f2f34]" : "bg-[#17171a]"
                } ${selected === square ? "ring-2 ring-inset ring-primary" : ""}`}
              >
                {cell && (
                  <span
                    className={`absolute inset-[14%] grid place-items-center rounded-full border-2 text-[clamp(10px,2.6vw,20px)] font-bold shadow ${
                      sideOf(cell) === "r"
                        ? "border-primary/60 bg-primary text-[#0a0a0b]"
                        : "border-[#3a3a3f] bg-[#e6e3d8] text-[#0a0a0b]"
                    }`}
                  >
                    {isKing(cell) ? <span className="text-[1.4em] leading-none">♛</span> : ""}
                  </span>
                )}
                {isTarget && (
                  <span className="pointer-events-none absolute inset-0 grid place-items-center">
                    <span className="h-3 w-3 rounded-full bg-primary/80" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="flex items-center gap-1.5 text-[11px] text-white/50">
          <Bot className="h-3.5 w-3.5" /> Computer plays black
          <Flag className="ml-2 h-3.5 w-3.5" /> {legal.length} legal{" "}
          {legal.length === 1 ? "move" : "moves"} for you
        </p>
      </div>
    </GameShell>
  );
}

export default CheckersGame;
