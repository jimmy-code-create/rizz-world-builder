/**
 * Author "Import story JSON" support.
 *
 * The importer accepts the documented author schema
 *   { id, title, hook, language, characters:[{id,name,role,voice_profile,
 *     bubble_color}], chapters:[{id,title,scenes:[{id,time_label,narration,
 *     image_url,audio_url,messages:[{character_id,type,text,emotion,delay_ms}],
 *     choice?}]}]}
 * and the flat `GeneratedStory` shape the app already saves, plus plain-text
 * scripts ("Name: message" / *narration* / # chapters) so any story the author
 * has is uploadable. `emotion` and `delay_ms` become voice-effect tokens.
 *
 * The conversion is pure (no network, no Supabase) so it can be unit tested;
 * the caller saves the result with `saveGeneratedStoryToSupabase`, which inserts
 * through the author's own session so the existing RLS policies apply.
 */
import type {
  GeneratedStory,
  GeneratedStoryChoice,
  GeneratedStoryLine,
  StoryCategory,
  StoryVideoType,
} from "./story-generation";
import { effectsForMessage, wrapWithEffects } from "./chat-story-effects";

export type AuthorStoryMessage = {
  character_id?: string;
  type?: string;
  text?: string;
  text_en?: string;
  emotion?: string;
  delay_ms?: number;
};

export type AuthorStoryChoiceOption = {
  label?: string;
  label_en?: string;
  reply?: string;
  reply_en?: string;
  goto?: string;
  goto_scene?: string;
};

export type AuthorStoryScene = {
  id?: string;
  title?: string;
  time_label?: string;
  narration?: string;
  narration_en?: string;
  image_url?: string;
  audio_url?: string;
  messages?: AuthorStoryMessage[];
  choice?: { prompt?: string; prompt_en?: string; options?: AuthorStoryChoiceOption[] } | null;
};

export type AuthorStoryChapter = {
  id?: string;
  title?: string;
  scenes?: AuthorStoryScene[];
};

export type AuthorStoryCharacter = {
  id?: string;
  name?: string;
  role?: string;
  voice_profile?: unknown;
  bubble_color?: string;
};

export type AuthorStoryJson = {
  id?: string;
  title?: string;
  hook?: string;
  language?: string;
  genre?: string;
  category?: string;
  emoji?: string;
  characters?: AuthorStoryCharacter[];
  chapters?: AuthorStoryChapter[];
  lines?: unknown[];
  choices?: unknown[];
};

export class StoryImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoryImportError";
  }
}

const GENRES: StoryCategory[] = ["horror", "funny", "chaos", "cringe"];

function asCategory(value: string | undefined): StoryCategory {
  const lower = (value ?? "").toLowerCase();
  return GENRES.find((genre) => lower.includes(genre)) ?? "chaos";
}

