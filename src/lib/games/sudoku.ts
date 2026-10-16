/**
 * SUDOKU — generation, solving and conflict detection.
 *
 * Puzzles are dug out of a solved grid and only kept when the solver still finds
 * exactly one solution, so every puzzle a player gets is solvable by logic (and
 * by the Hint button) rather than by guessing.
 */

export type Grid = number[]; // 81 cells, row-major, 0 = empty
export type Difficulty = "easy" | "medium" | "hard";

export const DIFFICULTY_HOLES: Record<Difficulty, number> = { easy: 38, medium: 48, hard: 56 };

const shuffle = <T>(items: T[], random: () => number): T[] => {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

function candidates(grid: Grid, index: number): number[] {
  const row = Math.floor(index / 9);
  const col = index % 9;
  const used = new Set<number>();
  for (let i = 0; i < 9; i += 1) {
    used.add(grid[row * 9 + i]);
    used.add(grid[i * 9 + col]);
  }
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 3; c += 1) used.add(grid[(boxRow + r) * 9 + boxCol + c]);
  }
  const options: number[] = [];
  for (let value = 1; value <= 9; value += 1) if (!used.has(value)) options.push(value);
  return options;
}

/** A solved grid. Randomized backtracking, so every call is a different board. */
export function generateSolved(random = Math.random): Grid {
  const grid: Grid = new Array(81).fill(0);
  const fill = (index: number): boolean => {
    if (index === 81) return true;
    if (grid[index]) return fill(index + 1);
    for (const value of shuffle(candidates(grid, index), random)) {
      grid[index] = value;
      if (fill(index + 1)) return true;
      grid[index] = 0;
    }
    return false;
  };
  fill(0);
  return grid;
}

export function solve(grid: Grid): Grid | null {
  const work = grid.slice();
  const fill = (index: number): boolean => {
    if (index === 81) return true;
    if (work[index]) return fill(index + 1);
    for (const value of candidates(work, index)) {
      work[index] = value;
      if (fill(index + 1)) return true;
      work[index] = 0;
    }
    return false;
  };
  return fill(0) ? work : null;
}

/** Stops as soon as `limit` solutions are found — used for the uniqueness check. */
export function countSolutions(grid: Grid, limit = 2): number {
  const work = grid.slice();
  let found = 0;
  const walk = (index: number): void => {
    if (found >= limit) return;
    if (index === 81) {
      found += 1;
      return;
    }
    if (work[index]) {
      walk(index + 1);
      return;
    }
    for (const value of candidates(work, index)) {
      work[index] = value;
      walk(index + 1);
      work[index] = 0;
      if (found >= limit) return;
    }
  };
  walk(0);
  return found;
}

export function makePuzzle(
  difficulty: Difficulty = "easy",
  random = Math.random,
): { puzzle: Grid; solution: Grid } {
  const solution = generateSolved(random);
  const puzzle = solution.slice();
  const order = shuffle(
    Array.from({ length: 81 }, (_, index) => index),
    random,
  );
  let holes = 0;
  const target = DIFFICULTY_HOLES[difficulty];
  for (const index of order) {
    if (holes >= target) break;
    const value = puzzle[index];
    puzzle[index] = 0;
    if (countSolutions(puzzle, 2) !== 1) puzzle[index] = value;
    else holes += 1;
  }
  return { puzzle, solution };
}

export function conflictsIn(grid: Grid): Set<number> {
  const bad = new Set<number>();
  const groups: number[][] = [];
  for (let i = 0; i < 9; i += 1) {
    groups.push(Array.from({ length: 9 }, (_, c) => i * 9 + c));
    groups.push(Array.from({ length: 9 }, (_, r) => r * 9 + i));
  }
  for (let boxRow = 0; boxRow < 3; boxRow += 1) {
    for (let boxCol = 0; boxCol < 3; boxCol += 1) {
      const cells: number[] = [];
      for (let r = 0; r < 3; r += 1) {
        for (let c = 0; c < 3; c += 1) cells.push((boxRow * 3 + r) * 9 + boxCol * 3 + c);
      }
      groups.push(cells);
    }
  }
  for (const group of groups) {
    const seen = new Map<number, number>();
    for (const index of group) {
      const value = grid[index];
      if (!value) continue;
      if (seen.has(value)) {
        bad.add(index);
        bad.add(seen.get(value)!);
      } else {
        seen.set(value, index);
      }
    }
  }
  return bad;
}

export function isComplete(grid: Grid): boolean {
  return grid.every((value) => value > 0) && conflictsIn(grid).size === 0;
}

/** One empty cell that has a single possible value — what the Hint button fills. */
export function nextHint(grid: Grid): { index: number; value: number } | null {
  let fallback: { index: number; value: number } | null = null;
  for (let index = 0; index < 81; index += 1) {
    if (grid[index]) continue;
    const options = candidates(grid, index);
    if (options.length === 1) return { index, value: options[0] };
    if (!fallback && options.length > 0) fallback = { index, value: options[0] };
  }
  return fallback;
}
