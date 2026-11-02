/**
 * The RIZZ cat pack — the nine stickers shipped in `public/emoji/rizz/`.
 *
 * They travel as shortcodes (`:cat_happy:`), so the same sticker renders in a
 * post reaction, a comment, a Reel, a message and a super reaction without a
 * round trip. `CatEmoji`, `renderTextWithCatEmoji` and `AnimatedEmoji` all
 * resolve through this manifest.
 *
 * The twelve faces of the old drawn pack are gone for good; their shortcodes
 * stay as aliases so badges, games, statuses and old messages keep rendering —
 * they now draw the closest sticker from this pack instead of vanishing.
 */

export type CatEmojiName =
  | "cat_happy"
  | "cat_cry"
  | "cat_achoo"
  | "cat_sleepy"
  | "cat_tired"
  | "cat_angry"
  | "cat_surprise"
  | "cat_clap"
  | "cat_hm"
  // Legacy names from the retired drawn pack. They still resolve to a sticker
  // so stored icons (`:cat_gg:`) and old code paths never break.
  | "cat_love"
  | "cat_cool"
  | "cat_sleep"
  | "cat_lol"
  | "cat_wow"
  | "cat_sus"
  | "cat_music"
  | "cat_hype"
  | "cat_gg"
  | "cat_sad"
  | "cat_wave"
  | "cat_think";

export type CatEmojiEntry = {
  shortcode: string;
  name: CatEmojiName;
  label: string;
  tags: string[];
  /** Served from /public — the sticker itself, not a drawing. */
  src: string;
};

/** The pack itself, in the order the picker shows it. */
export const CAT_EMOJI_MANIFEST: CatEmojiEntry[] = [
  {
    shortcode: ":cat_happy:",
    name: "cat_happy",
    label: "Cat happy",
    tags: ["happy", "smile", "joy", "love", "wave", "gg", "hi"],
    src: "/emoji/rizz/101448-002-cathappy.png",
  },
  {
    shortcode: ":cat_cry:",
    name: "cat_cry",
    label: "Cat crying",
    tags: ["cry", "sad", "tear", "sorry"],
    src: "/emoji/rizz/231129-002-catcry.png",
  },
  {
    shortcode: ":cat_achoo:",
    name: "cat_achoo",
    label: "Cat achoo",
    tags: ["achoo", "sneeze", "sick", "bless you"],
    src: "/emoji/rizz/261171-002-catachu.png",
  },
  {
    shortcode: ":cat_sleepy:",
    name: "cat_sleepy",
    label: "Cat sleepy",
    tags: ["sleep", "tired", "zzz", "goodnight"],
    src: "/emoji/rizz/311127-002-catsleepy.png",
  },
  {
    shortcode: ":cat_tired:",
    name: "cat_tired",
    label: "Cat tired",
    tags: ["tired", "exhausted", "phew", "done"],
    src: "/emoji/rizz/360487-002-cattried.png",
  },
  {
    shortcode: ":cat_angry:",
    name: "cat_angry",
    label: "Cat angry",
    tags: ["angry", "mad", "fire", "hype", "rage"],
    src: "/emoji/rizz/671657-002-catangry.png",
  },
  {
    shortcode: ":cat_surprise:",
    name: "cat_surprise",
    label: "Cat surprised",
    tags: ["wow", "surprised", "omg", "shock", "no way"],
    src: "/emoji/rizz/825154-002-catsurprise.png",
  },
  {
    shortcode: ":cat_clap:",
    name: "cat_clap",
    label: "Cat clapping",
    tags: ["clap", "applause", "celebrate", "gg", "nice"],
    src: "/emoji/rizz/839601-002-catclap.png",
  },
  {
    shortcode: ":cat_hm:",
    name: "cat_hm",
    label: "Cat thinking",
    tags: ["think", "hm", "hmm", "sus", "cool", "music", "vibe"],
    src: "/emoji/rizz/873539-002-cathm.png",
  },
];

/** Old shortcodes → the sticker that replaced them. */
const LEGACY_SHORTCODE_ALIAS: Record<string, CatEmojiName> = {
  ":cat_love:": "cat_happy",
  ":cat_cool:": "cat_hm",
  ":cat_sleep:": "cat_sleepy",
  ":cat_lol:": "cat_happy",
  ":cat_wow:": "cat_surprise",
  ":cat_sus:": "cat_hm",
  ":cat_music:": "cat_hm",
  ":cat_hype:": "cat_angry",
  ":cat_gg:": "cat_clap",
  ":cat_sad:": "cat_cry",
  ":cat_wave:": "cat_happy",
  ":cat_think:": "cat_hm",
};

/** Old component names → the sticker that replaced them. */
const LEGACY_NAME_ALIAS: Record<string, CatEmojiName> = {
  cat_love: "cat_happy",
  cat_cool: "cat_hm",
  cat_sleep: "cat_sleepy",
  cat_lol: "cat_happy",
  cat_wow: "cat_surprise",
  cat_sus: "cat_hm",
  cat_music: "cat_hm",
  cat_hype: "cat_angry",
  cat_gg: "cat_clap",
  cat_sad: "cat_cry",
  cat_wave: "cat_happy",
  cat_think: "cat_hm",
};

export const CAT_NAME_BY_SHORTCODE: Record<string, CatEmojiName> = {
  ...Object.fromEntries(CAT_EMOJI_MANIFEST.map((entry) => [entry.shortcode, entry.name])),
  ...LEGACY_SHORTCODE_ALIAS,
};

/** Every shortcode that still renders — the pack plus the legacy aliases. */
export const CAT_SHORTCODES = new Set(Object.keys(CAT_NAME_BY_SHORTCODE));

/** The pack's own shortcodes, in picker order (legacy aliases excluded). */
export const RIZZ_PACK_SHORTCODES = new Set(
  CAT_EMOJI_MANIFEST.map((entry) => entry.shortcode),
);

export function isCatShortcode(text: string): boolean {
  return CAT_SHORTCODES.has(text);
}

export function catNameForShortcode(shortcode: string): CatEmojiName | null {
  return CAT_NAME_BY_SHORTCODE[shortcode] ?? null;
}

/** The PNG behind a face — legacy names resolve through their alias. */
export function catImageForName(name: CatEmojiName | string): string {
  const resolved = LEGACY_NAME_ALIAS[name] ?? name;
  const entry = CAT_EMOJI_MANIFEST.find((face) => face.name === resolved);
  return entry?.src ?? CAT_EMOJI_MANIFEST[0].src;
}
