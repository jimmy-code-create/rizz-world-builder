/**
 * Knock Knock — the "are you around?" doorbell.
 *
 * The feature only works if three things stay true together: a heartbeat that
 * makes "app open" measurable, a knock that survives a closed tab, and controls
 * that appear wherever a person's name does. These guards lock all three.
 *
 * Run: node tests/knock.test.mjs
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

const lib = read("src/lib/knock.ts");
const migration = read("supabase/migrations/20261106000000_knock_knock.sql");
const dmRoute = read("src/routes/_app/dm.$userId.tsx");
const shell = read("src/components/AppShell.tsx");
const preview = read("src/components/ProfilePreview.tsx");
const profilePage = read("src/routes/_app/u.$username.tsx");
const doorbell = read("src/components/knock/KnockDoorbell.tsx");
const card = read("src/components/knock/KnockThreadCard.tsx");
const controls = read("src/components/knock/KnockControls.tsx");

await check("an open tab is measurable apart from a closed one", async () => {
  // The heartbeat is the only thing that can tell "app open but away" from
  // "app closed an hour ago"; without it a knock would be guesswork.
  assert.match(migration, /FUNCTION public\.ping_presence\(\)[\s\S]*last_seen_at = v_at/);
  assert.ok(lib.includes("usePresenceHeartbeat"), "the client runs the heartbeat");
  assert.ok(shell.includes("usePresenceHeartbeat(!!user?.id)"), "and runs it app-wide");
  assert.match(lib, /PRESENCE_PING_MS = 2 \* 60_000/);
});

await check("the verdict reads last_seen honestly", async () => {
  assert.ok(
    lib.includes("now - lastSeen <= LIVE_WINDOW_MS"),
    "a stale last_seen must not read as live",
  );
  assert.ok(lib.includes('label: "App closed"'));
  assert.ok(lib.includes('label: "Live now"'));
  assert.ok(lib.includes("Last seen ${relativeLastSeen(row.last_seen_at, now)}"));
  assert.ok(
    lib.includes('detail: "App open, nobody at the keyboard"'),
    "idle with the tab open is 'around, away', not offline",
  );
});

await check("a knock survives a closed tab", async () => {
  assert.ok(migration.includes("CREATE TABLE IF NOT EXISTS public.knocks"));
  assert.ok(migration.includes("FUNCTION public.send_knock("));
  assert.match(migration, /DOORBELL_WINDOW_MS|interval '12 hours'|created_at/);
  assert.ok(
    lib.includes("DOORBELL_WINDOW_MS"),
    "the doorbell looks back far enough to catch a knock sent overnight",
  );
  // The doorbell is mounted once in the shell, so it rings on every screen.
  assert.ok(shell.includes("<KnockDoorbell />"));
  assert.ok(doorbell.includes("useDoorbell()"));
});

await check("knocks live in the conversation, not in a toast", async () => {
  assert.ok(dmRoute.includes("useKnockThread(userId)"));
  assert.ok(dmRoute.includes("knockTimeline.byMessage"), "knocks are placed before their message");
  assert.ok(dmRoute.includes("knockTimeline.trailing"), "a knock newer than every message still shows");
  assert.ok(dmRoute.includes("markKnocksSeen(userId)"), "reading the thread marks the door seen");
  assert.ok(card.includes('"You knocked"') && card.includes("knocked 👋"));
});

await check("the doorbell can be answered like a person would", async () => {
  assert.match(migration, /CHECK \(response IS NULL OR response IN \('come_in', 'later', 'busy'\)\)/);
  assert.ok(migration.includes("FUNCTION public.respond_knock("));
  for (const label of ["Open the door", "Give me a sec", "Busy"]) {
    assert.ok(card.includes(label), `the thread card offers "${label}"`);
    assert.ok(doorbell.includes(label), `the doorbell offers "${label}"`);
  }
});

await check("one knock per door, not a mash button", async () => {
  assert.match(migration, /created_at > now\(\) - interval '30 seconds'/);
  assert.ok(migration.includes("public.blocks"), "blocked connections can't knock");
  assert.ok(migration.includes("knocks_note_length"), "a note rides along, capped");
  assert.ok(lib.includes('RAISE|friendlyKnockError') || lib.includes("friendlyKnockError"));
});

await check("the controls sit wherever a name does", async () => {
  assert.ok(
    dmRoute.includes('aria-label="Live now, tap to knock"'),
    "the DM header carries the live knock mark",
  );
  assert.ok(dmRoute.includes("sendKnock(userId)"), "the live mark knocks without another sheet");
  assert.ok(preview.includes("<KnockButton"), "the profile card has the knock");
  assert.ok(profilePage.includes("<KnockButton"), "and so does the full profile");
  // The subline is status first; the live mark itself is the doorbell.
  assert.match(dmRoute, /peerTyping \?[\s\S]{0,120}typing…/, "typing wins the subline");
  assert.match(dmRoute, /peerOnline \? "Online" : lastSeenLabel/, "then online, then last seen");
  assert.ok(controls.includes("mood.verdict"), "the sheet explains where the knock will land");
  assert.ok(controls.includes("knockSentMessage"), "and the sender learns what happened");
});

await check("the doorbell has its own sound", async () => {
  const sound = read("src/lib/notification-sound.ts");
  assert.ok(sound.includes("export function playKnockSound"));
  assert.ok(doorbell.includes("playKnockSound()"));
  assert.ok(
    sound.includes("shouldStayQuiet()"),
    "the door stays quiet under Do not disturb, like every other sound",
  );
});

console.log(`\n${passed} checks passed.`);
