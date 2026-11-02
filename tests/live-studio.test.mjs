/**
 * Live Studio guards.
 *
 * The live entry point is now a real pre-live setup, and the room itself has an
 * audience dock. These tests keep the parts that make it feel like a live app:
 * every sharing mode, the sound bed, the request flow, the stage, and the
 * promise that the room's choices survive in the room's topic.
 *
 * Run: node tests/live-studio.test.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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

const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");

const studio = read("components/live/LiveStudioSheet.tsx");
const launch = read("components/live/LiveLaunchButton.tsx");
const shell = read("components/AppShell.tsx");
const settings = read("lib/live-studio.ts");
const provider = read("components/voice/VoiceCallProvider.tsx");
const room = read("components/live/useLiveRoom.ts");
const dock = read("components/live/LiveAudienceDock.tsx");
const callView = read("components/voice/VoiceCallView.tsx");
const ambience = read("components/live/LiveAmbience.tsx");
const styles = read("styles.css");

await check("the Live entry point was rebuilt, not just tinted", () => {
  assert.ok(shell.includes("<LiveLaunchButton variant=\"sidebar\""), "sidebar uses the new control");
  assert.ok(shell.includes("<LiveLaunchButton variant=\"mobile\""), "phone FAB uses it too");
  assert.ok(!shell.includes("<Radio className=\"h-5 w-5\" /> Go live"), "old sidebar button is gone");
  assert.match(launch, /live-fab__halo/, "the phone button has a halo");
  assert.match(launch, /live-dot/, "the on-air dot is shared");
  assert.match(launch, /Camera · screen · live chat/, "the button explains the new room");
  assert.match(styles, /\.live-dot[\s\S]*?live-dot-pulse/);
  assert.match(styles, /prefers-reduced-motion: reduce[\s\S]*?\.live-dot/);
});

await check("pre-live offers camera, screen and both", () => {
  assert.ok(studio.includes("LIVE_MODE_OPTIONS"), "the mode cards come from one list");
  assert.match(settings, /id: "camera"[\s\S]*?id: "screen"[\s\S]*?id: "both"/);
  assert.ok(studio.includes("Camera stays opt-in") || studio.includes("Camera stays off"));
  assert.match(studio, /Check camera/, "there is a real camera test");
  assert.match(studio, /getUserMedia\(\{/, "the test opens the camera");
  assert.match(studio, /Start screen live/, "screen mode has its own CTA");
  assert.match(studio, /Start camera \+ screen/, "both mode has its own CTA");
});

await check("who can watch, chat and request are chosen before going live", () => {
  assert.match(studio, /Anyone with the link/, "room visibility is explained");
  assert.match(studio, /Join requests/, "requests can be turned off");
  assert.match(studio, /Who can type/, "chat scope is explained");
  assert.ok(studio.includes('label: "Everyone"'), "everyone can chat");
  assert.ok(studio.includes('label: "Stage only"'), "or only the stage can chat");
  assert.match(studio, /Mic starts muted/, "the host starts with privacy");
  assert.match(studio, /startLiveRoom\(title, settings\)/, "the choices are sent to the room");
});

await check("background sound is a real shared bed", () => {
  assert.match(settings, /id: "night"[\s\S]*?id: "soft"[\s\S]*?id: "hype"/);
  assert.match(studio, /Background sound/, "the pre-live card is labelled");
  assert.match(studio, /Plays on every device/);
  assert.match(ambience, /createOscillator/, "the bed is synthesized");
  assert.match(ambience, /window\.addEventListener\("pointerdown", resume/, "autoplay is unlocked by a gesture");
  assert.match(callView, /<LiveAmbience bed=\{liveRoom\.settings\.soundBed\}/);
  assert.match(dock, /Mute the sound bed|Turn sound bed back on/);
});

await check("room choices survive in the topic, and change live", () => {
  assert.ok(settings.includes('LIVE_TOPIC_PREFIX = "rizz-live:v1:"'));
  assert.ok(settings.includes("parseLiveSettings"));
  assert.match(provider, /topic: encodeLiveSettings\(liveSettings\)/);
  assert.match(provider, /liveSettings: parseLiveSettings\(room\.topic\)/);
  assert.match(provider, /updateLiveSettings/);
  assert.match(provider, /row\?\.topic !== undefined/);
  assert.match(provider, /setCall\(\(current\)[\s\S]*?liveSettings: next/);
});

await check("the live room has audience chat and a real stage", () => {
  assert.match(room, /supabase\.channel\(`live-room-\$\{roomId\}`/);
  for (const event of ["chat", "request", "approve", "decline", "stage", "hello"]) {
    assert.ok(room.includes(`event: "${event}"`), `the broadcast handles ${event}`);
  }
  assert.match(room, /updateParticipant\(roomId, user\.id, \{ hand_raised: true \}\)/);
  assert.match(room, /stageRef\.current/, "the host broadcasts the stage list");
  assert.match(room, /canChat:/, "chat scope is enforced");
  assert.match(callView, /stageParticipants = isLive/, "audience is not rendered as stage tiles");
  assert.match(callView, /LiveAudienceDock live=\{liveRoom\}/);
  assert.match(callView, /<LiveAudienceDock live=\{liveRoom\} variant="mobile"/);
});

await check("wanna come live is a styled request with a note", () => {
  assert.match(dock, /Wanna come on live\?/);
  assert.match(dock, /Send the ask/);
  assert.match(dock, /QUICK_ASKS/);
  assert.match(dock, /event\.target\.value\.slice\(0, 140\)/, "the note is bounded");
  assert.match(dock, /Bring on/, "the host accepts");
  assert.match(dock, /Not yet/, "the host can decline");
  assert.match(dock, /Requests on|Requests off/, "the host can close requests");
  assert.match(dock, /Mute yourself|Unmute yourself/, "the host can mute from the dock");
});

await check("live is not the realm bot surface", () => {
  assert.match(callView, /!isLive && <GameSessionsBar/);
  assert.match(callView, /!isLive && musicBot\.enabled/);
  assert.match(callView, /!isLive && !gameHidden/);
  assert.match(callView, /Screen live is ready/);
  assert.match(callView, /Pick a screen/);
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
