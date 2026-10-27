/**
 * Video load windows.
 *
 * The bug this guards against is quiet and expensive: a `<video>` with no
 * `preload` gets the browser's default, which starts downloading the file the
 * moment the element mounts. Put that element inside a `.map()` — a reels feed,
 * a trending grid, a sticker sheet — and one scroll position pulls a dozen
 * videos at once. On a phone the video you are actually watching then waits
 * behind everything else, which is exactly what "the app is laggy to play"
 * feels like.
 *
 * So: the reels feed decides a load window per slide, and any video that is
 * rendered inside a list has to say how much of itself it is willing to load.
 * Streams (camera/screen shares) are exempt — they carry a live `srcObject`
 * rather than an `src`, so there is no file to fetch.
 *
 * Static guards (no DOM) per repo test convention.
 * Run: node tests/media-load-window.test.mjs
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

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

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (relative) => readFileSync(path.join(root, relative), "utf8");

/** Every .tsx under src, so the sweep below cannot miss a new surface. */
function tsxFiles(dir = path.join(root, "src")) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsxFiles(full));
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/** The text of one `<video … />` element, from its tag to the closing `>`. */
function videoTags(source) {
  const tags = [];
  let index = source.indexOf("<video");
  while (index !== -1) {
    const end = source.indexOf(">", index);
    if (end === -1) break;
    tags.push({ text: source.slice(index, end + 1), at: index });
    index = source.indexOf("<video", end);
  }
  return tags;
}

await check("the reels feed loads one slide, not the whole list", () => {
  const reels = read("src/routes/_app/reels.tsx");

  assert.ok(
    /preload=\{\s*index === activeIndex/.test(reels),
    "the feed no longer decides a per-slide preload window",
  );
  for (const mode of ['"auto"', '"metadata"', '"none"']) {
    assert.ok(reels.includes(mode), `the load window lost its ${mode} case`);
  }
  assert.ok(
    /preload:\s*"auto"\s*\|\s*"metadata"\s*\|\s*"none"/.test(reels),
    "ReelItem no longer types the preload it is handed",
  );
  assert.ok(
    /<video[\s\S]{0,600}?preload=\{preload\}/.test(reels),
    "the reel <video> does not use the window it was given",
  );

  // The window is only honest if the inactive slides are actually stopped:
  // a paused-but-still-preloading video would keep pulling bytes.
  assert.ok(
    /if \(!isActive\) \{\s*video\.pause\(\)/.test(reels),
    "an off-screen reel is no longer paused",
  );
});

await check("trending tiles are thumbnails, not players", () => {
  const explore = read("src/routes/_app/explore.tsx");
  // The trending grid section only: from the posts query being mapped to the
  // end of that grid, so the "Trending tags" chips above it are not in scope.
  const gridStart = explore.indexOf("trending.data.map");
  assert.ok(gridStart > 0, "the trending grid moved or was renamed");
  const trending = explore.slice(gridStart, gridStart + 900);

  assert.ok(
    /<video[\s\S]{0,400}?preload="metadata"/.test(trending),
    "the trending grid downloads whole video files for a static square",
  );
  assert.ok(
    /<video[\s\S]{0,400}?playsInline/.test(trending),
    "trending videos do not declare playsInline",
  );
});

await check("no list renders a video without a load window", () => {
  const offenders = [];
  for (const file of tsxFiles()) {
    const source = readFileSync(file, "utf8");
    for (const tag of videoTags(source)) {
      // A stream has no src to fetch, so preload means nothing to it.
      if (!/\bsrc=/.test(tag.text)) continue;
      const before = source.slice(Math.max(0, tag.at - 700), tag.at);
      const inList = before.includes(".map(");
      if (!inList) continue;
      if (!/preload=/.test(tag.text)) {
        offenders.push(`${path.relative(root, file)}: <video src=…> inside a list with no preload`);
      }
    }
  }
  assert.deepEqual(offenders, [], `videos loaded by the list:\n${offenders.join("\n")}`);
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
