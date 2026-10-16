/**
 * Offline scene-brief authoring for chat-story videos.
 *
 * Video generation cannot run in this deployment (every open-weight clip
 * needs ~8 GB VRAM CUDA time), so authors render clips on their own machine
 * and commit finished files to `public/videos/<slug>/<scene>.mp4`. This
 * script turns a story into a reviewable shot-list plus ready-to-paste GPU
 * commands. It never calls any service: everything is local.
 *
 *   node scripts/scene-briefs.mjs --room4b [--out shots.json]
 *   node scripts/scene-briefs.mjs --lines export.json --slug my-story [--out shots.json]
 *
 * --lines JSON shape: [{speaker, body, body_en?, chapter?}] (the same rows
 * the app stores in chat_story_lines). Review/edit the shot-list BEFORE
 * running GPU commands; re-export after changing scene text.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SCENE_VIDEO_LIMITS,
  buildSceneBrief,
  groupLinesByScene,
  sceneClipPath,
  slugifyStorySlug,
} from "../src/lib/scene-video.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function usage() {
  console.log("Usage:");
  console.log("  node scripts/scene-briefs.mjs --room4b [--out shots.json]");
  console.log(
    "  node scripts/scene-briefs.mjs --lines export.json --slug my-story [--out shots.json]",
  );
  process.exit(1);
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

/** Canonical Room 4B scenes (scene-1..4), matching the player exactly. */
async function room4bScenes() {
  const story = await import("../src/components/chatstory/room4b-story.ts");
  const labels = story.ROOM_4B_SCENE_LABELS;
  const byChapter = new Map();
  for (const line of story.ROOM_4B_LINES) {
    const chapter = String(line.chapter ?? "scene");
    if (!byChapter.has(chapter)) byChapter.set(chapter, []);
    byChapter.get(chapter).push({
      speaker: String(line.speaker ?? "narrator"),
      body: String(line.body ?? ""),
      body_en: String(line.body_en ?? line.body ?? ""),
    });
  }
  const groups = ["scene-1", "scene-2", "scene-3", "scene-4"]
    .filter((id) => (byChapter.get(id) ?? []).length > 0)
    .map((id) => ({ sceneId: id, label: labels[id]?.en ?? id, lines: byChapter.get(id) }));
  return { slug: "room-4b", language: "hi", groups };
}

/** room4b.json author schema -> flat scene groups (fallback). */
function room4bJsonScenes() {
  const raw = JSON.parse(readFileSync(join(root, "src/data/room4b.json"), "utf8"));
  const groups = [];
  for (const chapter of raw.chapters ?? []) {
    for (const scene of chapter.scenes ?? []) {
      const lines = [];
      if (text(scene.narration)) {
        lines.push({
          speaker: "narrator",
          body: scene.narration,
          body_en: text(scene.narration_en) || scene.narration,
        });
      }
      for (const message of scene.messages ?? []) {
        if (!text(message.text)) continue;
        const character = (raw.characters ?? []).find(
          (c) => text(c.id) === text(message.character_id),
        );
        lines.push({
          speaker: text(character?.name) || "them",
          body: message.text,
          body_en: text(message.text_en) || message.text,
        });
      }
      if (lines.length > 0) {
        groups.push({
          sceneId: text(scene.id) || text(chapter.title),
          label: text(chapter.title),
          lines,
        });
      }
    }
  }
  return { slug: "room-4b", language: "hi", groups };
}

function linesFileScenes(path, slug) {
  const rows = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(rows)) throw new Error("--lines file must be a JSON array of line rows.");
  return {
    slug: slugifyStorySlug(slug),
    language: "hi",
    groups: groupLinesByScene(
      rows.map((row) => ({
        speaker: text(row.speaker) || "narrator",
        body: text(row.body),
        body_en: text(row.body_en) || text(row.body),
        chapter: text(row.chapter) || "scene",
      })),
    ).map((group) => ({ sceneId: group.sceneId, label: group.sceneId, lines: group.lines })),
  };
}

function gpuCommands(brief, clip) {
  const prompt = brief.prompt.replace(/"/g, "'");
  return {
    wan2_1_1_3b_480p:
      `python generate.py --task t2v-1.3B --size 832*480 --ckpt_dir ./Wan2.1-T2V-1.3B ` +
      `--offload_model True --t5_cpu --sample_shift 8 --sample_guide_scale 6 --prompt "${prompt}"` +
      `  # then: ffmpeg -i wan_out.mp4 -t ${SCENE_VIDEO_LIMITS.maxSeconds} -r ${SCENE_VIDEO_LIMITS.fps} -s 1280x720 -c:v libx264 -pix_fmt yuv420p -movflags +faststart ${clip}`,
    ltx_2b_distilled:
      `python inference.py --prompt "${prompt}" --height 704 --width 1216 --num_frames 145 --seed 0 ` +
      `--pipeline_config configs/ltxv-2b-0.9.8-distilled.yaml` +
      `  # then: ffmpeg -i ltx_out.mp4 -t ${SCENE_VIDEO_LIMITS.maxSeconds} -r ${SCENE_VIDEO_LIMITS.fps} -s 1280x720 -c:v libx264 -pix_fmt yuv420p -movflags +faststart ${clip}`,
    poster: `# poster for slow connections: ffmpeg -y -i ${clip} -vframes 1 public/poster-fallback.jpg`,
  };
}

const args = process.argv.slice(2);
let story;
if (args.includes("--room4b")) {
  try {
    story = await room4bScenes();
  } catch (error) {
    console.error(
      "Canonical Room 4B data unavailable, falling back to room4b.json:",
      error.message,
    );
    story = room4bJsonScenes();
  }
} else {
  const linesIndex = args.indexOf("--lines");
  const slugIndex = args.indexOf("--slug");
  if (linesIndex < 0 || slugIndex < 0 || !args[linesIndex + 1] || !args[slugIndex + 1]) usage();
  story = linesFileScenes(args[linesIndex + 1], args[slugIndex + 1]);
}

const limited = story.groups.slice(0, SCENE_VIDEO_LIMITS.maxScenes);
if (story.groups.length > SCENE_VIDEO_LIMITS.maxScenes) {
  console.error(
    `Note: ${story.groups.length} scenes found; capped at ${SCENE_VIDEO_LIMITS.maxScenes} clips. Split the story or pick hero scenes.`,
  );
}

const shots = limited.map((group) => {
  const brief = buildSceneBrief({
    sceneId: group.sceneId,
    label: group.label,
    lines: group.lines,
    language: story.language,
  });
  const clip = sceneClipPath(story.slug, brief.sceneId);
  return { status: "queued", clip, ...brief, commands: gpuCommands(brief, clip) };
});

const out = {
  slug: story.slug,
  limits: SCENE_VIDEO_LIMITS,
  negativePrompt: shots[0]?.negativePrompt ?? "",
  shots,
  next: [
    "1. Review/edit each brief above (faces, clothing, setting must match across scenes).",
    "2. Run ONE scene's commands locally, watch the clip: coherent characters, no captions/logos, loops cleanly.",
    "3. Render the rest, place files at each shot's clip path under public/, commit.",
    "4. The player picks clips up automatically and falls back to posters when missing.",
  ],
};

const outIndex = args.indexOf("--out");
if (outIndex >= 0 && args[outIndex + 1]) {
  writeFileSync(args[outIndex + 1], `${JSON.stringify(out, null, 2)}\n`);
  console.log(`Wrote ${shots.length} scene briefs to ${args[outIndex + 1]}`);
} else {
  console.log(JSON.stringify(out, null, 2));
}
