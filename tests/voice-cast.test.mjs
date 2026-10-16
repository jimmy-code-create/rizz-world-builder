/**
 * Voice-cast + long-story tests (mocked model output only — no key, no network).
 * Run: node tests/voice-cast.test.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ARCHETYPE_DEVICE_PREFS,
  ARCHETYPE_KOKORO_VOICE,
  ARCHETYPE_PROFILES,
  ARCHETYPE_SERVER_VOICE,
  STORY_CAST,
  detectVoiceArchetype,
  sanitizeSpeakerName,
} from "../src/lib/voice-cast.ts";
import {
  STORY_LENGTH_PLANS,
  appendStoryChunk,
  assembleSagaFinale,
  buildChapterContext,
} from "../src/lib/story-length.ts";
import {
  buildCastDirections,
  buildContinuationPrompt,
  buildFinalePrompt,
  buildOpeningPrompt,
  parseChunkLines,
  parseFinaleBranches,
  stripCodeFences,
} from "../src/lib/story-prompt.ts";

let passed = 0;
async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`FAIL - ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

await check("narrator is a man voice", async () => {
  assert.equal(ARCHETYPE_PROFILES.narrator.gender, "male");
  assert.ok(ARCHETYPE_PROFILES.narrator.pitch < 0.85);
  assert.equal(ARCHETYPE_KOKORO_VOICE.narrator, "bm_george");
  assert.equal(ARCHETYPE_SERVER_VOICE.narrator, "Rohit");
  assert.ok(ARCHETYPE_DEVICE_PREFS.en.narrator[0].match(/guy|ryan|david|daniel/i));
  assert.ok(ARCHETYPE_DEVICE_PREFS.hi.narrator[0].match(/madhur|hemant|prabhat/i));
  assert.equal(detectVoiceArchetype("narrator"), null);
});

await check("each archetype is detected in English", async () => {
  assert.equal(detectVoiceArchetype("Chintu the kid"), "child");
  assert.equal(detectVoiceArchetype("Old Dada"), "oldMan");
  assert.equal(detectVoiceArchetype("Dadi"), "oldWoman");
  assert.equal(detectVoiceArchetype("Dulha"), "youngMan");
  assert.equal(detectVoiceArchetype("the Bride"), "youngWoman");
  assert.equal(detectVoiceArchetype("Uncle"), "adultMan");
  assert.equal(detectVoiceArchetype("Aunty"), "adultWoman");
});

await check("each archetype is detected in Hindi", async () => {
  assert.equal(detectVoiceArchetype("छोटू"), "child");
  assert.equal(detectVoiceArchetype("बूढ़े ताऊ"), "oldMan");
  assert.equal(detectVoiceArchetype("नानी"), "oldWoman");
  assert.equal(detectVoiceArchetype("दूल्हा"), "youngMan");
  assert.equal(detectVoiceArchetype("नई दुल्हन"), "youngWoman");
  assert.equal(detectVoiceArchetype("आदमी"), "adultMan");
  assert.equal(detectVoiceArchetype("औरत"), "adultWoman");
});

await check("specific archetypes win over generic man/woman", async () => {
  assert.equal(detectVoiceArchetype("old man"), "oldMan");
  assert.equal(detectVoiceArchetype("young woman"), "youngWoman");
  assert.equal(detectVoiceArchetype("Mystery Voice"), null);
});

await check("archetype voices are distinct and age-shaped", async () => {
  const kokoro = Object.values(ARCHETYPE_KOKORO_VOICE);
  assert.equal(new Set(kokoro).size, kokoro.length);
  for (const voice of kokoro) assert.match(voice, /^(af|am|bf|bm)_/);
  assert.ok(ARCHETYPE_PROFILES.child.pitch > ARCHETYPE_PROFILES.adultMan.pitch);
  assert.ok(ARCHETYPE_PROFILES.oldMan.rateMultiplier < 0.9);
  assert.ok(ARCHETYPE_PROFILES.oldWoman.rateMultiplier < 0.9);
  assert.equal(ARCHETYPE_PROFILES.oldMan.gender, "male");
  assert.equal(ARCHETYPE_PROFILES.oldWoman.gender, "female");
  assert.equal(ARCHETYPE_SERVER_VOICE.child, "Rani");
  assert.equal(STORY_CAST.length, 8);
});

await check("speaker names are sanitized, never empty", async () => {
  assert.equal(sanitizeSpeakerName(""), "narrator");
  assert.equal(sanitizeSpeakerName("  Dada  "), "Dada");
  assert.equal(sanitizeSpeakerName("x".repeat(100)).length, 40);
  assert.equal(sanitizeSpeakerName(undefined), "narrator");
});

await check("length plans cover 1k-2k epics", async () => {
  assert.deepEqual(STORY_LENGTH_PLANS.short.targetLines, [15, 30]);
  assert.ok(STORY_LENGTH_PLANS.long.targetLines[0] >= 200);
  assert.ok(STORY_LENGTH_PLANS.epic.targetLines[0] >= 1000);
  assert.ok(STORY_LENGTH_PLANS.epic.targetLines[1] <= 2000);
  for (const [name, plan] of Object.entries(STORY_LENGTH_PLANS)) {
    if (plan.passes === 1) continue; // single pass + ending branches cover shorts
    const capacity = plan.passes * plan.chapterLines[1];
    assert.ok(capacity >= plan.targetLines[0], `passes cover target for ${name}`);
  }
});

await check("chunks append with global index continuity", async () => {
  const first = appendStoryChunk([], {
    chapter: "chapter-1",
    lines: [
      {
        idx: 0,
        speaker: "narrator",
        body: "Raat hai.",
        body_en: "It is night.",
        chapter: "",
        next_idx: null,
      },
      { idx: 1, speaker: "Dada", body: "Beta?", body_en: "Child?", chapter: "", next_idx: null },
    ],
  });
  assert.equal(first[0].idx, 1);
  assert.equal(first[0].next_idx, 2);
  assert.equal(first[1].chapter, "chapter-1");
  const second = appendStoryChunk(first, {
    chapter: "chapter-2",
    lines: [
      {
        idx: 0,
        speaker: "Chintu",
        body: "Main aa gaya!",
        body_en: "I came!",
        chapter: "",
        next_idx: null,
      },
    ],
  });
  assert.equal(second.length, 3);
  assert.equal(second[2].idx, 3);
  assert.equal(second[1].next_idx, 3);
  assert.equal(second[2].chapter, "chapter-2");
});

await check("finale assembly links choices to ending lanes", async () => {
  const main = [
    { idx: 1, speaker: "narrator", body: "A.", body_en: "A.", chapter: "c1", next_idx: 2 },
    { idx: 2, speaker: "me", body: "B.", body_en: "B.", chapter: "c1", next_idx: null },
  ];
  const { lines, choices } = assembleSagaFinale(main, [
    {
      label: "L1",
      label_en: "L1",
      reply_body: "R1",
      reply_body_en: "R1",
      lines: [
        { idx: 0, speaker: "them", body: "E1.", body_en: "E1.", chapter: "finale", next_idx: null },
      ],
    },
    {
      label: "L2",
      label_en: "L2",
      reply_body: "R2",
      reply_body_en: "R2",
      lines: [
        {
          idx: 0,
          speaker: "Dadi",
          body: "E2a.",
          body_en: "E2a.",
          chapter: "finale",
          next_idx: null,
        },
        { idx: 1, speaker: "me", body: "E2b.", body_en: "E2b.", chapter: "finale", next_idx: null },
      ],
    },
  ]);
  assert.equal(choices.length, 2);
  assert.ok(choices.every((c) => c.at_idx === 2));
  assert.notEqual(choices[0].goto_idx, choices[1].goto_idx);
  assert.equal(lines[lines.length - 1].next_idx, null);
  const lane1 = lines.filter((l) => l.idx >= choices[0].goto_idx && l.idx < choices[1].goto_idx);
  assert.equal(lane1.length, 1);
  assert.equal(lane1[0].speaker, "them");
});

await check("chapter context stays bounded", async () => {
  const lines = Array.from({ length: 50 }, (_, i) => ({
    idx: i + 1,
    speaker: "me",
    body: `Line ${i} `.repeat(20),
    body_en: "",
    chapter: i < 25 ? "c1" : "c2",
    next_idx: null,
  }));
  const ctx = buildChapterContext(lines);
  assert.ok(ctx.includes("c1") && ctx.includes("c2"));
  assert.ok(ctx.length < 6000);
});

await check("prompts require the full cast and JSON only", async () => {
  const cast = buildCastDirections();
  assert.ok(cast.includes("always a man"));
  assert.ok(cast.match(/child/i) && cast.match(/elder/i) && cast.match(/married couple/));
  const input = { prompt: "Bhootiya haveli", category: "horror", language: "hi" };
  const opening = buildOpeningPrompt(input, 5, [50, 80]);
  assert.ok(opening.system.includes("5 chapters") && opening.system.includes("outline"));
  assert.ok(opening.user.includes("Bhootiya haveli"));
  const cont = buildContinuationPrompt(
    input,
    3,
    5,
    [50, 80],
    ["A", "B", "C", "D", "E"],
    "Chapters so far: A.",
  );
  assert.ok(cont.system.includes("chapter 3 of 5"));
  const finale = buildFinalePrompt(input, "ctx");
  assert.ok(finale.system.includes("2 or 3 choices"));
  for (const p of [opening, cont, finale]) assert.ok(p.system.includes("only JSON"));
});

await check("chunk parsers clean mocked model output", async () => {
  const lines = parseChunkLines(
    [
      { speaker: "  Dada ", body: "  Hmmm…  ", body_en: "" },
      { speaker: "", body: "   ", body_en: "" },
    ],
    "chapter-2",
    80,
  );
  assert.equal(lines.length, 1);
  assert.equal(lines[0].speaker, "Dada");
  assert.ok(lines[0].body.includes("Hmmm"));
  const branches = parseFinaleBranches({
    branches: [
      {
        label: "A",
        label_en: "A",
        reply_body: "R",
        reply_body_en: "R",
        lines: [{ speaker: "me", body: "Go.", body_en: "Go." }],
      },
      { label: "B", label_en: "B", reply_body: "R", reply_body_en: "R", lines: [] },
    ],
  });
  assert.equal(branches.length, 1);
  assert.equal(stripCodeFences('```json\n{"a":1}\n```'), '{"a":1}');
});

await check("player uses the shared cast (static guard)", async () => {
  const playerSrc = readFileSync(
    new URL("../src/components/chatstory/ChatStoryPlayer.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(playerSrc.includes("detectVoiceArchetype"));
  assert.ok(playerSrc.includes("ARCHETYPE_PROFILES.narrator"));
  assert.ok(playerSrc.includes("ARCHETYPE_KOKORO_VOICE"));
  assert.ok(!playerSrc.includes("pitch: 0.78"));
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
