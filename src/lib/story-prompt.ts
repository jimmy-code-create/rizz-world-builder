/**
 * Pure prompt builders and chunk parsers for AI story generation.
 *
 * Split out of `story-generation.ts` (which imports server-only modules) so
 * tests can assert on prompts and parsing with mocked model output — no Groq
 * key, no network.
 */

import { STORY_CAST, sanitizeSpeakerName } from "./voice-cast.ts";
import type { SagaBranch } from "./story-length.ts";
import type { GeneratedStoryLine, StoryGenerationInput } from "./story-generation.ts";

function storyText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The speaking cast every generated story must use. */
export function buildCastDirections(): string {
  const members = STORY_CAST.map((member) => `${member.label_en} (${member.role})`).join("; ");
  return [
    `Use this speaking cast: ${members}.`,
    "The narrator is always a man and only sets the scene in one sentence per line.",
    "Speaker values are character display names such as me, them, narrator, Dada, Dadi, Chintu, Dulha, Dulhan.",
    "Every story must speak with at least narrator, me, them, one child, one elder (old man or old woman), and the young married couple whenever the premise allows it.",
  ].join(" ");
}

export function buildShortSystemPrompt(input: StoryGenerationInput): string {
  return [
    "Write an original, vivid branching chat story for the RIZZ app as a text-message conversation.",
    `The selected genre is ${input.category}; keep the story firmly in that genre with real tension, humor or dread.`,
    `Write title and hook in ${input.language === "hi" ? "Hindi" : "English"}.`,
    "For every line, body must be Hindi and body_en must be its natural English translation.",
    "For every choice, label and reply_body must be Hindi; label_en and reply_body_en must be natural English translations.",
    buildCastDirections(),
    "Structure: 8 to 12 opening messages that build the premise with escalating beats and small cliffhangers, then one choice point with exactly 2 or 3 choices.",
    "Each choice starts its own branch of 4 to 8 messages with its own twist, and each branch ends on a strong final line.",
    "Messages should read like real texts: 1-2 sentences, personality, occasional interjections (Hmm, wait—, no no no). Narration lines set the scene in one sentence.",
    "You may sprinkle spoken voice effects so the narration sounds human: [pause], [sigh], [laughs], [gasp], [whisper]...[/whisper]. Use the exact same effect tokens in body and body_en, at most one effect per line.",
    "Use unique integer indexes, next_idx links for linear sequences, and null at the choice point and at every branch ending.",
    "Set each choice's at_idx to the last opening line and goto_idx to the first line of its own branch.",
    "Use a relevant video_type from horror_hallway, cyberpunk_neon, rain_window, or cozy_room.",
    "Return only the JSON matching the provided schema. Do not include markdown.",
  ].join(" ");
}

export function buildOpeningPrompt(
  input: StoryGenerationInput,
  totalChapters: number,
  chapterBudget: [number, number],
): { system: string; user: string } {
  const system = [
    "Write an original, vivid multi-chapter chat saga for the RIZZ app as a text-message conversation.",
    `The selected genre is ${input.category}; keep the saga firmly in that genre.`,
    `Write title, hook, and chapter titles in ${input.language === "hi" ? "Hindi" : "English"}.`,
    "For every line, body must be Hindi and body_en must be its natural English translation.",
    buildCastDirections(),
    `This saga has ${totalChapters} chapters. Now write ONLY chapter 1 with ${chapterBudget[0]} to ${chapterBudget[1]} messages that open the premise with escalating beats and end on a cliffhanger.`,
    "Messages should read like real texts: 1-2 sentences, personality, occasional interjections (Hmm, wait—, no no no). Narration lines set the scene in one sentence.",
    "You may sprinkle spoken voice effects so the narration sounds human: [pause], [sigh], [laughs], [gasp], [whisper]...[/whisper]. Use the exact same effect tokens in body and body_en, at most one effect per line.",
    "Also propose the full saga outline: a title for every chapter.",
    'Return only JSON: {"title","hook","emoji","them_name","me_name","video_type","outline":["Chapter 1 title",...],"lines":[{"speaker","body","body_en"}]}. video_type is one of horror_hallway, cyberpunk_neon, rain_window, cozy_room. Do not include markdown.',
  ].join(" ");
  return {
    system,
    user: `User Premise: "${input.prompt}"\n\nGenerate chapter 1 plus the ${totalChapters}-chapter outline for genre "${input.category}". Output ONLY clean JSON.`,
  };
}

