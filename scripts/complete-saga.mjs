/**
 * Offline saga continuer: completes any story to 1k–2k messages.
 *
 * The app cannot rewrite other people's database rows, so completing an
 * existing story works like this: export it, extend it here, re-upload the
 * result through the app's Upload flow (flat story JSON is accepted). The
 * original stays untouched; the completed copy is a new story.
 *
 *   export lines JSON: [{speaker, body, body_en?, chapter?}] + meta, or use --room4b
 *   GROQ_API_KEY=... node scripts/complete-saga.mjs --room4b --target 1000 --out room4b-1k.json
 *   GROQ_API_KEY=... node scripts/complete-saga.mjs --in story.json --target 2000 --out story-2k.json
 *
 * Same chapter protocol as in-app Epic generation (one Groq pass per
 * chapter, finale with choice endings). New chapters are inserted before the
 * existing finale and every goto lane is preserved. The key stays in the
 * environment — never printed, never written to the output file.
 */
import { readFileSync, writeFileSync } from "node:fs";
import {
  assembleSagaFinale,
  buildChapterContext,
  insertChaptersBeforeFinale,
} from "../src/lib/story-length.ts";
import {
  buildContinuationPrompt,
  buildFinalePrompt,
  parseChunkLines,
  parseFinaleBranches,
  stripCodeFences,
} from "../src/lib/story-prompt.ts";
import { sanitizeSpeakerName } from "../src/lib/voice-cast.ts";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

function usage() {
  console.log("Usage:");
  console.log(
    "  GROQ_API_KEY=... node scripts/complete-saga.mjs --room4b --target 1000 --out room4b-1k.json",
  );
  console.log(
    "  GROQ_API_KEY=... node scripts/complete-saga.mjs --in story.json --target 2000 --out story-2k.json [--language hi|en] [--chapter-lines 120]",
  );
  process.exit(1);
}

function text(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function cleanLine(row, index) {
  const body = text(row.body, text(row.body_en));
  if (!body) return null;
  return {
    idx: Number.isInteger(row.idx) ? row.idx : index,
    speaker: sanitizeSpeakerName(row.speaker),
    body,
    body_en: text(row.body_en, body),
    chapter: text(row.chapter, "chapter") || "chapter",
    next_idx: Number.isInteger(row.next_idx) ? row.next_idx : null,
  };
}

async function room4bStory() {
  const story = await import("../src/components/chatstory/room4b-story.ts");
  const lines = story.ROOM_4B_LINES.map(cleanLine).filter(Boolean);
  return {
    title: story.ROOM_4B_TITLE.hi,
    hook: story.ROOM_4B_HOOK.hi,
    emoji: "🚪",
    category: "horror",
    them_name: "Asha",
    me_name: "me",
    video_type: "horror_hallway",
    lines,
    choices: story.ROOM_4B_CHOICES.map((choice) => ({ ...choice })),
  };
}

async function callGroq(apiKey, model, system, user, tokens) {
  const payload = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.8,
    max_completion_tokens: tokens,
    response_format: { type: "json_object" },
  };
  if (model.includes("gpt-oss")) payload.reasoning_effort = "low";
  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error(`Groq pass failed with status ${response.status}`);
  const completion = await response.json();
  const content = completion.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Groq returned no text");
  return JSON.parse(stripCodeFences(content));
}

const args = process.argv.slice(2);
const get = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : null;
};

const apiKey = (process.env.GROQ_API_KEY ?? "").trim();
if (!apiKey) {
  console.error("Set GROQ_API_KEY in the environment (same key the app uses for generation).");
  process.exit(1);
}
const model = (process.env.GROQ_MODEL ?? "").trim() || "openai/gpt-oss-120b";
const target = Math.min(
  2000,
  Math.max(100, Number.parseInt(get("--target") ?? "1000", 10) || 1000),
);
const chapterBudget = Math.min(
  200,
  Math.max(40, Number.parseInt(get("--chapter-lines") ?? "120", 10) || 120),
);
const outPath = get("--out");
if (!outPath) usage();

