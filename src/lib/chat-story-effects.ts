/**
 * Speech effects for chat stories.
 *
 * Story text can carry tiny inline tokens. The player strips them for display
 * and turns them into real speech behavior:
 *
 *   [pause]               a silence beat (700 ms by default)
 *   [pause:1200]          a silence beat of that many milliseconds (120–4000)
 *   [sigh] [laughs]       voiced interjections ("Haaah…", "ha ha ha… ha.")
 *   [gasp] [exhale]       voiced interjections, then a short beat
 *   [whisper]…[/whisper]  hushed, slower delivery for the wrapped text
 *
 * Hesitations the author types naturally ("Hmm", "Umm", "Wait—") are stretched
 * and paused for speech so they read like a person, not a machine.
 *
 * Everything here is pure so the player, the generator and the importers all
 * share the same rules.
 */

export type SpeechEffect = "normal" | "whisper" | "sigh" | "laugh" | "gasp" | "exhale";

export type SpeechSegment =
  | { kind: "speech"; text: string; effect: SpeechEffect }
  | { kind: "pause"; ms: number };

export type SpeechEffectPreset = {
  /** Multiplies the narration rate for this segment. */
  rate: number;
  /** Added to the character's pitch (device voices only). */
  pitch: number;
  /** Multiplies the segment volume. */
  volume: number;
  /** A beat of silence after the segment, in ms. */
  trailingPauseMs: number;
};

export const SPEECH_EFFECT_PRESETS: Record<SpeechEffect, SpeechEffectPreset> = {
  normal: { rate: 1, pitch: 0, volume: 1, trailingPauseMs: 140 },
  whisper: { rate: 0.92, pitch: -0.08, volume: 0.55, trailingPauseMs: 300 },
  sigh: { rate: 0.84, pitch: -0.05, volume: 0.85, trailingPauseMs: 440 },
  laugh: { rate: 1.06, pitch: 0.1, volume: 1, trailingPauseMs: 300 },
  gasp: { rate: 1.14, pitch: 0.12, volume: 1, trailingPauseMs: 280 },
  exhale: { rate: 0.86, pitch: -0.04, volume: 0.8, trailingPauseMs: 380 },
};

export const DEFAULT_PAUSE_MS = 700;
const MIN_PAUSE_MS = 120;
const MAX_PAUSE_MS = 4000;

/** What an interjection token becomes when spoken aloud. */
const INTERJECTION_SPEECH: Partial<Record<SpeechEffect, string>> = {
  sigh: "Haaah…",
  laugh: "Ha ha ha… ha.",
  gasp: "Hah—",
  exhale: "Phew…",
};

const TOKEN_RE = /\[(pause|sigh|laughs?|gasp|exhale|whisper)(?::(\d+))?\]|\[\/whisper\]/gi;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export { wait as waitForSpeech };

/**
 * Refines text for a speech engine: strips emoji and markdown, stretches
 * hesitations ("hmm" -> "Hmmm…"), and softens dashes into pauses.
 */
export function normalizeForSpeech(raw: string): string {
  return raw
    .replace(/[*_~`]+/g, "")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, " ")
    .replace(/\bhm+\b/gi, "Hmmm…")
    .replace(/\bum+\b/gi, "Umm…")
    .replace(/\buh+\b/gi, "Uhh…")
    .replace(/\bhaha+\b/gi, "ha ha ha")
    .replace(/\.{3,}/g, "…")
    .replace(/\s*—\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Splits a story body into speech segments: plain text, effect-wrapped text,
 * interjections and silence beats, in the order they should be heard.
 */
export function speechSegmentsForText(raw: string): SpeechSegment[] {
  const segments: SpeechSegment[] = [];
  let currentEffect: SpeechEffect = "normal";
  let buffer = "";
  let last = 0;

  const pushBuffer = () => {
    const text = normalizeForSpeech(buffer);
    if (text) segments.push({ kind: "speech", text, effect: currentEffect });
    buffer = "";
  };

  for (const match of raw.matchAll(TOKEN_RE)) {
    const start = match.index ?? 0;
    buffer += raw.slice(last, start);
    last = start + match[0].length;

    const token = match[1]?.toLowerCase();
    if (!token) {
      // [/whisper] — back to the normal voice.
      pushBuffer();
      currentEffect = "normal";
      continue;
    }
    if (token === "pause") {
      pushBuffer();
      const parsed = match[2] ? Number.parseInt(match[2], 10) : DEFAULT_PAUSE_MS;
      segments.push({ kind: "pause", ms: clamp(Number.isFinite(parsed) ? parsed : DEFAULT_PAUSE_MS, MIN_PAUSE_MS, MAX_PAUSE_MS) });
      continue;
    }
    if (token === "whisper") {
      pushBuffer();
      currentEffect = "whisper";
      continue;
    }

    // Voiced interjections: sigh / laughs / laugh / gasp / exhale.
    const effect: SpeechEffect =
      token === "laugh" || token === "laughs" ? "laugh" : (token as SpeechEffect);
    pushBuffer();
    const spoken = INTERJECTION_SPEECH[effect];
    if (spoken) segments.push({ kind: "speech", text: spoken, effect });
    segments.push({ kind: "pause", ms: SPEECH_EFFECT_PRESETS[effect].trailingPauseMs });
  }

  buffer += raw.slice(last);
  pushBuffer();
  return segments;
}

/**
 * The readable version of a story body: effect tokens removed, everything else
 * (emoji, punctuation) left exactly as the author wrote it.
 */
export function displayText(raw: string): string {
  return raw
    .replace(TOKEN_RE, " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** True when the text carries any effect token (used to hint the UI). */
export function hasSpeechEffects(raw: string): boolean {
  return TOKEN_RE.test(raw);
}

export type MessageEffects = { prefix: string; suffix: string };

/**
 * Maps an imported message's `emotion` / `delay_ms` fields onto effect tokens
 * so uploads that predate the token syntax still get voices.
 */
export function effectsForMessage(emotion: string | undefined, delayMs: number | undefined): MessageEffects {
  const mood = (emotion ?? "").toLowerCase().trim();
  const pause = typeof delayMs === "number" && delayMs >= 700 ? "[pause] " : "";

  if (mood.includes("whisper") || mood.includes("hush")) return { prefix: `${pause}[whisper]`, suffix: "[/whisper]" };
  if (mood.includes("laugh") || mood.includes("giggle")) return { prefix: `${pause}[laughs] `, suffix: "" };
  if (mood.includes("sigh") || mood.includes("sad") || mood.includes("tired") || mood.includes("relieved")) {
    return { prefix: `${pause}[sigh] `, suffix: "" };
  }
  if (mood.includes("gasp") || mood.includes("scared") || mood.includes("shock") || mood.includes("surprised") || mood.includes("fear")) {
    return { prefix: `${pause}[gasp] `, suffix: "" };
  }
  if (mood.includes("exhale") || mood.includes("phew") || mood.includes("calm")) {
    return { prefix: `${pause}[exhale] `, suffix: "" };
  }
  return { prefix: pause, suffix: "" };
}

/** Applies an effects envelope to both language variants of a message. */
export function wrapWithEffects(body: string, bodyEn: string, effects: MessageEffects): { body: string; body_en: string } {
  return {
    body: `${effects.prefix}${body}${effects.suffix}`.trim(),
    body_en: `${effects.prefix}${bodyEn}${effects.suffix}`.trim(),
  };
}