function videoTypeFor(category: StoryCategory): StoryVideoType {
  switch (category) {
    case "horror":
      return "horror_hallway";
    case "funny":
      return "rain_window";
    case "cringe":
      return "cyberpunk_neon";
    default:
      return "cozy_room";
  }
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Converts author JSON into the flat story shape the app stores.
 * Throws StoryImportError with a friendly message when the file is unusable.
 */
export function storyJsonToGeneratedStory(raw: AuthorStoryJson): GeneratedStory {
  const title = text(raw.title) || text(raw.id);
  if (!title)
    throw new StoryImportError('This file has no title. Add a "title" field and try again.');

  const category = asCategory(text(raw.category) || text(raw.genre));
  const characters = Array.isArray(raw.characters) ? raw.characters : [];
  const speakers = buildSpeakerMap(characters);
  const themName =
    characters.find((character) => speakers.get(text(character.id)) === "them")?.name?.trim() ||
    "Them";
  const meName =
    characters.find((character) => speakers.get(text(character.id)) === "me")?.name?.trim() || "Me";

  // Flat `lines`/`choices` files are already in the stored shape: pass through.
  if (Array.isArray(raw.lines) && raw.lines.length > 0 && !Array.isArray(raw.chapters)) {
    const lines = (raw.lines as GeneratedStoryLine[]).map((line): GeneratedStoryLine => ({
      idx: Number(line.idx) || 0,
      speaker: line.speaker === "me" || line.speaker === "them" ? line.speaker : "narrator",
      body: text((line as { body?: string }).body),
      body_en:
        text((line as { body_en?: string }).body_en) || text((line as { body?: string }).body),
      chapter: text((line as { chapter?: string }).chapter) || "Chapter 1",
      next_idx: typeof line.next_idx === "number" ? line.next_idx : null,
    }));
    if (lines.some((line) => !line.body)) {
      throw new StoryImportError('Some lines are missing their text ("body").');
    }
    return {
      title,
      hook: text(raw.hook) || lines.find((line) => line.speaker === "narrator")?.body || title,
      emoji: text(raw.emoji) || "💬",
      category,
      them_name: themName,
      me_name: meName,
      video_type: videoTypeFor(category),
      lines: normalizeNextIdx(lines),
      choices: normalizeChoices(raw.choices),
    };
  }

  const chapters = Array.isArray(raw.chapters) ? raw.chapters : [];
  if (chapters.length === 0) {
    throw new StoryImportError(
      "This file has no chapters. A story needs at least one chapter with scenes.",
    );
  }

  // Speaker resolution comes from the character roles: narrator-role characters
  // narrate, the player speaks as "me", everyone else is the other side ("them").
  // Unknown ids are assigned in encounter order (first voice = them, second =
  // me), which is how a two-person chat story reads when the file names nobody.
  const encountered: string[] = [];
  const speakerFor = (characterId: string | undefined): GeneratedStoryLine["speaker"] => {
    if (!characterId) return "narrator";
    const known = speakers.get(characterId);
    if (known) return known;
    if (!encountered.includes(characterId)) encountered.push(characterId);
    return encountered.indexOf(characterId) === 1 ? "me" : "them";
  };

  const lines: GeneratedStoryLine[] = [];
  const choices: GeneratedStoryChoice[] = [];

  chapters.forEach((chapter, chapterIndex) => {
    const chapterTitle = text(chapter.title) || `Chapter ${chapterIndex + 1}`;
    const scenes = Array.isArray(chapter.scenes) ? chapter.scenes : [];

    scenes.forEach((scene) => {
      const narration = text(scene.narration);
      if (narration) {
        lines.push({
          idx: lines.length,
          speaker: "narrator",
          body: narration,
          body_en: text(scene.narration_en) || narration,
          chapter: chapterTitle,
          next_idx: null,
        });
      }

      const messages = Array.isArray(scene.messages) ? scene.messages : [];
      messages.forEach((message) => {
        const body = text(message.text);
        if (!body) return;
        const effects = effectsForMessage(message.emotion, message.delay_ms);
        const spoken = wrapWithEffects(body, text(message.text_en) || body, effects);
        lines.push({
          idx: lines.length,
          speaker: speakerFor(text(message.character_id)),
          body: spoken.body,
          body_en: spoken.body_en,
          chapter: chapterTitle,
          next_idx: null,
        });
      });

      const options = Array.isArray(scene.choice?.options) ? scene.choice!.options! : [];
      if (options.length > 0) {
        const atIdx = lines.length - 1;
        options.forEach((option, position) => {
          const label = text(option.label) || text(option.reply);
          const gotoSceneId = text(option.goto) || text(option.goto_scene);
          const targetScene = findSceneIndex(chapters, gotoSceneId);
          if (atIdx < 0 || !label || targetScene < 0) return;
          choices.push({
            at_idx: atIdx,
            position: position + 1,
            label,
            label_en: text(option.label_en) || label,
            reply_body: text(option.reply) || label,
            reply_body_en: text(option.reply_en) || text(option.reply) || label,
            goto_idx: targetScene,
          });
        });
      }
    });
  });

  if (lines.length === 0) {
    throw new StoryImportError(
      "No readable messages were found. Each scene needs narration or messages with text.",
    );
  }

  const hook = text(raw.hook) || lines.find((line) => line.speaker === "narrator")?.body || title;

  return {
    title,
    hook,
    emoji: text(raw.emoji) || "💬",
    category,
    them_name: themName,
    me_name: meName,
    video_type: videoTypeFor(category),
    lines: normalizeNextIdx(lines),
    choices,
  };
}

/**
 * Maps every character id to the voice slot the player uses.
 *
 * Roles win: a `narrator` character narrates, a `player`/`me`/`user` character is
 * "me", and the rest are "them". Casts that declare no roles are read in the
 * order a chat opens — the first declared voice is the other person, the second
 * is the player — so generated two-person files import the same way.
 */
function buildSpeakerMap(
  characters: AuthorStoryCharacter[],
): Map<string, GeneratedStoryLine["speaker"]> {
  const map = new Map<string, GeneratedStoryLine["speaker"]>();
  const isNarrator = (character: AuthorStoryCharacter) => {
    const role = text(character.role).toLowerCase();
    return role.includes("narrator") || role.includes("echo");
  };
  const isPlayer = (character: AuthorStoryCharacter) => {
    const role = text(character.role).toLowerCase();
    return role === "player" || role === "me" || role === "user" || role === "protagonist";
  };

  const others = characters.filter((character) => !isNarrator(character));
  const me = others.find(isPlayer) ?? others[1] ?? others[0];

  for (const character of characters) {
    const id = text(character.id);
    if (!id) continue;
    if (isNarrator(character)) map.set(id, "narrator");
    else if (character === me) map.set(id, "me");
    else map.set(id, "them");
  }
  return map;
}

/**
 * Scene index of a scene id, counted in the same linear order the lines are
 * emitted (narration line, then one line per message), so `goto` points at the
 * first line of the target scene.
 */
function findSceneIndex(chapters: AuthorStoryChapter[], sceneId: string): number {
  if (!sceneId) return -1;
  let counter = 0;
  for (const chapter of chapters) {
    for (const scene of chapter.scenes ?? []) {
      if (text(scene.id) === sceneId) return counter;
      if (text(scene.narration)) counter += 1;
      counter += (scene.messages ?? []).filter((message) => text(message.text)).length;
    }
  }
  return -1;
}

/** Chains every line to the next one; the last line ends the story. */
function normalizeNextIdx(lines: GeneratedStoryLine[]): GeneratedStoryLine[] {
  return lines.map((line, index) => ({
    ...line,
    idx: index,
    next_idx: index < lines.length - 1 ? index + 1 : null,
  }));
}

function normalizeChoices(choices: unknown): GeneratedStoryChoice[] {
  if (!Array.isArray(choices)) return [];
  return choices
    .filter((choice): choice is GeneratedStoryChoice =>
      Boolean(choice && typeof choice === "object"),
    )
    .map((choice, index) => ({
      at_idx: Number(choice.at_idx) || 0,
      position: Number(choice.position) || index + 1,
      label: text(choice.label) || "Continue",
      label_en: text(choice.label_en) || text(choice.label) || "Continue",
      reply_body: text(choice.reply_body) || text(choice.label) || "Continue",
      reply_body_en:
        text(choice.reply_body_en) || text(choice.reply_body) || text(choice.label) || "Continue",
      goto_idx: Number(choice.goto_idx) || 0,
    }));
}

/** Parses a JSON file the author picked and converts it, with friendly errors. */
export function parseAuthorStoryFile(contents: string): GeneratedStory {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new StoryImportError("That file is not valid JSON. Export it again and retry.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new StoryImportError("That file does not contain a story object.");
  }
  const candidate = parsed as AuthorStoryJson & { story?: AuthorStoryJson };
  return storyJsonToGeneratedStory(candidate.story ?? candidate);
}

/* ------------------------------------------------------------------------- */
/* Plain-text scripts                                                        */
/* ------------------------------------------------------------------------- */

const ME_ALIASES = new Set(["me", "you", "i", "main", "mai", "मैं", "self", "user", "player"]);
const NARRATOR_ALIASES = new Set([
  "narrator",
  "narration",
  "story",
  "voiceover",
  "voice-over",
  "vo",
  "v.o.",
]);

/**
 * Words at the start of a line that look like `Word: text` but are dialogue,
 * not a speaker name ("Wait: what?"). Long scripts are full of these.
 */
const NOT_SPEAKER_NAMES = new Set([
  "wait", "oh", "hey", "no", "yes", "yeah", "ok", "okay", "well", "so",
  "but", "and", "hmm", "uh", "ah", "wow", "listen", "look", "actually",
  "anyway", "because", "if", "then", "like", "right", "sure", "fine",
  "sorry", "thanks", "huh", "what", "who", "why", "how", "when", "where",
  "note", "warning", "ps", "p.s.",
]); // prettier-ignore

/** "**Asha**" and "_Asha_" are the same speaker as "Asha". */
function cleanSpeakerName(rawName: string): string {
  return rawName
    .trim()
    .replace(/^\*{1,2}(.*)\*{1,2}$/, "$1")
    .replace(/^_{1,2}(.*)_{1,2}$/, "$1")
    .trim();
}

const NEVER_A_FIRST_NAME = new Set([
  "he", "she", "they", "it", "we", "i", "you", "a", "an", "the",
  "someone", "somebody", "nobody", "voice", "phone", "screen", "message",
]); // prettier-ignore

/** "He said: stop it" is dialogue, not a character named "He said". */
function looksLikeSpeakerName(name: string): boolean {
  if (!name) return false;
  if (/[.!?]/.test(name) || /^\d+$/.test(name)) return false;
  if (NOT_SPEAKER_NAMES.has(name.toLowerCase())) return false;
  const words = name.split(/\s+/);
  return words.length === 1 || !NEVER_A_FIRST_NAME.has(words[0].toLowerCase());
}

function seatForName(
  name: string,
  seats: Map<string, GeneratedStoryLine["speaker"]>,
  onNewName: (name: string) => GeneratedStoryLine["speaker"],
): GeneratedStoryLine["speaker"] {
  const key = name.toLowerCase();
  const known = seats.get(key);
  if (known) return known;
  const seat: GeneratedStoryLine["speaker"] = ME_ALIASES.has(key)
    ? "me"
    : NARRATOR_ALIASES.has(key)
      ? "narrator"
      : onNewName(name);
  seats.set(key, seat);
  return seat;
}

/**
 * Plain-text / markdown scripts:
 *
 *   # Story title
 *   *Rain hammers the window.*       <- narration (asterisks, _underscores_ or (parens))
 *   Asha: did you hear that?         <- first name reads as the other person
 *   Kabir: hear what?                <- the second name becomes you ("me")
 *
 *   ---                              <- a blank line starts a new message,
 *   ## The landing                   <- --- and ## open new chapters
 *
 * Messages wrapped over several lines stay one message (long replies are fine).
 */
export function parseStoryText(contents: string): GeneratedStory {
  const source = contents.replace(/\r\n?/g, "\n");
  const lines: GeneratedStoryLine[] = [];
  const seats = new Map<string, GeneratedStoryLine["speaker"]>();
  let title = "";
  let themName = "";
  let currentChapter = "";
  let chapterCounter = 0;
  let unknownNames = 0;

  let pendingSpeaker: GeneratedStoryLine["speaker"] | null = null;
  let pendingText = "";

  const pushLine = (speaker: GeneratedStoryLine["speaker"], body: string) => {
    const cleaned = body.replace(/\s+/g, " ").trim();
    if (!cleaned) return;
    lines.push({
      idx: lines.length,
      speaker,
      body: cleaned,
      body_en: cleaned,
      chapter: currentChapter || "opening",
      next_idx: null,
    });
  };

  const flushPending = () => {
    if (pendingSpeaker != null) pushLine(pendingSpeaker, pendingText);
    pendingSpeaker = null;
    pendingText = "";
  };

  for (const rawLine of source.split("\n")) {
    const line = rawLine.trim();

    if (!line) {
      flushPending();
      continue;
    }

    if (/^[-*_]{3,}$/.test(line)) {
      flushPending();
      chapterCounter += 1;
      currentChapter = `Chapter ${chapterCounter + 1}`;
      continue;
    }

    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (heading) {
      flushPending();
      const headingText = heading[1].trim();
      if (!title && lines.length === 0) title = headingText;
      else {
        chapterCounter += 1;
        currentChapter = headingText || `Chapter ${chapterCounter + 1}`;
      }
      continue;
    }

    const wrapped = /^(?:\*{1,2}([^*]+)\*{1,2}|_{1,2}([^_]+)_{1,2}|\(([^)]+)\))$/.exec(line);
    if (wrapped) {
      flushPending();
      pushLine("narrator", wrapped[1] ?? wrapped[2] ?? wrapped[3] ?? "");
      continue;
    }

    const speakerLine = /^([^:]{1,24}):[ \t]*(.+)$/.exec(line);
    if (speakerLine) {
      const name = cleanSpeakerName(speakerLine[1]);
      const looksLikeSpeaker = !/:\/\//.test(line) && looksLikeSpeakerName(name);
      if (looksLikeSpeaker) {
        flushPending();
        pendingSpeaker = seatForName(name, seats, (newName) => {
          // First unknown name reads as the other person; the second becomes the
          // player, the way a two-person chat script is written — unless a
          // "Me:"-style alias already claimed the player seat. Further names
          // stay on the other side.
          unknownNames += 1;
          if (unknownNames === 1) {
            if (!themName) themName = newName;
            return "them";
          }
          const playerSeatTaken = [...seats.values()].includes("me");
          return unknownNames === 2 && !playerSeatTaken ? "me" : "them";
        });
        pendingText = speakerLine[2].trim();
        continue;
      }
    }

    // A plain line continues the current message (wrapped replies); on its own
    // it narrates.
    if (pendingSpeaker != null) pendingText += ` ${line}`;
    else {
      pendingSpeaker = "narrator";
      pendingText = line;
    }
  }
  flushPending();

  if (lines.length === 0) {
    throw new StoryImportError(
      'No readable messages were found. Use "Name: message" lines, *narration* in asterisks/underscores, or upload the story as JSON.',
    );
  }

  const normalized = normalizeNextIdx(lines);
  const firstNarrator = normalized.find(
    (line) => line.speaker === "narrator" && line.body.trim().length > 20,
  );
  return {
    title: title || normalized[0].body.slice(0, 60),
    hook: firstNarrator?.body.slice(0, 180) ?? normalized[0].body.slice(0, 180),
    emoji: "💬",
    category: "chaos",
    them_name: themName || "Them",
    me_name: "Me",
    video_type: "cozy_room",
    lines: normalized,
    choices: [],
  };
}

/**
 * Single entry point for the upload button: JSON files take the author path,
 * everything else is read as a plain-text script.
 */
export function parseStoryUpload(contents: string): GeneratedStory {
  const trimmed = contents.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return parseAuthorStoryFile(contents);
  return parseStoryText(contents);
}
