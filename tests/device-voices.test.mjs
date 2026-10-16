/**
 * Device-voice tests: men get men's voices when the device ships them, and
 * pitch compensation keeps the cast distinct on female-only devices.
 * Pure logic only — no browser, no network.
 * Run: node tests/device-voices.test.mjs
 */
import assert from "node:assert/strict";
import {
  looksFemale,
  looksMale,
  pickDeviceVoice,
  speechPitchForVoice,
} from "../src/lib/voice-selection.ts";

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

const V = (name, lang) => ({ name, lang });
const FULL_HI = [
  V("Microsoft Swara - Hindi (India)", "hi-IN"),
  V("Microsoft Madhur - Hindi (India)", "hi-IN"),
  V("Google हिन्दी", "hi"),
];
const FEMALE_ONLY_HI = [
  V("Microsoft Swara - Hindi (India)", "hi-IN"),
  V("Lekha", "hi-IN"),
  V("Google हिन्दी", "hi"),
];

await check("male characters get the male Hindi voice", async () => {
  const narrator = pickDeviceVoice(FULL_HI, {
    language: "hi",
    gender: "male",
    seed: 0,
    preferNames: ["Microsoft Madhur", "Microsoft Hemant"],
  });
  assert.ok(narrator && looksMale(narrator.name) && !looksFemale(narrator.name), narrator?.name);
  const kabir = pickDeviceVoice(FULL_HI, {
    language: "hi",
    gender: "male",
    seed: 3,
    preferNames: ["Microsoft Madhur"],
  });
  assert.ok(kabir && looksMale(kabir.name), kabir?.name);
});

await check("female characters get the female Hindi voice", async () => {
  const asha = pickDeviceVoice(FULL_HI, {
    language: "hi",
    gender: "female",
    seed: 2,
    preferNames: ["Microsoft Swara"],
  });
  assert.ok(asha && looksFemale(asha.name), asha?.name);
});

await check("Google voices never win when better options exist", async () => {
  for (const gender of ["male", "female", "neutral"]) {
    const picked = pickDeviceVoice(FULL_HI, { language: "hi", gender, seed: 0 });
    assert.ok(picked && !picked.name.includes("Google"), picked?.name);
  }
});

await check("pitch drops for men stuck with a female voice", async () => {
  const compensated = speechPitchForVoice({
    profilePitch: 0.72,
    effectPitch: 0,
    gender: "male",
    voiceName: "Lekha",
  });
  assert.ok(compensated < 0.72, String(compensated));
  const normal = speechPitchForVoice({
    profilePitch: 0.72,
    effectPitch: 0,
    gender: "male",
    voiceName: "Microsoft Madhur",
  });
  assert.equal(normal, 0.72);
  const lifted = speechPitchForVoice({
    profilePitch: 1.1,
    effectPitch: 0,
    gender: "female",
    voiceName: "Microsoft David",
  });
  assert.ok(lifted > 1.1, String(lifted));
  const neutral = speechPitchForVoice({
    profilePitch: 1.0,
    effectPitch: 0,
    gender: "neutral",
    voiceName: "Lekha",
  });
  assert.equal(neutral, 1.0);
  const clamped = speechPitchForVoice({
    profilePitch: 0.1,
    effectPitch: 0,
    gender: "male",
    voiceName: "Lekha",
  });
  assert.ok(clamped >= 0, String(clamped));
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
