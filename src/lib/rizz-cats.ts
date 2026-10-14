/**
 * The RIZZ cat, as a pose catalogue.
 *
 * The mascot is one visual language: a #12101A cat, #C9FF3D inner ears and
 * strokes, #C9FF3D accents. Every pose gets a slot here so the UI asks for a
 * *mood* — "this list is empty", "we couldn't find it", "you're on top" —
 * instead of hard-coding a file path at each call site.
 *
 * Two sources feed the same catalogue:
 *
 * 1. `src` — art that ships with the app in /public (the built-in avatars plus
 *    the peek / box / searching scenes drawn for empty states). Always usable.
 * 2. `cell` — this pose's square in the 4x4 mascot sheet. Drop that sheet at
 *    `public/brand/rizz-cats.png` and set SPRITE_SHEET below: every mood then
 *    renders from the sheet with no other change, and `src` stays as the
 *    fallback for the poses the sheet does not cover.
 *
 * Decorative cats should be rendered with `decorative`, which keeps them out of
 * the accessibility tree — a mood image never replaces the words that carry the
 * meaning.
 */

export type CatMood =
  | "peek"
  | "curious"
  | "cool"
  | "sleepy"
  | "face"
  | "phone"
  | "hearts"
  | "music"
  | "sideeye"
  | "tail"
  | "box"
  | "hug"
  | "party"
  | "royal"
  | "searching"
  | "butterfly";

export type CatPose = {
  /** Art that ships in /public today. */
  src: string;
  /** Column and row of this pose in the mascot sheet. */
  cell: [number, number];
  /** Short human name, used in pickers and for the accessible label. */
  label: string;
};

export const CAT_POSES: Record<CatMood, CatPose> = {
  peek: { src: "/cats/peek.svg", cell: [0, 0], label: "Peeking" },
  curious: { src: "/avatars/cat-2.svg", cell: [1, 0], label: "Curious" },
  cool: { src: "/avatars/cat-3.svg", cell: [2, 0], label: "Too cool" },
  sleepy: { src: "/avatars/cat-6.svg", cell: [3, 0], label: "Sleepy" },
  face: { src: "/avatars/cat-1.svg", cell: [0, 1], label: "Kitten" },
  phone: { src: "/cats/peek.svg", cell: [1, 1], label: "Texting" },
  hearts: { src: "/avatars/cat-1.svg", cell: [2, 1], label: "Heart eyes" },
  music: { src: "/avatars/cat-3.svg", cell: [3, 1], label: "Listening" },
  sideeye: { src: "/avatars/cat-5.svg", cell: [0, 2], label: "Side eye" },
  tail: { src: "/avatars/cat-6.svg", cell: [1, 2], label: "Walking away" },
  box: { src: "/cats/box.svg", cell: [2, 2], label: "Empty box" },
  hug: { src: "/avatars/cat-4.svg", cell: [3, 2], label: "Hugging" },
  party: { src: "/avatars/cat-4.svg", cell: [0, 3], label: "Playful" },
  royal: { src: "/avatars/cat-5.svg", cell: [1, 3], label: "Royal" },
  searching: { src: "/cats/searching.svg", cell: [2, 3], label: "Searching" },
  butterfly: { src: "/avatars/cat-2.svg", cell: [3, 3], label: "Distracted" },
};

/**
 * The 4x4 mascot sheet, or null while the app only has the per-pose art.
 * Point this at something like "/brand/rizz-cats.png" to switch every mood to
 * the sheet — no other change is needed.
 */
export const SPRITE_SHEET: string | null = null;
export const SPRITE_COLUMNS = 4;
export const SPRITE_ROWS = 4;

/** Poses with art drawn specifically for that mood, rather than a reuse. */
export const CAT_SIGNATURE_MOODS: CatMood[] = ["peek", "box", "searching", "sleepy", "royal", "party"];
