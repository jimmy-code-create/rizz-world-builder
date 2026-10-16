/**
 * Chat-story narration routing for Hindi / English / Hinglish.
 *
 * Free-first design:
 * - English keeps the existing browser-local Kokoro ONNX path (Apache-2.0,
 *   ~82M params, runs in WebGPU/WASM on the user's device, no token, no
 *   server cost). Kokoro is English-only, so it must never receive Devanagari.
 * - Hindi / Hinglish uses an optional self-hosted backend (Chatterbox
 *   Multilingual, MIT, or Indic-Parler-TTS, Apache-2.0) behind
 *   `/api/chatstory-speech`. When the backend is not configured the player
 *   falls back to the device voice — still free, just less realistic.
 *
 * Neither Chatterbox nor Indic-Parler supports arbitrary inline emotion tags
 * such as `[sigh]` or `[whisper]`. Callers must send the *spoken* segment
 * text (see `speechSegmentsForText` in `chat-story-effects.ts`) and handle
 * pauses / whisper volume client-side (see `sanitizeTextForServerTTS` below).
 */

export type ChatStoryTTSLanguage = "hi" | "en";

export const CHATSTORY_TTS_ENDPOINT = "/api/chatstory-speech";
/** Per-segment server budget: segments are already sentence-sized. */
export const CHATSTORY_TTS_TIMEOUT_MS = 15_000;
export const CHATSTORY_TTS_MAX_CHARS = 500;

const DEVANAGARI_RE = /[\u0900-\u097F]/;
/** Latin-script Hinglish markers. Used only when there is no Devanagari. */
const HINGLISH_HINT_RE =
  /\b(arre|achha|achcha|yaar|kya|kaise|tum|tumhe|main|mein|nahi|nahin|mat|hai|hain|tha|thi|the|wala|wali|karke|chalo|arre|bhai|didi|sharma|ji)\b/i;

/** Effect tokens must never reach the server model verbatim. */
const EFFECT_TOKEN_RE = /\[(pause(?::\d+)?|sigh|laughs?|gasp|exhale|whisper)\]|\[\/whisper\]/gi;

export function containsDevanagari(text: string): boolean {
  return DEVANAGARI_RE.test(text);
}

export function looksLikeHinglishLatin(text: string): boolean {
  return HINGLISH_HINT_RE.test(text);
}

/**
 * Route one speech segment to the model that actually supports it.
 * - Any Devanagari → Hindi (Chatterbox-Multilingual-hi handles code-switched
 *   "Hinglish" with mixed scripts better than English-only Kokoro).
 * - Latin Hinglish inside a Hindi story → Hindi (same reason).
 * - Everything else → the story's selected language.
 */
export function resolveChatStoryTTSLanguage(
  segmentText: string,
  storyLanguage: ChatStoryTTSLanguage,
): ChatStoryTTSLanguage {
  if (containsDevanagari(segmentText)) return "hi";
  if (storyLanguage === "hi" && looksLikeHinglishLatin(segmentText)) return "hi";
  return storyLanguage;
}

function characterHash(value: string): number {
  return [...value.toLowerCase()].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7);
}

export type ChatStoryVoiceGender = "female" | "male" | "neutral";

/**
 * Stable server voice per character. Backends map these ids to real voices:
 * - Indic-Parler-TTS Hindi: Rohit (male) / Divya (female) / Aman (neutral)
 * - Chatterbox-Multilingual-hi: language_id="hi" + this id selects the
 *   reference / cloned voice slot operator-side.
 *
 * Starring seats stay fixed so narration is consistent across lines; unknown
 * speakers hash into a gendered pool so two characters rarely collide.
 */
const CHATSTORY_STARRING_VOICES = {
  narrator: "Rohit",
  me: "Aman",
  them: "Divya",
} as const;

const CHATSTORY_HINDI_POOLS: Record<ChatStoryVoiceGender, string[]> = {
  female: ["Divya", "Rani"],
  male: ["Rohit", "Aman"],
  neutral: ["Aman", "Divya"],
};

export function resolveChatStoryServerVoice(
  speaker: string,
  storyNames: { me_name: string; them_name: string },
  gender: ChatStoryVoiceGender = "neutral",
): string {
  const normalized = speaker.trim().toLowerCase();
  if (normalized === "narrator") return CHATSTORY_STARRING_VOICES.narrator;
  if (normalized === "me" || normalized === storyNames.me_name.trim().toLowerCase()) {
    return CHATSTORY_STARRING_VOICES.me;
  }
  if (normalized === "them" || normalized === storyNames.them_name.trim().toLowerCase()) {
    return CHATSTORY_STARRING_VOICES.them;
  }
  const pool = CHATSTORY_HINDI_POOLS[gender] ?? CHATSTORY_HINDI_POOLS.neutral;
  return pool[characterHash(speaker) % pool.length];
}

/**
 * Sanitize one speech segment for the server model.
 * - Strips `[pause]`, `[sigh]`, `[whisper]`… tags (the model would read them
 *   aloud or hallucinate on them).
 * - Collapses whitespace, keeps ellipsis and interjections intact:
 *   "hmm…", "Hmmm…", "हम्म…" must survive byte-for-byte (modulo case).
 */
export function sanitizeTextForServerTTS(segmentText: string): string {
  return segmentText
    .replace(EFFECT_TOKEN_RE, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, CHATSTORY_TTS_MAX_CHARS);
}

/**
 * Chatterbox exposes `exaggeration` / `cfg_weight` knobs, Indic-Parler uses a
 * natural-language description prompt. Neither accepts inline tags like
 * `[laughs]` or `[gasp]` in the transcript, so this helper documents that and
 * lets callers assert it in tests.
 */
export function supportsInlineEmotionTags(
  _model: "chatterbox" | "indic-parler-tts" = "chatterbox",
): boolean {
  return false;
}

export type ChatStorySpeechPayload = {
  text: string;
  language: ChatStoryTTSLanguage;
  speaker: string;
  voiceId: string;
  speed: number;
};

export function buildChatStorySpeechPayload(input: {
  text: string;
  language: ChatStoryTTSLanguage;
  speaker?: string;
  voiceId?: string;
  speed?: number;
  storyNames?: { me_name: string; them_name: string };
  gender?: ChatStoryVoiceGender;
}): ChatStorySpeechPayload {
  const rawLength = (input.text ?? "").trim().length;
  if (rawLength === 0) throw new Error("Nothing to speak.");
  if (rawLength > CHATSTORY_TTS_MAX_CHARS) {
    throw new Error("Text is too long for one speech request.");
  }
  const text = sanitizeTextForServerTTS(input.text ?? "");
  if (!text) throw new Error("Nothing to speak.");
  const language: ChatStoryTTSLanguage = input.language === "hi" ? "hi" : "en";
  const speaker = (input.speaker ?? "narrator").trim() || "narrator";
  const voiceId =
    (input.voiceId ?? "").trim() ||
    resolveChatStoryServerVoice(
      speaker,
      input.storyNames ?? { me_name: "me", them_name: "them" },
      input.gender ?? "neutral",
    );
  const speed = Math.min(1.5, Math.max(0.6, input.speed ?? 1));
  return { text, language, speaker, voiceId, speed };
}

export function chatStoryTTSCacheKey(payload: ChatStorySpeechPayload): string {
  return `${payload.language}:${payload.voiceId}:${payload.speed.toFixed(2)}:${payload.text}`;
}
