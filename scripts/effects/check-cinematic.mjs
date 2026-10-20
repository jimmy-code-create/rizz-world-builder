#!/usr/bin/env node
/**
 * Verify the committed cinematic assets.
 *
 * This checks the properties that matter to the overlay: VP9 video, a real
 * alpha plane, the 1600x480 canvas, a loop-length duration, and a matching
 * 1600x480 poster PNG. It does not need the source reel.
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const DIR = path.resolve("public/effects/cinematic");
const SLUGS = ["web-slinger", "sakura-bloom", "arcane-nexus", "sakura-storm"];
const EXPECTED_WIDTH = 1600;
const EXPECTED_HEIGHT = 480;
const EXPECTED_DURATION_MIN = 9.4;
const EXPECTED_DURATION_MAX = 9.9;

let failed = false;

function fail(slug, message) {
  failed = true;
  console.error(`FAIL ${slug}: ${message}`);
}

function probe(file) {
  const result = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_streams", "-show_format", "-of", "json", file],
    { encoding: "utf8" },
  );
  if (result.status !== 0) throw new Error(result.stderr || `ffprobe failed for ${file}`);
  return JSON.parse(result.stdout);
}

function alphaMode(tags) {
  if (!tags) return null;
  for (const [key, value] of Object.entries(tags)) {
    if (key.toUpperCase() === "ALPHA_MODE") return String(value);
  }
  return null;
}

for (const slug of SLUGS) {
  const video = path.join(DIR, `${slug}.webm`);
  const poster = path.join(DIR, `${slug}.png`);

  if (!fs.existsSync(video)) {
    fail(slug, `missing ${path.relative(process.cwd(), video)}`);
    continue;
  }
  if (!fs.existsSync(poster)) {
    fail(slug, `missing ${path.relative(process.cwd(), poster)}`);
    continue;
  }

  try {
    const data = probe(video);
    const stream = data.streams?.find((item) => item.codec_type === "video");
    if (!stream) {
      fail(slug, "no video stream");
      continue;
    }
    if (stream.codec_name !== "vp9") fail(slug, `codec is ${stream.codec_name}, expected vp9`);
    if (stream.width !== EXPECTED_WIDTH || stream.height !== EXPECTED_HEIGHT) {
      fail(slug, `video is ${stream.width}x${stream.height}, expected ${EXPECTED_WIDTH}x${EXPECTED_HEIGHT}`);
    }
    if (alphaMode(stream.tags) !== "1") {
      fail(slug, "ALPHA_MODE=1 metadata is missing");
    }
    const duration = Number(data.format?.duration);
    if (!(duration >= EXPECTED_DURATION_MIN && duration <= EXPECTED_DURATION_MAX)) {
      fail(slug, `duration ${duration}s outside ${EXPECTED_DURATION_MIN}-${EXPECTED_DURATION_MAX}s`);
    }

    const posterData = probe(poster);
    const posterStream = posterData.streams?.find((item) => item.codec_type === "video");
    if (!posterStream) {
      fail(slug, "poster has no image stream");
    } else {
      if (posterStream.codec_name !== "png") fail(slug, `poster codec is ${posterStream.codec_name}`);
      if (posterStream.width !== EXPECTED_WIDTH || posterStream.height !== EXPECTED_HEIGHT) {
        fail(slug, `poster is ${posterStream.width}x${posterStream.height}`);
      }
      if (posterStream.pix_fmt !== "rgba") fail(slug, `poster pix_fmt is ${posterStream.pix_fmt}, expected rgba`);
    }

    const size = (fs.statSync(video).size / 1024 / 1024).toFixed(2);
    console.log(
      `ok ${slug}: vp9 ${stream.width}x${stream.height} alpha=${alphaMode(stream.tags)} ${duration.toFixed(3)}s ${size} MiB + rgba poster`,
    );
  } catch (error) {
    fail(slug, error.message);
  }
}

if (failed) process.exitCode = 1;
else console.log("cinematic assets verified");
