/**
 * Long-story (1k–2k message) generation support.
 *
 * No single LLM call can emit a thousand chat messages: at ~50 tokens per
 * JSON line, an 8192-token budget caps a pass at roughly 120–150 lines. Long
 * and epic stories are therefore written chapter by chapter across several
 * passes and stitched here with global index offsets. Pure module: no DOM, no
 * network, fully unit-testable with mocked chunks.
 */

import type { GeneratedStoryChoice, GeneratedStoryLine } from "./story-generation.ts";

export type StoryLength = "short" | "long" | "epic";

export type StoryLengthPlan = {
  /** Total messages the saga targets. */
  targetLines: [number, number];
  /** Maximum Groq passes (opening + continuations + finale). */
  passes: number;
  /** Planned chapters and per-chapter message budget. */
  chapters: number;
  chapterLines: [number, number];
  /** Completion tokens per pass. */
  tokens: number;
  /** Honest UI copy: long sagas take minutes. */
  eta: string;
};

export const STORY_LENGTH_PLANS: Record<StoryLength, StoryLengthPlan> = {
  short: {
    targetLines: [15, 30],
    passes: 1,
    chapters: 1,
    chapterLines: [8, 12],
    tokens: 8192,
    eta: "about 30 seconds",
  },
  long: {
    targetLines: [200, 350],
    passes: 5,
    chapters: 5,
    chapterLines: [50, 80],
    tokens: 8192,
    eta: "a few minutes",
  },
  epic: {
    targetLines: [1000, 2000],
    passes: 11,
    chapters: 10,
    chapterLines: [100, 200],
    tokens: 8192,
    eta: "several minutes",
  },
};

export type StoryChunk = {
  lines: GeneratedStoryLine[];
  chapter: string;
};

export type SagaBranch = {
  label: string;
  label_en: string;
  reply_body: string;
  reply_body_en: string;
  lines: GeneratedStoryLine[];
};

/**
 * Appends one generated chunk to the saga, shifting every local idx /
 * next_idx onto the global index space. Chapters keep their own names so the
 * player can stage 1k+ messages as scenes.
 */
export function appendStoryChunk(
  existing: GeneratedStoryLine[],
  chunk: StoryChunk,
): GeneratedStoryLine[] {
  const base = existing.length === 0 ? 1 : Math.max(...existing.map((line) => line.idx)) + 1;
  const localToGlobal = new Map<number, number>();
  chunk.lines.forEach((line, position) => {
    const local = Number.isInteger(line.idx) ? line.idx : position;
    if (!localToGlobal.has(local)) localToGlobal.set(local, base + localToGlobal.size);
  });
  const shifted = chunk.lines.map((line, position) => {
    const local = Number.isInteger(line.idx) ? line.idx : position;
    const idx = localToGlobal.get(local) ?? base + position;
    const rawNext = line.next_idx;
    const next_idx =
      typeof rawNext === "number" && localToGlobal.has(rawNext)
        ? (localToGlobal.get(rawNext) ?? null)
        : null;
    return { ...line, idx, chapter: line.chapter?.trim() || chunk.chapter, next_idx };
  });
  // Chain the saga: previous tail flows into the new chapter head.
  const merged = [...existing];
  if (merged.length > 0 && shifted.length > 0) {
    const tail = merged[merged.length - 1];
    if (tail.next_idx == null) merged[merged.length - 1] = { ...tail, next_idx: shifted[0].idx };
  }
  for (let i = 0; i < shifted.length; i += 1) {
    if (shifted[i].next_idx == null && i + 1 < shifted.length) {
      shifted[i] = { ...shifted[i], next_idx: shifted[i + 1].idx };
    }
    merged.push(shifted[i]);
  }
  return merged;
}

/**
 * Builds the finale: the last main line becomes the choice point and each
 * branch is appended in its own index lane with goto links. Pure so the
 * client can assemble 1k-line sagas without another model call. `laneBase`
 * keeps ending lanes above every existing index when completing long stories.
 */
