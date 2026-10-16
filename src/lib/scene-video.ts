/**
 * Per-scene video workflow for chat stories (frontend-safe, offline-first).
 *
 * There is no zero-cost way to generate video inside this deployment (every
 * open-weight clip needs ~8 GB VRAM CUDA time), so generation happens
 * OFFLINE on an author's own machine and only finished `.mp4` files ship
 * with the app. This module is the honest middle:
 *
 * - Offline authoring: `buildSceneBrief` turns each scene's own text into a
 *   manhwa-style generation brief with a stable scene ID. Nothing leaves the
 *   machine — briefs are built locally from text the author already has.
 * - Playback: `sceneClipPath` resolves the committed clip for any story via
 *   the `public/videos/<slug>/<scene>.mp4` convention. Missing clips fall
 *   back to posters; nothing is generated at read time, ever.
 *
 * Pure module (no DOM, no network, no keys) shared by the player, the
 * authoring script, and tests.
 */

import { STORY_CAST } from "./voice-cast.ts";

export const SCENE_VIDEO_LIMITS = {
  /** Per-scene clip budget: short and loopable. */
  maxSeconds: 6,
  /** Cap so sagas cannot explode into hundreds of clips. */
  maxScenes: 12,
  resolution: "1280x720",
  fps: 24,
  format: "mp4 (H.264)",
} as const;

/** Shared art direction so every scene of a story looks like one manhwa. */
export const ART_DIRECTION_BIBLE =
  "polished realistic Korean manhwa art style, cinematic lighting, clean linework, " +
  "expressive but coherent characters, same faces, clothing and setting across scenes, " +
  "16:9 cinematic framing, subtle ambient motion, loopable shot";

/** What must never appear in a clip: dialogue stays in the app UI. */
export const NEGATIVE_PROMPT =
  "captions, subtitles, on-screen text, speech bubbles, watermark, logo, " +
  "blurry, jittery, distorted faces, extra limbs, morphing";

const EFFECT_TOKEN_RE = /\[(pause(?::\d+)?|sigh|laughs?|gasp|exhale|whisper)\]|\[\/whisper\]/gi;
const URL_RE = /https?:\/\/\S+|www\.\S+/gi;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/gi;

/**
 * Filename-safe scene id. Stable for the same chapter name, so a re-exported
 * story reuses its clips instead of regenerating them.
 */
