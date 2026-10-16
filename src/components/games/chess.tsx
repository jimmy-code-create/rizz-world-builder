import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, Crown, Lightbulb } from "lucide-react";
import { GameChip, GameShell } from "@/components/games/board-frame";
import {
  applyMove,
  bestMove,
  generateMoves,
  initialState,
  moveLabel,
  PIECE_VALUE,
  squareName,
  status,
  type ChessState,
  type Move,
  type PieceType,
} from "@/lib/games/chess";

/**
 * CHESS — you play White against a depth-3 search (a solid club player).
 *
 * The board is a <button> grid, so it is keyboard-accessible and crisp at every
 * size; every rule lives in `@/lib/games/chess` and is verified by perft.
 */
const GLYPHS: Record<PieceType, { w: string; b: string }> = {
  k: { w: "♔", b: "♚" },
  q: { w: "♕", b: "♛" },
  r: { w: "♖", b: "♜" },
  b: { w: "♗", b: "♝" },
  n: { w: "♘", b: "♞" },
  p: { w: "♙", b: "♟" },
};

const PROMO_CHOICES: PieceType[] = ["q", "r", "b", "n"];

export function ChessGame({ players = 1 }: { players?: number }) {
  const [state, setState] = useState<ChessState>(() => initialState());
  const [selected, setSelected] = useState<number | null>(null);
  const [promotion, setPromotion] = useState<{ from: number; to: number } | null>(null);
  const [thinking, setThinking] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [hint, setHint] = useState<Move | null>(null);
  // Two plies is a friendly opponent, three is a real one. Both are instant.
  const [depth, setDepth] = useState(players > 2 ? 4 : 3);

  const info = useMemo(() => status(state), [state]);
  const myMoves = info.moves;
  const flipped = false;

  const push = useCallback(
    (from: number, to: number, promo?: PieceType) => {
      const move = myMoves.find(
        (candidate) =>
          candidate.from === from &&
          candidate.to === to &&
          (promo ? candidate.promo === promo : !candidate.promo),
      );
      if (!move) return;
      setHistory((moves) => [...moves, moveLabel(state, move)]);
      setState(applyMove(state, move));
      setSelected(null);
      setHint(null);
    },
    [myMoves, state],
  );

  const onSquare = (square: number) => {
    if (info.over || state.turn !== "w" || thinking) return;
    const piece = state.board[square];
    if (selected === null) {
      if (piece && piece[0] === "w") setSelected(square);
      return;
    }
    if (square === selected) {
      setSelected(null);
      return;
    }
    const candidates = myMoves.filter((move) => move.from === selected && move.to === square);
    if (candidates.length === 0) {
      if (piece && piece[0] === "w") setSelected(square);
      else setSelected(null);
      return;
    }
    if (candidates.some((move) => move.promo)) {
      setPromotion({ from: selected, to: square });
      return;
    }
    push(selected, square);
  };

  // The AI plays Black, one turn behind, with a beat so the move is visible.
  useEffect(() => {
    if (state.turn !== "b" || info.over) return;
    setThinking(true);
    const timer = window.setTimeout(() => {
      const move = bestMove(state, depth);
      if (move) {
        setHistory((moves) => [...moves, moveLabel(state, move)]);
        setState((current) => applyMove(current, move));
      }
      setThinking(false);
    }, 260);
    return () => window.clearTimeout(timer);
  }, [state, info.over, depth]);

  // Start material is 4000 per side, so what is missing is what was captured.
  const captured = useMemo(() => {
    const material = { w: 0, b: 0 };
    for (const piece of state.board) {
      if (piece) material[piece[0] as "w" | "b"] += PIECE_VALUE[piece[1] as PieceType];
    }
    return { w: 4000 - material.b, b: 4000 - material.w };
  }, [state.board]);

  const statusText = info.over
    ? info.result === "checkmate"
      ? info.winner === "w"
        ? "Checkmate — you win!"
        : "Checkmate — the engine wins."
      : "Stalemate — a draw."
    : thinking
      ? "Engine is thinking…"
      : info.check
        ? "You are in check."
        : "Your move.";

  const targets =
    selected === null
      ? []
      : myMoves.filter((move) => move.from === selected).map((move) => move.to);

  return (
    <GameShell
      status={statusText}
      chips={
        <>
          <GameChip label="you" value={captured.w} accent="#c9ff3d" />
          <GameChip label="engine" value={captured.b} accent="#ffb347" />
          <GameChip label="moves" value={Math.ceil(history.length / 2)} />
        </>
      }
      onRestart={() => {
        setState(initialState());
        setHistory([]);
        setSelected(null);
        setHint(null);
      }}
      footer={
        history.length
          ? history.slice(-6).join("  ")
          : "Tap a white piece, then a highlighted square. Depth-3 engine, full rules (castling, en passant, promotion)."
      }
    >
      <div className="flex w-full max-w-[min(100%,560px)] flex-col gap-2">
        <div className="grid grid-cols-8 overflow-hidden rounded-xl border border-white/10 shadow-lg">
          {state.board.map((piece, square) => {
            const file = square % 8;
            const rank = Math.floor(square / 8);
            const dark = (file + rank) % 2 === 1;
            const isTarget = targets.includes(square);
            const isSelected = selected === square;
            const isHint = hint && (hint.from === square || hint.to === square);
            return (
              <button
                key={square}
                type="button"
                onClick={() => onSquare(square)}
                aria-label={`${squareName(square)}${piece ? ` ${piece}` : ""}`}
                className={`relative aspect-square text-[clamp(18px,4.6vw,40px)] leading-none transition ${
                  dark ? "bg-[#3a3a3f]" : "bg-[#8d8b84]"
                } ${isSelected ? "ring-2 ring-inset ring-primary" : ""} ${isHint ? "ring-2 ring-inset ring-amber-400" : ""}`}
                style={{ color: piece?.[0] === "w" ? "#fdfcf7" : "#141416" }}
              >
                <span className="pointer-events-none absolute inset-0 grid place-items-center">
                  {piece ? GLYPHS[piece[1] as PieceType][piece[0] as "w" | "b"] : ""}
                </span>
                {isTarget && (
                  <span className="pointer-events-none absolute inset-0 grid place-items-center">
                    <span
                      className={`rounded-full ${piece ? "h-full w-full border-4 border-primary/70" : "h-1/3 w-1/3 bg-primary/70"}`}
                    />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHint(bestMove(state, 2))}
            disabled={info.over || state.turn !== "w"}
            className="flex h-10 items-center gap-1.5 rounded-full border border-white/15 px-3 text-[11px] font-bold text-white/70 transition hover:text-white disabled:opacity-40"
          >
            <Lightbulb className="h-3.5 w-3.5" /> Hint
          </button>
          <button
            type="button"
            onClick={() => setDepth((value) => (value === 3 ? 2 : 3))}
            className="flex h-10 items-center gap-1.5 rounded-full border border-white/15 px-3 text-[11px] font-bold text-white/70 transition hover:text-white"
          >
            <Bot className="h-3.5 w-3.5" /> Engine: {depth === 2 ? "casual" : "club"}
          </button>
          <span className="ml-auto flex items-center gap-1.5 text-[11px] text-white/50">
            <Crown className="h-3.5 w-3.5 text-primary" />{" "}
            {flipped ? "White bottom" : "You are White"}
          </span>
        </div>
      </div>

      {promotion && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-black/70 p-4">
          <div className="rounded-2xl border border-white/10 bg-[#141416] p-4 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/60">
              Promote to
            </p>
            <div className="mt-3 flex gap-2">
              {PROMO_CHOICES.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  onClick={() => {
                    push(promotion.from, promotion.to, choice);
                    setPromotion(null);
                  }}
                  className="grid h-14 w-14 place-items-center rounded-xl border border-white/15 bg-black/40 text-3xl text-white transition hover:border-primary"
                >
                  {GLYPHS[choice].w}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </GameShell>
  );
}

export default ChessGame;
