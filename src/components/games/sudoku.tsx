import { useCallback, useMemo, useState } from "react";
import { Eraser, Lightbulb } from "lucide-react";
import { GameChip, GameShell, GameTimer } from "@/components/games/board-frame";
import {
  conflictsIn,
  DIFFICULTY_HOLES,
  isComplete,
  makePuzzle,
  nextHint,
  type Difficulty,
  type Grid,
} from "@/lib/games/sudoku";

/** SUDOKU — generated with a unique solution, so it never needs guessing. */
export function SudokuGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  // Puzzle and solution always come from ONE generation — two calls would pair a
  // board with somebody else's answer key.
  const [level, setLevel] = useState<{ puzzle: Grid; solution: Grid }>(() => makePuzzle("easy"));
  const [grid, setGrid] = useState<Grid>(() => level.puzzle.slice());
  const [selected, setSelected] = useState<number | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [hints, setHints] = useState(0);
  const puzzle = level.puzzle;
  const solution = level.solution;

  const conflicts = useMemo(() => conflictsIn(grid), [grid]);
  const complete = useMemo(() => isComplete(grid), [grid]);
  const remaining = grid.filter((value) => value === 0).length;

  const fresh = useCallback((next: Difficulty) => {
    const generated = makePuzzle(next);
    setDifficulty(next);
    setLevel(generated);
    setGrid(generated.puzzle.slice());
    setSelected(null);
    setMistakes(0);
    setHints(0);
    setResetKey((key) => key + 1);
  }, []);

  const place = (value: number) => {
    if (selected === null || complete) return;
    if (puzzle[selected] !== 0) return;
    setGrid((current) => {
      const next = current.slice();
      next[selected] = value;
      return next;
    });
    if (value !== 0 && value !== solution[selected]) setMistakes((count) => count + 1);
  };

  const hint = () => {
    const found = nextHint(grid);
    if (!found) return;
    setGrid((current) => {
      const next = current.slice();
      next[found.index] = found.value;
      return next;
    });
    setSelected(found.index);
    setHints((count) => count + 1);
  };

  return (
    <GameShell
      status={
        complete
          ? "Solved — no conflicts, nothing missing."
          : `${remaining} cells left${conflicts.size ? " · something clashes" : ""}`
      }
      chips={
        <>
          <GameChip label="mistakes" value={mistakes} accent={mistakes ? "#ff5d5d" : undefined} />
          <GameChip label="hints" value={hints} />
          <GameTimer running={!complete} resetKey={resetKey} />
        </>
      }
      onRestart={() => fresh(difficulty)}
      footer="Tap a cell, then a number. Clashing rows, columns and boxes light up red."
    >
      <div className="flex w-full max-w-[min(100%,520px)] flex-col items-center gap-2">
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {(Object.keys(DIFFICULTY_HOLES) as Difficulty[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => fresh(key)}
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
            onClick={hint}
            disabled={complete}
            className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-bold text-white/65 transition hover:text-white disabled:opacity-40"
          >
            <Lightbulb className="h-3.5 w-3.5" /> Hint
          </button>
        </div>

        <div className="grid w-full grid-cols-9 gap-[2px] rounded-xl border border-white/10 bg-[#141416] p-2">
          {grid.map((value, index) => {
            const row = Math.floor(index / 9);
            const col = index % 9;
            const fixed = puzzle[index] !== 0;
            const bad =
              conflicts.has(index) || (value !== 0 && !fixed && value !== solution[index]);
            const sameValue = selected !== null && value !== 0 && value === grid[selected];
            const boxEdge = (col % 3 === 2 && col !== 8) || (row % 3 === 2 && row !== 8);
            return (
              <button
                key={index}
                type="button"
                onClick={() => setSelected(index)}
                aria-label={`row ${row + 1} column ${col + 1}`}
                className={`grid aspect-square place-items-center rounded-[4px] font-mono text-[clamp(12px,3.4vw,22px)] font-bold transition ${
                  fixed ? "bg-white/[0.09] text-white/85" : "bg-black/35 text-primary"
                } ${bad ? "bg-[#ff5d5d]/25 text-[#ff5d5d]" : ""} ${
                  selected === index
                    ? "ring-2 ring-inset ring-primary"
                    : sameValue
                      ? "bg-primary/15"
                      : ""
                }`}
                style={boxEdge ? { marginRight: 2, marginBottom: 2 } : undefined}
              >
                {value || ""}
              </button>
            );
          })}
        </div>

        <div className="flex w-full flex-wrap justify-center gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => place(digit)}
              className="grid h-11 w-11 place-items-center rounded-xl border border-white/15 bg-black/40 font-mono text-base font-bold text-white transition hover:border-primary hover:text-primary"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={() => place(0)}
            aria-label="Clear the cell"
            className="grid h-11 w-11 place-items-center rounded-xl border border-white/15 bg-black/40 text-white/70 transition hover:text-white"
          >
            <Eraser className="h-4 w-4" />
          </button>
        </div>
      </div>
    </GameShell>
  );
}

export default SudokuGame;