export function slugifySceneId(chapter: unknown): string {
  const slug = String(chapter ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\p{Script=Devanagari}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "scene";
}

export function slugifyStorySlug(slug: unknown): string {
  const clean = String(slug ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return clean || "story";
}

/** Committed-clip convention: `public/videos/<slug>/<scene>.mp4`. */
export function sceneClipPath(storySlug: string, sceneId: string): string {
  return `/videos/${slugifyStorySlug(storySlug)}/${slugifySceneId(sceneId)}.mp4`;
}

export type SceneLine = {
  speaker: string;
  body: string;
  body_en?: string;
  chapter?: string | null;
};

/** Groups reader lines by chapter id, preserving encounter order. */
export function groupLinesByScene(
  lines: SceneLine[],
): Array<{ sceneId: string; lines: SceneLine[] }> {
  const order: string[] = [];
  const groups = new Map<string, SceneLine[]>();
  for (const line of lines) {
    const sceneId = slugifySceneId(line.chapter ?? "scene");
    if (!groups.has(sceneId)) {
      groups.set(sceneId, []);
      order.push(sceneId);
    }
    groups.get(sceneId)?.push(line);
  }
  return order.map((sceneId) => ({ sceneId, lines: groups.get(sceneId) ?? [] }));
}

/**
 * Local-only text scrub for briefs: strips speech-effect tokens, markdown,
 * links and emails, collapses whitespace, caps length. Private story text is
 * never sent anywhere — this only prepares the author's own prompt.
 */
export function sanitizeBriefText(raw: string, maxChars = 600): string {
  return raw
    .replace(EFFECT_TOKEN_RE, " ")
    .replace(/[*_~`#]+/g, "")
    .replace(URL_RE, " ")
    .replace(EMAIL_RE, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxChars);
}

const MOOD_RULES: Array<{ mood: string; re: RegExp }> = [
  {
    mood: "dreadful horror night",
    re: /bhoot|ghost|horror|dar|khoon|murder|dead|dark|raat|midnight|lift|elevator|knock|भूत|डर|खून|मौत|अंधेरा|रात|दरवाज़ा|चीख|लिफ़्ट|मंज़िल/i,
  },
  {
    mood: "tender romance",
    re: /pyaar|love|date|dulha|dulhan|bride|groom|wedding|shaadi|crush|प्यार|शादी|दूल्हा|दुल्हन/i,
  },
  {
    mood: "chaotic comedy",
    re: /funny|haha|party|college|dean|laugh|awkward|spoon|meme|मज़ाक|हँसी|पार्टी/i,
  },
  {
    mood: "tense confrontation",
    re: /shout|fight|argument|threat|police|chor|stole|lie|truth|चोर|झूठ|सच|लड़ाई/i,
  },
];

export function detectSceneMood(text: string): string {
  for (const { mood, re } of MOOD_RULES) {
    if (re.test(text)) return mood;
  }
  return "quiet emotional drama";
}

export type SceneBrief = {
  sceneId: string;
  label: string;
  setting: string;
  characters: string[];
  mood: string;
  prompt: string;
  negativePrompt: string;
  durationSec: number;
};

/**
 * Builds one generation brief from a scene's own lines: narrator lines give
 * the setting, speakers give the cast, mood comes from the text. The cast
 * bible keeps faces and clothing consistent across the story's scenes.
 */
export function buildSceneBrief(input: {
  sceneId: string;
  label?: string;
  lines: SceneLine[];
  language?: "hi" | "en";
}): SceneBrief {
  const sceneId = slugifySceneId(input.sceneId);
  const language = input.language === "en" ? "en" : "hi";
  const pick = (line: SceneLine) =>
    language === "en" ? line.body_en?.trim() || line.body : line.body;
  const settingRaw = input.lines
    .filter((line) => line.speaker.trim().toLowerCase() === "narrator")
    .map(pick)
    .join(" ");
  const actionRaw = input.lines
    .filter((line) => line.speaker.trim().toLowerCase() !== "narrator")
    .map(pick)
    .join(" ");
  const characters = [
    ...new Set(input.lines.map((line) => line.speaker.trim()).filter(Boolean)),
  ].slice(0, 6);
  const mood = detectSceneMood(`${settingRaw} ${actionRaw}`);
  const setting =
    sanitizeBriefText(settingRaw, 300) || sanitizeBriefText(input.label ?? sceneId, 120);
  const action = sanitizeBriefText(actionRaw, 300);
  const cast = STORY_CAST.map((member) => `${member.label_en} (${member.role})`).join("; ");
  const prompt =
    `${ART_DIRECTION_BIBLE}. Scene: ${setting}. ` +
    (action ? `Happening: ${action}. ` : "") +
    (characters.length > 0 ? `On screen: ${characters.join(", ")}. ` : "") +
    `Mood: ${mood}. Cast bible (keep consistent): ${cast}. ` +
    `No dialogue text on screen.`;
  return {
    sceneId,
    label: (input.label ?? sceneId).trim() || sceneId,
    setting,
    characters,
    mood,
    prompt: prompt.slice(0, 1200),
    negativePrompt: NEGATIVE_PROMPT,
    durationSec: SCENE_VIDEO_LIMITS.maxSeconds,
  };
}

/**
 * Player-side matching: the clip for the active scene, or null when the
 * author has not committed one (poster fallback). `failedIds` caches scenes
 * whose clip 404'd this session so readers never refetch missing files.
 */
export function resolveSceneClip(input: {
  storySlug?: string | null;
  sceneId?: string | null;
  explicitClip?: string | null;
  failedIds?: ReadonlySet<string>;
}): string | null {
  if (input.explicitClip) return input.explicitClip;
  if (!input.storySlug || !input.sceneId) return null;
  const sceneId = slugifySceneId(input.sceneId);
  if (input.failedIds?.has(sceneId)) return null;
  return sceneClipPath(input.storySlug, sceneId);
}
