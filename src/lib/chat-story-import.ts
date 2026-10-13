/**
 * Author "Import story JSON" support.
 *
 * The importer accepts the documented author schema
 *   { id, title, hook, language, characters:[{id,name,role,voice_profile,
 *     bubble_color}], chapters:[{id,title,scenes:[{id,time_label,narration,
 *     image_url,audio_url,messages:[{character_id,type,text,emotion,delay_ms}],
 *     choice?}]}]}
 * and the flat `GeneratedStory` shape the app already saves, then converts
 * everything into the flat `GeneratedStory` the writer path uses.
 *
 * The conversion is pure (no network, no Supabase) so it can be unit tested;
 * the caller saves the result with `saveGeneratedStoryToSupabase`, which inserts
 * through the author's own session so the existing RLS policies apply.
 */
import type { GeneratedStory, GeneratedStoryChoice, GeneratedStoryLine, StoryCategory, StoryVideoType } from "./story-generation";

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
  if (!title) throw new StoryImportError("This file has no title. Add a \"title\" field and try again.");

  const category = asCategory(text(raw.category) || text(raw.genre));
  const characters = Array.isArray(raw.characters) ? raw.characters : [];
  const speakers = buildSpeakerMap(characters);
  const themName = characters.find((character) => speakers.get(text(character.id)) === "them")?.name?.trim() || "Them";
  const meName = characters.find((character) => speakers.get(text(character.id)) === "me")?.name?.trim() || "Me";

  // Flat `lines`/`choices` files are already in the stored shape: pass through.
  if (Array.isArray(raw.lines) && raw.lines.length > 0 && !Array.isArray(raw.chapters)) {
    const lines = (raw.lines as GeneratedStoryLine[]).map((line): GeneratedStoryLine => ({
      idx: Number(line.idx) || 0,
      speaker: line.speaker === "me" || line.speaker === "them" ? line.speaker : "narrator",
      body: text((line as { body?: string }).body),
      body_en: text((line as { body_en?: string }).body_en) || text((line as { body?: string }).body),
      chapter: text((line as { chapter?: string }).chapter) || "Chapter 1",
      next_idx: typeof line.next_idx === "number" ? line.next_idx : null,
    }));
    if (lines.some((line) => !line.body)) {
      throw new StoryImportError("Some lines are missing their text (\"body\").");
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
    throw new StoryImportError("This file has no chapters. A story needs at least one chapter with scenes.");
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
        lines.push({
          idx: lines.length,
          speaker: speakerFor(text(message.character_id)),
          body,
          body_en: text(message.text_en) || body,
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
    throw new StoryImportError("No readable messages were found. Each scene needs narration or messages with text.");
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
function buildSpeakerMap(characters: AuthorStoryCharacter[]): Map<string, GeneratedStoryLine["speaker"]> {
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
    .filter((choice): choice is GeneratedStoryChoice => Boolean(choice && typeof choice === "object"))
    .map((choice, index) => ({
      at_idx: Number(choice.at_idx) || 0,
      position: Number(choice.position) || index + 1,
      label: text(choice.label) || "Continue",
      label_en: text(choice.label_en) || text(choice.label) || "Continue",
      reply_body: text(choice.reply_body) || text(choice.label) || "Continue",
      reply_body_en: text(choice.reply_body_en) || text(choice.reply_body) || text(choice.label) || "Continue",
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