export function buildContinuationPrompt(
  input: StoryGenerationInput,
  chapterIndex: number,
  totalChapters: number,
  chapterBudget: [number, number],
  outline: string[],
  context: string,
): { system: string; user: string } {
  const system = [
    "Continue a multi-chapter chat saga for the RIZZ app as a text-message conversation.",
    `Genre: ${input.category}. Language rule: body is Hindi, body_en is its natural English translation.`,
    buildCastDirections(),
    `Now write ONLY chapter ${chapterIndex} of ${totalChapters} ("${outline[chapterIndex - 1] ?? `Chapter ${chapterIndex}`}") with ${chapterBudget[0]} to ${chapterBudget[1]} messages. Keep every speaking voice in character, escalate the plot, and end the chapter on a mini-cliffhanger.`,
    "Messages read like real texts: 1-2 sentences. Narration lines set the scene in one sentence.",
    'Return only JSON: {"lines":[{"speaker","body","body_en"}]}. Do not include markdown.',
  ].join(" ");
  return {
    system,
    user: `User Premise: "${input.prompt}"\n\nSaga outline:\n${outline.map((title, i) => `${i + 1}. ${title}`).join("\n")}\n\n${context}\n\nWrite chapter ${chapterIndex}. Output ONLY clean JSON.`,
  };
}

export function buildFinalePrompt(
  input: StoryGenerationInput,
  context: string,
): { system: string; user: string } {
  const system = [
    "Write the branching finale of a multi-chapter chat saga for the RIZZ app.",
    `Genre: ${input.category}. Language rule: everything in Hindi with natural English translations (label/label_en, reply_body/reply_body_en, body/body_en).`,
    buildCastDirections(),
    "Offer exactly 2 or 3 choices the reader can make at the saga climax. Each choice starts its own ending branch of 6 to 10 messages with a twist and a strong final line.",
    'Return only JSON: {"branches":[{"label","label_en","reply_body","reply_body_en","lines":[{"speaker","body","body_en"}]}]}. Do not include markdown.',
  ].join(" ");
  return {
    system,
    user: `User Premise: "${input.prompt}"\n\n${context}\n\nWrite the finale. Output ONLY clean JSON.`,
  };
}

/** Cleans one chapter chunk of model lines into saga lines (local order). */
export function parseChunkLines(
  rawLines: unknown,
  chapter: string,
  maxLines: number,
): GeneratedStoryLine[] {
  if (!Array.isArray(rawLines)) return [];
  return rawLines
    .filter(isRecord)
    .slice(0, maxLines)
    .map((line, position) => {
      const body = storyText(line.body, storyText(line.body_en, ""));
      return {
        idx: position,
        speaker: sanitizeSpeakerName(line.speaker),
        body,
        body_en: storyText(line.body_en, body),
        chapter: storyText(line.chapter, chapter) || chapter,
        next_idx: null as number | null,
      };
    })
    .filter((line) => line.body.trim() !== "");
}

/** Cleans the finale payload into ending branches. */
export function parseFinaleBranches(raw: unknown, maxBranches = 3, maxLines = 12): SagaBranch[] {
  if (!isRecord(raw) || !Array.isArray(raw.branches)) return [];
  return raw.branches
    .filter(isRecord)
    .slice(0, maxBranches)
    .map((branch) => ({
      label: storyText(branch.label, storyText(branch.label_en, "Ending")),
      label_en: storyText(branch.label_en, storyText(branch.label, "Ending")),
      reply_body: storyText(branch.reply_body, storyText(branch.reply_body_en, "...")),
      reply_body_en: storyText(branch.reply_body_en, storyText(branch.reply_body, "...")),
      lines: parseChunkLines(branch.lines, "finale", maxLines),
    }))
    .filter((branch) => branch.lines.length > 0);
}

export function stripCodeFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}
