/**
 * Live on Reels.
 *
 * The Live entry point is a central part of the Reels layout, not a general
 * app action: it must only exist while the Reels route is open. The room also
 * needs to stay a WebRTC room, not a mock sheet, so these checks pin the FAB,
 * the share link, the provider methods and the join route together.
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

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const shell = read("src/components/AppShell.tsx");
const sheet = read("src/components/live/LiveStudioSheet.tsx");
const provider = read("src/components/voice/VoiceCallProvider.tsx");
const route = read("src/routes/_app/live.$roomId.tsx");
const callView = read("src/components/voice/VoiceCallView.tsx");

await check("the mobile Live FAB replaces the composer FAB only on Reels", () => {
  assert.match(shell, /const isReels = path === "\/reels" \|\| path === "\/_app\/reels"/);
  assert.match(
    shell,
    /\{isReels \? \([\s\S]{0,900}aria-label="Go live"[\s\S]{0,900}\) : \([\s\S]{0,500}aria-label="New post"/,
    "the conditional must put Go live in the Reels branch and New post in the else branch",
  );
  assert.match(shell, /if \(!isReels\) setLiveOpen\(false\)/, "leaving Reels closes the sheet");
});

await check("the desktop sidebar gets the same Reels-only entry point", () => {
  assert.match(shell, /\{isReels && \([\s\S]{0,700}Go live/);
  assert.match(shell, /<LiveStudioSheet open=\{liveOpen\} onOpenChange=\{setLiveOpen\}/);
});

await check("the live sheet is a real room flow, not a placeholder", () => {
  assert.match(sheet, /startLiveRoom\(title\)/);
  assert.match(sheet, /joinLiveRoom\(roomId\)/);
  assert.match(sheet, /navigator\.clipboard\.writeText\(roomLink\)/);
  assert.match(sheet, /\/live\/\$\{live\.roomId\}/);
  assert.match(sheet, /Open studio/);
  assert.match(sheet, /End live/);
});

await check("creating a live room uses the existing WebRTC voice-room transport", () => {
  assert.match(provider, /const startLiveRoom = useCallback/);
  assert.match(provider, /const room = await createRoom\(\{/);
  assert.match(provider, /kind: "live"/);
  assert.match(provider, /setViewOpen\(false\)/, "the host sees the invite link before the studio");
  assert.match(provider, /const joinLiveRoom = useCallback/);
  assert.match(provider, /if \(!room \|\| !room\.is_live\)/);
  assert.match(
    provider,
    /current\.kind === "live" \|\| others\.length === 0/,
    "a host leaving a live room ends it even when viewers are present",
  );
});

await check("viewers join as listeners and hosts keep the speaker role", () => {
  assert.match(provider, /isHost \? "speaker" : "listener"/);
  assert.match(provider, /setMuted\(true\)/);
});

await check("a shared /live/:id link joins the room and can reopen the studio", () => {
  assert.match(route, /createFileRoute\("\/_app\/live\/\$roomId"\)/);
  assert.match(route, /joinLiveRoom\(roomId\)/);
  assert.match(route, /Open studio/);
  assert.match(route, /Rejoin/);
});

await check("the studio uses live wording for the header and host leave dialog", () => {
  assert.match(callView, /call\.kind === "live" \? "Live" : "Voice"/);
  assert.match(callView, /call\.kind === "live" \? "End Live\?" : "Leave & End Call\?"/);
});

console.log(`\n${passed} checks passed.`);
