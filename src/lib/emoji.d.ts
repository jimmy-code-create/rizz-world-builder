export type CustomEmojiName =
  | "music"
  | "gaming"
  | "memes"
  | "study"
  | "art"
  | "chill"
  | "sports"
  | "ideas"
  | "movies"
  | "chatting";

export const CUSTOM_EMOJI: Record<
  CustomEmojiName,
  { file: string; fallback: string; label: string }
>;
export const TUTORIAL_INTERESTS: ReadonlyArray<{
  id: string;
  emoji: CustomEmojiName;
}>;
