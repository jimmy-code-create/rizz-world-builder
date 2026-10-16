/**
 * Realistic-first device voice selection.
 *
 * Browser voices range from tin-can to near-human. Edge ships "Online
 * (Natural)" cloud voices, Apple ships "(Enhanced)" / "(Premium)" downloads,
 * and Chrome falls back to Google's lightweight pool. When a realistic voice
 * exists it should always win, and Google's voices should only ever be used
 * as a last resort — never ahead of a better alternative.
 */

export type StoryLanguage = "hi" | "en";
export type VoiceGender = "female" | "male" | "neutral";

/** Exact locale we would rather hear for each story language. */
const EXACT_LOCALE: Record<StoryLanguage, string> = { hi: "hi-in", en: "en-in" };

const FEMININE_NAMES = [
  "samantha", "ava", "zira", "aria", "jenny", "michelle", "sonia", "libby",
  "neerja", "swara", "lekha", "heera", "kalpana", "emma", "karen", "victoria", "cynthia",
]; // prettier-ignore
const MASCULINE_NAMES = [
  "david", "guy", "ryan", "andrew", "brian", "daniel", "alex", "fred",
  "hemant", "madhur", "prabhat", "ravi", "george", "james", "oliver", "thomas",
]; // prettier-ignore

export function looksFemale(name: string): boolean {
  const lower = name.toLowerCase();
  return /female|woman/.test(lower) || FEMININE_NAMES.some((hint) => lower.includes(hint));
}

export function looksMale(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    (/male|man\b/.test(lower) && !/female|woman/.test(lower)) ||
    MASCULINE_NAMES.some((hint) => lower.includes(hint))
  );
}

/**
 * How human a voice sounds. Cloud "Natural" voices rank highest, downloaded
 * Apple voices next, Google's bundled voices last (and below nothing else).
 */
function realismScore(name: string): number {
  const lower = name.toLowerCase();
  if (lower.includes("google")) return -400;
  if (/online\s*\(natural\)/.test(lower)) return 400; // Edge cloud natural
  if (lower.includes("natural")) return 380;
  if (lower.includes("neural")) return 360;
  if (lower.includes("premium")) return 340;
  if (lower.includes("enhanced")) return 320;
  if (lower.includes("siri")) return 300;
  if (lower.includes("online")) return 280; // cloud voice, quality varies
  if (lower.includes("compact")) return -40; // old iOS compressed voices
  if (lower.includes("espeak")) return -60;
  return 0;
}

function genderScore(name: string, gender: VoiceGender): number {
  if (gender === "neutral") return 0;
  const female = looksFemale(name);
  const male = looksMale(name);
  if (gender === "female") return female ? 30 : male ? -30 : 0;
  return male ? 30 : female ? -30 : 0;
}

/**
 * Final speech pitch for a device voice. When the device ships no voice of
 * the character's gender (common: Hindi packs with only a female voice), the
 * pitch shifts down for men / up for women so the cast still sounds distinct.
 * Always clamped to the 0–2 speechSynthesis range.
 */
export function speechPitchForVoice(input: {
  profilePitch: number;
  effectPitch?: number;
  gender: VoiceGender;
  voiceName?: string;
}): number {
  const base = input.profilePitch + (input.effectPitch ?? 0);
  const voiceName = (input.voiceName ?? "").trim();
  if (!voiceName || input.gender === "neutral") return Math.min(2, Math.max(0, base));
  if (input.gender === "male" && looksFemale(voiceName) && !looksMale(voiceName)) {
    return Math.min(2, Math.max(0, base - 0.25));
  }
  if (input.gender === "female" && looksMale(voiceName) && !looksFemale(voiceName)) {
    return Math.min(2, Math.max(0, base + 0.25));
  }
  return Math.min(2, Math.max(0, base));
}

/**
 * Picks the most realistic voice for a story seat. `seed` rotates seats of the
 * same quality so two characters never share the exact same voice when the
 * device has options.
 */
export function pickDeviceVoice(
  voices: SpeechSynthesisVoice[],
  options: { language: StoryLanguage; gender?: VoiceGender; seed?: number; preferNames?: string[] },
): SpeechSynthesisVoice | undefined {
  const { language, gender = "neutral", seed = 0, preferNames = [] } = options;
  const candidates = voices.filter((voice) => voice.lang.toLowerCase().startsWith(language));
  if (candidates.length === 0) return undefined;

  const preferenceScore = (name: string): number => {
    const lower = name.toLowerCase();
    const index = preferNames.findIndex((preferred) => lower.includes(preferred.toLowerCase()));
    return index < 0 ? 0 : 55 - index * 10;
  };

  const exact = EXACT_LOCALE[language];
  const scored = candidates
    .map((voice) => ({
      voice,
      score:
        realismScore(voice.name) +
        genderScore(voice.name, gender) +
        preferenceScore(voice.name) +
        (voice.lang.toLowerCase().startsWith(exact) ? 25 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.voice.name.localeCompare(b.voice.name));

  // Rotate within the best realism tier so every seat gets its own voice
  // instead of every character using the single "best" one.
  const best = scored[0].score;
  const tier = scored.filter((entry) => entry.score >= best - 40);
  return tier[Math.abs(seed) % tier.length].voice;
}
