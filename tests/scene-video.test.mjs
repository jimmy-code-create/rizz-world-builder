/**
 * Scene-video tests (no GPU, no network, no keys — pure brief/matching logic).
 * Run: node tests/scene-video.test.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ART_DIRECTION_BIBLE,
  NEGATIVE_PROMPT,
  SCENE_VIDEO_LIMITS,
  buildSceneBrief,
  detectSceneMood,
  groupLinesByScene,
  resolveSceneClip,
  sanitizeBriefText,
  sceneClipPath,
  slugifySceneId,
} from "../src/lib/scene-video.ts";

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

const DEMO_LINES = [
  {
    speaker: "narrator",
    body: "रात के 2:13 बजे। फ़ोन पर अपने ही नंबर से संदेश चमकता है। [pause]",
    body_en: "2:13 AM. A message glows — from your own number.",
    chapter: "scene-1",
  },
  {
    speaker: "me",
    body: "मैंने ये मैसेज नहीं भेजा।",
    body_en: "I didn't send this.",
    chapter: "scene-1",
  },
  { speaker: "Asha", body: "hmm… जवाब मत देना।", body_en: "hmm… don't reply.", chapter: "scene-2" },
];

await check("scene ids are stable and filename-safe", async () => {
  assert.equal(slugifySceneId("scene-1"), "scene-1");
  assert.equal(slugifySceneId("Chapter 1: The Lift!"), "chapter-1-the-lift");
  assert.equal(slugifySceneId(""), "scene");
  assert.equal(slugifySceneId("scene-1"), slugifySceneId("scene-1"));
  assert.equal(sceneClipPath("room-4b", "scene-1"), "/videos/room-4b/scene-1.mp4");
  assert.equal(sceneClipPath("Room 4B!!", "scene-1"), "/videos/room-4b/scene-1.mp4");
});

await check("lines group into scenes in order", async () => {
  const groups = groupLinesByScene(DEMO_LINES);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].sceneId, "scene-1");
  assert.equal(groups[0].lines.length, 2);
  assert.equal(groups[1].lines[0].speaker, "Asha");
});

await check("briefs match their scene and stay safe", async () => {
  const brief = buildSceneBrief({
    sceneId: "scene-1",
    label: "2:13 AM",
    lines: DEMO_LINES.slice(0, 2),
    language: "hi",
  });
  assert.equal(brief.sceneId, "scene-1");
  assert.ok(brief.prompt.includes("2:13"), "setting from narrator line");
  assert.ok(!brief.prompt.includes("[pause]"), "effect tokens stripped");
  assert.ok(brief.prompt.includes("manhwa"), "art direction present");
  assert.ok(brief.prompt.match(/no dialogue|captions/i), "no baked-in text");
  assert.ok(brief.characters.includes("me"));
  assert.equal(brief.negativePrompt, NEGATIVE_PROMPT);
  assert.equal(brief.durationSec, SCENE_VIDEO_LIMITS.maxSeconds);
});

await check("brief text never leaks links or markup", async () => {
  const out = sanitizeBriefText("See https://evil.example/x and me@mail.com [sigh] **bold**", 600);
  assert.ok(
    !out.includes("http") && !out.includes("@") && !out.includes("[sigh]") && !out.includes("**"),
  );
  assert.ok(sanitizeBriefText("हम्म… कौन है?").includes("हम्म"), "interjections preserved");
});

await check("mood follows the scene text", async () => {
  assert.match(detectSceneMood("ghost in the lift, blood"), /horror/i);
  assert.match(detectSceneMood("first date, love"), /romance/i);
  assert.match(detectSceneMood("plain narration"), /drama/i);
});

await check("clip resolution prefers clips, caches misses", async () => {
  assert.equal(
    resolveSceneClip({ storySlug: "room-4b", sceneId: "scene-1", failedIds: new Set() }),
    "/videos/room-4b/scene-1.mp4",
  );
  assert.equal(
    resolveSceneClip({ storySlug: "room-4b", sceneId: "scene-1", failedIds: new Set(["scene-1"]) }),
    null,
  );
  assert.equal(resolveSceneClip({ storySlug: null, sceneId: "scene-1" }), null);
  assert.equal(resolveSceneClip({ storySlug: "s", sceneId: null }), null);
  assert.equal(
    resolveSceneClip({ storySlug: "s", sceneId: "a", explicitClip: "https://cdn.example/a.mp4" }),
    "https://cdn.example/a.mp4",
  );
});

await check("limits stay small and loopable", async () => {
  assert.ok(SCENE_VIDEO_LIMITS.maxSeconds <= 6);
  assert.ok(SCENE_VIDEO_LIMITS.maxScenes <= 12);
  assert.equal(SCENE_VIDEO_LIMITS.resolution, "1280x720");
  assert.ok(ART_DIRECTION_BIBLE.includes("manhwa"));
});

await check("player plays muted inline with poster fallback (static guard)", async () => {
  const playerSrc = readFileSync(
    new URL("../src/components/chatstory/ChatStoryPlayer.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(playerSrc.includes("resolveSceneClip"));
  assert.ok(playerSrc.includes("onError={handleClipError}"));
  assert.ok(playerSrc.includes("prefetch-"));
  assert.ok(playerSrc.includes("visibilitychange"));
  assert.ok(playerSrc.includes("useReducedMotion"));
  const clipAt = playerSrc.indexOf("ref={clipVideoRef}");
  assert.ok(clipAt > 0);
  const clipBlock = playerSrc.slice(clipAt, clipAt + 800);
  assert.ok(
    clipBlock.includes("muted") && clipBlock.includes("playsInline") && clipBlock.includes("loop"),
  );
  assert.ok(!playerSrc.includes("localhost"));
  assert.ok(!/VITE_[A-Z_]*KEY|VITE_[A-Z_]*TOKEN/.test(playerSrc));
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
