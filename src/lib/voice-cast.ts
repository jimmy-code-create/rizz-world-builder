/**
 * Shared voice cast for chat stories: narrator + a full family of characters.
 *
 * The narrator always speaks with a MAN's voice. Every other seat has its own
 * stable voice (pitch / speed / device-voice preference / Kokoro HD voice /
 * Hindi server voice) so each story can host a man, a woman, a child, an old
 * man, an old woman, an adult, and a young married couple without two
 * characters ever sharing a voice.
 *
 * Pure module (no DOM, no network) so generation prompts, the player, the
 * Hindi server-voice router, and tests all share one definition.
 */

export type VoiceArchetype =
  | "narrator"
  | "child"
  | "oldMan"
  | "oldWoman"
  | "youngMan"
  | "youngWoman"
  | "adultMan"
  | "adultWoman";

export type VoiceGender = "female" | "male" | "neutral";

export type ArchetypeProfile = {
  voiceSlot: number;
  pitch: number;
  rateMultiplier: number;
  volume: number;
  gender: VoiceGender;
};

export const STORY_CAST: Array<{
  id: VoiceArchetype;
  label_en: string;
  label_hi: string;
  role: string;
}> = [
  { id: "narrator", label_en: "Narrator", label_hi: "सूत्रधार", role: "scene-setting man voice" },
  { id: "child", label_en: "Child", label_hi: "बच्चा", role: "a young kid, high bright voice" },
  {
    id: "oldMan",
    label_en: "Old man",
    label_hi: "बूढ़े दादाजी",
    role: "elder man, slow deep voice",
  },
  {
    id: "oldWoman",
    label_en: "Old woman",
    label_hi: "बूढ़ी दादी",
    role: "elder woman, slow warm voice",
  },
  {
    id: "youngMan",
    label_en: "Young husband",
    label_hi: "नया दूल्हा",
    role: "newly married young man",
  },
  {
    id: "youngWoman",
    label_en: "Young wife",
    label_hi: "नई दुल्हन",
    role: "newly married young woman",
  },
  { id: "adultMan", label_en: "Adult man", label_hi: "आदमी", role: "grown man" },
  { id: "adultWoman", label_en: "Adult woman", label_hi: "औरत", role: "grown woman" },
];

/** Specific archetypes first: "old man" contains "man", "young woman" contains "woman". */
const ARCHETYPE_KEYWORDS: Array<{ id: Exclude<VoiceArchetype, "narrator">; re: RegExp }> = [
  {
    id: "child",
    re: /\b(child|kid|bachch[ae]|bacha|chhotu|munna|munni|beta|beti)\b|बच्चा|बच्ची|बच्चे|छोटू|मुन्ना|मुन्नी|बेटा|बेटी/i,
  },
  {
    id: "oldMan",
    re: /\b(old[\s-]?man|grandpa|grandfather|dada|dadu|nana|buddha|tau)\b|दादा|दादू|नाना|बुड्ढा|ताऊ|बूढ़ा/i,
  },
  {
    id: "oldWoman",
    re: /\b(old[\s-]?woman|grandma|grandmother|granny|dadi|nani|budhiya|tai)\b|दादी|नानी|बुढ़िया|ताई/i,
  },
  {
    id: "youngMan",
    re: /\b(dulha|groom|young[\s-]?man|husband|pati)\b|दूल्हा|पति/i,
  },
  {
    id: "youngWoman",
    re: /\b(dulhan|bride|young[\s-]?woman|wife|patni)\b|दुल्हन|पत्नी/i,
  },
  {
    id: "adultMan",
    re: /\b(man|male|adult|father|dad|papa|uncle|brother|mister|son)\b|आदमी|पिता|पापा|चाचा|भाई/i,
  },
  {
    id: "adultWoman",
    re: /\b(woman|female|lady|mother|mom|mummy|aunty|sister|daughter|girl)\b|औरत|महिला|माँ|मम्मी|आंटी|बहन/i,
  },
];

export function detectVoiceArchetype(speaker: string): Exclude<VoiceArchetype, "narrator"> | null {
  const name = speaker.trim();
  if (!name || name.toLowerCase() === "narrator") return null;
  for (const { id, re } of ARCHETYPE_KEYWORDS) {
    if (re.test(name)) return id;
  }
  return null;
}