export function assembleSagaFinale(
  main: GeneratedStoryLine[],
  branches: SagaBranch[],
  laneBase = 100_000,
): { lines: GeneratedStoryLine[]; choices: GeneratedStoryChoice[] } {
  if (main.length === 0 || branches.length === 0) return { lines: main, choices: [] };
  const lines = main.map((line) => ({ ...line }));
  lines[lines.length - 1] = { ...lines[lines.length - 1], next_idx: null };
  const choicePoint = lines[lines.length - 1].idx;
  const choices: GeneratedStoryChoice[] = [];
  branches.forEach((branch, position) => {
    const lane = (position + 1) * laneBase;
    const start = choicePoint + lane;
    branch.lines.forEach((line, i) => {
      lines.push({
        ...line,
        idx: start + i,
        next_idx: i + 1 < branch.lines.length ? start + i + 1 : null,
      });
    });
    choices.push({
      at_idx: choicePoint,
      position,
      label: branch.label.trim() || `Ending ${position + 1}`,
      label_en: branch.label_en.trim() || branch.label.trim() || `Ending ${position + 1}`,
      reply_body: branch.reply_body.trim() || "...",
      reply_body_en: branch.reply_body_en.trim() || branch.reply_body.trim() || "...",
      goto_idx: start,
    });
  });
  return { lines, choices };
}

/** Compact rolling context for the next continuation pass (bounded size). */
export function buildChapterContext(lines: GeneratedStoryLine[], maxTail = 12): string {
  const tail = lines.slice(-maxTail);
  const chapters = [...new Set(lines.map((line) => line.chapter?.trim() || "chapter"))];
  const recap = tail
    .map((line) => `${line.speaker}: ${(line.body_en || line.body).slice(0, 140)}`)
    .join("\n");
  return `Chapters so far: ${chapters.join(" | ")}.\nLast lines:\n${recap}`;
}

/**
 * Completes an existing story: inserts new chapter lines into the main spine
 * just before its finale and moves the choice point to the new tail.
 *
 * - With existing choices, the old choice point becomes a regular beat: the
 *   old tail links into the new chapters, the new tail becomes the choice
 *   point (`at_idx` moves), and every `goto_idx` lane is untouched.
 * - Without choices, the terminal line links into the new chapters; the
 *   caller adds a finale afterwards.
 * - New indexes land above every existing index, so branches never collide.
 * Pure: the offline continuer script and tests share it.
 */
export function insertChaptersBeforeFinale(
  lines: GeneratedStoryLine[],
  choices: GeneratedStoryChoice[],
  newLines: GeneratedStoryLine[],
  chapter: string,
): { lines: GeneratedStoryLine[]; choices: GeneratedStoryChoice[] } {
  if (lines.length === 0 || newLines.length === 0) return { lines, choices };
  const maxIdx = Math.max(...lines.map((line) => line.idx));
  const base = maxIdx + 1000;
  const shifted = newLines.map((line, i) => ({
    ...line,
    idx: base + i,
    chapter: line.chapter?.trim() || chapter,
    next_idx: i + 1 < newLines.length ? base + i + 1 : null,
  }));
  const merged = lines.map((line) => ({ ...line }));
  const byIdx = new Map(merged.map((line) => [line.idx, line]));

  if (choices.length > 0) {
    const choicePoint = Math.min(...choices.map((choice) => choice.at_idx));
    const tail = byIdx.get(choicePoint);
    if (!tail) return { lines, choices };
    tail.next_idx = shifted[0].idx;
    const newTailIdx = shifted[shifted.length - 1].idx;
    return {
      lines: [...merged, ...shifted],
      choices: choices.map((choice) =>
        choice.at_idx === choicePoint ? { ...choice, at_idx: newTailIdx } : choice,
      ),
    };
  }

  const terminals = merged.filter((line) => line.next_idx == null);
  const tail = terminals.length > 0 ? terminals[terminals.length - 1] : merged[merged.length - 1];
  tail.next_idx = shifted[0].idx;
  return { lines: [...merged, ...shifted], choices };
}
