/**
 * 2048 — the sliding/merging rules, with the one thing people get wrong made
 * explicit: a tile created by a merge may NOT merge again in the same slide
 * (so [2,2,2,2] becomes [4,4], never [8]).
 */

export type Direction = "up" | "down" | "left" | "right";
export type Grid = number[]; // 16 cells, row-major
export const SIZE = 4;

export const emptyGrid = (): Grid => new Array(SIZE * SIZE).fill(0);

export function spawn(grid: Grid, random = Math.random): Grid {
  const free: number[] = [];
  grid.forEach((value, index) => {
    if (!value) free.push(index);
  });
  if (free.length === 0) return grid;
  const cell = free[Math.floor(random() * free.length)];
  const next = grid.slice();
  next[cell] = random() < 0.9 ? 2 : 4;
  return next;
}

export const startGrid = (random = Math.random): Grid => spawn(spawn(emptyGrid(), random), random);

/**
 * The four cells of one line, ordered from the edge the tiles slide towards.
 *
 * `line` is a row for left/right and a column for up/down — passing a *cell*
 * index here was the original bug: rows 0 and 1 mapped to the same list, so a
 * slide merged the row twice ([2,2,2,2] became [8], not [4,4]).
 */
function lineFor(direction: Direction, line: number): number[] {
  const order = [0, 1, 2, 3];
  const from = direction === "right" || direction === "down" ? order.slice().reverse() : order;
  return from.map((step) =>
    direction === "left" || direction === "right" ? line * SIZE + step : step * SIZE + line,
  );
}

export function slide(
  grid: Grid,
  direction: Direction,
): { grid: Grid; gained: number; moved: boolean } {
  const next = grid.slice();
  let gained = 0;
  let moved = false;

  for (let line = 0; line < SIZE; line += 1) {
    const cells = lineFor(direction, line);
    const tiles = cells.map((cell) => next[cell]).filter((value) => value !== 0) as number[];
    const merged: number[] = [];
    for (let i = 0; i < tiles.length; i += 1) {
      if (i + 1 < tiles.length && tiles[i] === tiles[i + 1]) {
        merged.push(tiles[i] * 2);
        gained += tiles[i] * 2;
        i += 1;
      } else {
        merged.push(tiles[i]);
      }
    }
    while (merged.length < SIZE) merged.push(0);
    cells.forEach((cell, position) => {
      if (next[cell] !== merged[position]) moved = true;
      next[cell] = merged[position];
    });
  }

  return { grid: next, gained, moved };
}

export function canMove(grid: Grid): boolean {
  if (grid.some((value) => value === 0)) return true;
  for (const direction of ["up", "down", "left", "right"] as Direction[]) {
    if (slide(grid, direction).moved) return true;
  }
  return false;
}

export function bestTile(grid: Grid): number {
  return grid.reduce((best, value) => (value > best ? value : best), 0);
}

export function score(grid: Grid): number {
  return grid.reduce((total, value) => total + value, 0);
}