/** Device-voice character: the narrator is a man, kids are bright, elders slow. */
export const ARCHETYPE_PROFILES: Record<VoiceArchetype, ArchetypeProfile> = {
  narrator: { voiceSlot: 0, pitch: 0.72, rateMultiplier: 0.92, volume: 0.9, gender: "male" },
  child: { voiceSlot: 5, pitch: 1.55, rateMultiplier: 1.12, volume: 1, gender: "neutral" },
  oldMan: { voiceSlot: 6, pitch: 0.58, rateMultiplier: 0.82, volume: 0.95, gender: "male" },
  oldWoman: { voiceSlot: 7, pitch: 1.12, rateMultiplier: 0.84, volume: 0.95, gender: "female" },
  youngMan: { voiceSlot: 8, pitch: 0.88, rateMultiplier: 1.0, volume: 1, gender: "male" },
  youngWoman: { voiceSlot: 9, pitch: 1.3, rateMultiplier: 1.02, volume: 1, gender: "female" },
  adultMan: { voiceSlot: 10, pitch: 0.8, rateMultiplier: 0.95, volume: 1, gender: "male" },
  adultWoman: { voiceSlot: 11, pitch: 1.22, rateMultiplier: 1.0, volume: 1, gender: "female" },
};

/** Preferred device voices per archetype; the narrator leads with men's voices. */
export const ARCHETYPE_DEVICE_PREFS: Record<"hi" | "en", Record<VoiceArchetype, string[]>> = {
  en: {
    narrator: ["Microsoft Guy", "Microsoft Ryan", "Microsoft David", "Daniel", "Alex"],
    child: ["Microsoft Ana", "Microsoft Jenny", "Samantha", "Ava"],
    oldMan: ["Microsoft Guy", "Microsoft David", "Daniel", "Alex"],
    oldWoman: ["Microsoft Sonia", "Microsoft Aria", "Samantha"],
    youngMan: ["Microsoft Andrew", "Microsoft Brian", "Daniel"],
    youngWoman: ["Microsoft Jenny", "Microsoft Aria", "Ava"],
    adultMan: ["Microsoft Guy", "Microsoft Ryan", "Alex"],
    adultWoman: ["Microsoft Aria", "Samantha", "Ava"],
  },
  hi: {
    narrator: ["Microsoft Madhur", "Microsoft Hemant", "Prabhat", "Madhur"],
    child: ["Microsoft Swara", "Lekha", "Neerja"],
    oldMan: ["Microsoft Hemant", "Microsoft Prabhat", "Hemant"],
    oldWoman: ["Microsoft Neerja", "Microsoft Kalpana", "Lekha"],
    youngMan: ["Microsoft Madhur", "Hemant", "Prabhat"],
    youngWoman: ["Microsoft Swara", "Neerja", "Lekha"],
    adultMan: ["Microsoft Madhur", "Hemant", "Prabhat"],
    adultWoman: ["Microsoft Swara", "Lekha", "Neerja"],
  },
};

/** Fixed Kokoro HD voice per archetype; every cast member keeps one voice. */
export const ARCHETYPE_KOKORO_VOICE: Record<VoiceArchetype, string> = {
  narrator: "bm_george",
  child: "am_puck",
  oldMan: "am_onyx",
  oldWoman: "af_sky",
  youngMan: "am_adam",
  youngWoman: "af_nicole",
  adultMan: "bm_daniel",
  adultWoman: "bf_emma",
};

/**
 * Hindi server-voice id per archetype (Indic-Parler Hindi speakers /
 * Chatterbox reference slots). Only four Hindi voices exist, so elders share
 * the family voice; operators can bind distinct reference audio per id for
 * fully distinct Chatterbox cloning.
 */
export const ARCHETYPE_SERVER_VOICE: Record<VoiceArchetype, string> = {
  narrator: "Rohit",
  child: "Rani",
  oldMan: "Rohit",
  oldWoman: "Divya",
  youngMan: "Aman",
  youngWoman: "Rani",
  adultMan: "Rohit",
  adultWoman: "Divya",
};

/** Reader seats keep their own signature voices. */
export const READER_SERVER_VOICES = { me: "Aman", them: "Divya" } as const;

/** Model-facing speaker names must be short plain strings, never empty. */
export function sanitizeSpeakerName(raw: unknown): string {
  const name = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  if (!name) return "narrator";
  return name.slice(0, 40);
}
