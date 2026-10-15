export type CatEmojiName =
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
};

export const CAT_EMOJI_MANIFEST: CatEmojiEntry[] = [
  { shortcode: ":cat_love:", name: "cat_love", label: "Cat love", tags: ["love", "heart", "like"] },
  { shortcode: ":cat_cool:", name: "cat_cool", label: "Cat cool", tags: ["cool", "sunglasses", "chill"] },
  { shortcode: ":cat_sleep:", name: "cat_sleep", label: "Cat sleep", tags: ["sleep", "tired", "zzz"] },
  { shortcode: ":cat_lol:", name: "cat_lol", label: "Cat lol", tags: ["lol", "laugh", "funny", "haha"] },
  { shortcode: ":cat_wow:", name: "cat_wow", label: "Cat wow", tags: ["wow", "surprised", "omg"] },
  { shortcode: ":cat_sus:", name: "cat_sus", label: "Cat sus", tags: ["sus", "side-eye", "suspicious"] },
  { shortcode: ":cat_music:", name: "cat_music", label: "Cat vibing", tags: ["music", "vibing", "headphones"] },
  { shortcode: ":cat_hype:", name: "cat_hype", label: "Cat hyped", tags: ["hype", "fire", "lit"] },
  { shortcode: ":cat_gg:", name: "cat_gg", label: "Cat GG", tags: ["gg", "crown", "win", "good game"] },
  { shortcode: ":cat_sad:", name: "cat_sad", label: "Cat sad", tags: ["sad", "cry", "tear"] },
  { shortcode: ":cat_wave:", name: "cat_wave", label: "Cat wave", tags: ["wave", "hi", "hello", "brb"] },
  { shortcode: ":cat_think:", name: "cat_think", label: "Cat thinking", tags: ["think", "studying", "hmm"] },
];

export const CAT_SHORTCODES = new Set(CAT_EMOJI_MANIFEST.map((e) => e.shortcode));

export const CAT_NAME_BY_SHORTCODE: Record<string, CatEmojiName> = Object.fromEntries(
  CAT_EMOJI_MANIFEST.map((e) => [e.shortcode, e.name]),
) as Record<string, CatEmojiName>;

export function isCatShortcode(text: string): boolean {
  return CAT_SHORTCODES.has(text);
}

export function catNameForShortcode(shortcode: string): CatEmojiName | null {
  return CAT_NAME_BY_SHORTCODE[shortcode] ?? null;
}
