import { useMemo, useState } from "react";
import { Bomb, Flag, ShieldQuestion } from "lucide-react";
import { GameChip, GameShell, GameTimer } from "@/components/games/board-frame";
import {
  DIFFICULTIES,
  emptyBoard,
  flagCount,
  isLost,
  isWon,
  plantMines,
  reveal,
  revealAll,
  toggleFlag,
  type Board,
  type Difficulty,
} from "@/lib/games/minesweeper";

const NUMBER_COLOR = [
  "",
  "text-[#5ad8ff]",
  "text-[#b6f36b]",
  "text-[#ffb347]",
  "text-[#ff8fab]",
  "text-[#ff6b9d]",
  "text-[#7dd3fc]",
  "text-white",
  "text-[#c9ff3d]",
];

/** MINESWEEPER — first click is always safe; flag mode for touch screens. */
export function MinesweeperGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [board, setBoard] = useState<Board>(() => {
    const config = DIFFICULTIES.easy;
    return emptyBoard(config.rows, config.cols, config.mines);
  });
  const [started, setStarted] = useState(false);
  const [flagMode, setFlagMode] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const lost = isLost(board);
  const won = isWon(board);
  const finished = lost || won;
  const flags = useMemo(() => flagCount(board), [board]);

  const restart = (next: Difficulty = difficulty) => {
    const config = DIFFICULTIES[next];
    setDifficulty(next);
    setBoard(emptyBoard(config.rows, config.cols, config.mines));
    setStarted(false);
    setResetKey((key) => key + 1);
  };

  const tap = (index: number) => {
    if (finished) return;
    if (flagMode) {
      setBoard((current) => toggleFlag(current, index));
      return;
    }
    setBoard((current) => {
      const planted = started ? current : plantMines(current, index);
      const next = reveal(planted, index);
      if (isLost(next)) return revealAll(next);
      return next;
    });
    setStarted(true);
  };

  return (
    <GameShell
      status={
        lost
          ? "Boom — that one was a mine."
          : won
            ? "Cleared! Every mine flagged-free."
            : `${board.rows}×${board.cols} · ${board.mines} mines`
      }
      chips={
        <>
          <GameChip label="mines" value={board.mines - flags} accent="#ff5d5d" />
          <GameChip label="cells" value={board.cells.filter((cell) => cell.revealed).length} />
          <GameTimer running={started && !finished} resetKey={resetKey} />
        </>
      }
      onRestart={() => restart()}
      footer="Tap to open, flag mode to mark. Blank cells open their whole neighbourhood."
    >
      <div className="flex w-full max-w-[min(100%,560px)] flex-col items-center gap-2">
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {(Object.keys(DIFFICULTIES) as Difficulty[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => restart(key)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-bold capitalize transition ${
                difficulty === key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-white/15 text-white/65 hover:text-white"
              }`}
            >
              {key}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setFlagMode((value) => !value)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
              flagMode
                ? "border-amber-400 bg-amber-400/15 text-amber-300"
                : "border-white/15 text-white/65 hover:text-white"
            }`}
          >
            {flagMode ? (
              <Flag className="h-3.5 w-3.5" />
            ) : (
              <ShieldQuestion className="h-3.5 w-3.5" />
            )}
            {flagMode ? "Flagging" : "Flag mode"}
          </button>
        </div>

        <div
          className="grid w-full gap-[3px] rounded-xl border border-white/10 bg-[#141416] p-2"
          style={{ gridTemplateColumns: `repeat(${board.cols}, minmax(0, 1fr))` }}
        >
          {board.cells.map((cell, index) => {
            const open = cell.revealed;
            return (
              <button
                key={index}
                type="button"
                onClick={() => tap(index)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  if (!finished) setBoard((current) => toggleFlag(current, index));
                }}
                aria-label={`cell ${index + 1}`}
                className={`grid aspect-square place-items-center rounded-[4px] text-[clamp(9px,2.4vw,15px)] font-bold transition ${
                  open
                    ? cell.mine
                      ? "bg-[#ff5d5d]/30 text-[#ff5d5d]"
                      : "bg-black/40 text-white/80"
                    : "bg-white/[0.07] hover:bg-white/[0.13]"
                }`}
              >
                {open ? (
                  cell.mine ? (
                    <Bomb className="h-[70%] w-[70%]" />
                  ) : cell.adjacent > 0 ? (
                    <span className={NUMBER_COLOR[cell.adjacent]}>{cell.adjacent}</span>
                  ) : (
                    ""
                  )
                ) : cell.flagged ? (
                  <Flag className="h-[70%] w-[70%] text-amber-400" />
                ) : (
                  ""
                )}
              </button>
            );
          })}
        </div>
        {finished && (
          <p className="text-xs font-semibold text-white/70">
            {won ? "You cleared every safe cell." : "Mines revealed — hit New game to try again."}
          </p>
        )}
      </div>
    </GameShell>
  );
}

export default MinesweeperGame;