let story;
if (args.includes("--room4b")) {
  story = await room4bStory();
} else {
  const inPath = get("--in");
  if (!inPath) usage();
  const raw = JSON.parse(readFileSync(inPath, "utf8"));
  story = {
    title: text(raw.title, "Untitled"),
    hook: text(raw.hook, ""),
    emoji: text(raw.emoji, "✨"),
    category: text(raw.category, "horror"),
    them_name: text(raw.them_name, "Friend"),
    me_name: text(raw.me_name, "You"),
    video_type: text(raw.video_type, "cozy_room"),
    lines: (Array.isArray(raw.lines) ? raw.lines : []).map(cleanLine).filter(Boolean),
    choices: Array.isArray(raw.choices) ? raw.choices : [],
  };
}
if (story.lines.length === 0) {
  console.error("No usable lines found in the input story.");
  process.exit(1);
}
const devanagari = story.lines.some((line) => /[\u0900-\u097F]/.test(line.body));
const language =
  get("--language") === "en" || get("--language") === "hi"
    ? get("--language")
    : devanagari
      ? "hi"
      : "en";
const input = {
  prompt: `${story.title}: ${story.hook}`.slice(0, 500),
  category: story.category,
  language,
};

const chapters = [...new Set(story.lines.map((line) => line.chapter))];
const outline = [
  ...chapters,
  ...Array.from({ length: 12 }, (_, i) => `Continued chapter ${chapters.length + i + 1}`),
].slice(0, 14);
let lines = story.lines.map((line) => ({ ...line }));
let chapterNumber = chapters.length + 1;
let passes = 0;

const savePartial = (suffix) => {
  const partial = outPath.replace(/\.json$/i, "") + suffix;
  writeFileSync(partial, `${JSON.stringify({ ...story, lines }, null, 2)}\n`);
  console.error(`Saved partial progress to ${partial}`);
};

try {
  while (lines.length < target && passes < 20) {
    passes += 1;
    const { system, user } = buildContinuationPrompt(
      input,
      chapterNumber,
      chapterNumber + 6,
      [chapterBudget - 20, chapterBudget],
      outline,
      buildChapterContext(lines),
    );
    console.error(
      `Pass ${passes}: chapter-${chapterNumber} (${lines.length}/${target} lines so far)…`,
    );
    const raw = await callGroq(apiKey, model, system, user, 8192);
    const chunk = parseChunkLines(raw.lines, `chapter-${chapterNumber}`, chapterBudget + 20);
    if (chunk.length === 0) throw new Error("Model returned no lines; re-run to continue.");
    ({ lines } = insertChaptersBeforeFinale(
      lines,
      story.choices,
      chunk,
      `chapter-${chapterNumber}`,
    ));
    chapterNumber += 1;
  }

  let choices = story.choices.map((choice) => ({ ...choice }));
  if (choices.length === 0) {
    console.error(`Finale pass (${lines.length} lines)…`);
    const { system, user } = buildFinalePrompt(input, buildChapterContext(lines));
    const raw = await callGroq(apiKey, model, system, user, 8192);
    const branches = parseFinaleBranches(raw);
    if (branches.length === 0) throw new Error("Model returned no endings; re-run to finish.");
    const maxIdx = Math.max(...lines.map((line) => line.idx));
    ({ lines, choices } = assembleSagaFinale(lines, branches, maxIdx + 10_000));
  }

  const completed = { ...story, lines, choices };
  writeFileSync(outPath, `${JSON.stringify(completed, null, 2)}\n`);
  console.error(`Done: ${lines.length} lines, ${choices.length} choices -> ${outPath}`);
  console.error("Upload it via Chat Stories > Upload story (flat JSON is accepted).");
} catch (error) {
  savePartial(".partial.json");
  console.error(`Stopped: ${error.message}`);
  process.exit(1);
}
