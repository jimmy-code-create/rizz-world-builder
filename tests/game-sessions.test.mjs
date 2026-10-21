/**
 * Per-user GAME BOT sessions.
 *
 * The old store kept one "channel game", so launching anything replaced it for
 * everybody. These tests lock in the new rules: each host keeps their own
 * session, joining selects another host's session without deleting your own,
 * leaving a joined game does not stop the host, and room codes are shared.
 *
 * Run: node tests/game-sessions.test.mjs
 */
import assert from "node:assert/strict";
import {
  makeSessionId,
  removeSession,
  sessionList,
  setSessionJoinUrl,
  setSessionPaused,
  setSessionRoomCode,
  stopIntent,
  upsertSession,
  viewFor,
} from "../src/lib/game-sessions.ts";

const gameA = {
  id: "krunker",
  name: "Krunker",
  emoji: "🎯",
  icon: "https://krunker.io/favicon.ico",
  cover: "",
  url: "https://krunker.io/",
  players: "1+",
  description: "FPS",
  category: "action",
};
const gameB = {
  ...gameA,
  id: "skribbl",
  name: "Skribbl",
  url: "https://skribbl.io/",
  category: "party",
};

const jimmy = {
  sessionId: "jimmy-1",
  hostId: "jimmy",
  hostName: "Jimmy",
  game: gameA,
  startedAt: 100,
  paused: false,
  roomCode: null,
  joinUrl: null,
};
const bob = {
  sessionId: "bob-1",
  hostId: "bob",
  hostName: "Bob",
  game: gameB,
  startedAt: 200,
  paused: false,
  roomCode: null,
  joinUrl: null,
};

let sessions = {};
sessions = upsertSession(sessions, jimmy);
sessions = upsertSession(sessions, bob);

assert.deepEqual(Object.keys(sessions).sort(), ["bob", "jimmy"]);
assert.equal(sessions.jimmy.game.id, "krunker");
assert.equal(sessions.bob.game.id, "skribbl");
console.log("ok - two people can host different games at the same time");

assert.deepEqual(sessionList(sessions).map((session) => session.hostId), ["bob", "jimmy"]);
console.log("ok - the session strip is newest first");

assert.equal(viewFor(sessions, "jimmy", null).activeGame.id, "krunker");
assert.equal(viewFor(sessions, "bob", null).activeGame.id, "skribbl");
console.log("ok - each client defaults to its own game");

const joined = viewFor(sessions, "bob", "jimmy");
assert.equal(joined.activeGame.id, "krunker");
assert.equal(joined.launchedBy, "jimmy");
assert.equal(joined.hostName, "Jimmy");
assert.equal(sessions.bob.game.id, "skribbl");
console.log("ok - joining Jimmy opens Jimmy's game without deleting Bob's own session");

assert.equal(stopIntent(sessions, "bob", "jimmy").kind, "leave");
assert.deepEqual(stopIntent(sessions, "bob", null), {
  kind: "stop",
  hostId: "bob",
  sessionId: "bob-1",
});
console.log("ok - leaving a joined game does not stop the session I host");

const relaunchedJimmy = {
  ...jimmy,
  sessionId: "jimmy-2",
  game: gameB,
  startedAt: 300,
};
sessions = upsertSession(sessions, relaunchedJimmy);
assert.equal(sessions.bob.game.id, "skribbl");
assert.equal(sessions.jimmy.game.id, "skribbl");
assert.equal(viewFor(sessions, "bob", "jimmy").activeGame.id, "skribbl");
console.log("ok - relaunching replaces only that host's session");

const paused = setSessionPaused(sessions, "jimmy", true);
assert.equal(paused.jimmy.paused, true);
assert.equal(paused.bob.paused, false);
assert.equal(viewFor(paused, "bob", "jimmy").isPaused, true);
console.log("ok - pausing one host's game is visible to its viewers only");

const coded = setSessionRoomCode(paused, "jimmy", "  TEAM 42  ");
assert.equal(coded.jimmy.roomCode, "TEAM 42");
assert.equal(coded.bob.roomCode, null);
console.log("ok - the host can share a room code with joiners");

const linked = setSessionJoinUrl(coded, "jimmy", "https://skribbl.io/?room=TEAM42");
assert.equal(linked.jimmy.joinUrl, "https://skribbl.io/?room=TEAM42");
assert.equal(
  viewFor(linked, "bob", "jimmy").activeGame.url,
  "https://skribbl.io/?room=TEAM42",
  "a joiner should open the host's invite link directly",
);
assert.equal(
  viewFor(linked, "jimmy", "jimmy").activeGame.url,
  gameB.url,
  "the host's own overlay must keep the base game URL",
);
assert.equal(setSessionJoinUrl(linked, "jimmy", "not-a-url").jimmy.joinUrl, null);
console.log("ok - joiners open the host's invite link, while the host keeps their own URL");

const staleEnd = removeSession(coded, "jimmy", "jimmy-1");
assert.equal(staleEnd.jimmy.sessionId, "jimmy-2");
console.log("ok - a delayed end for an old launch cannot remove the new session");

const ended = removeSession(coded, "jimmy", "jimmy-2");
assert.equal(ended.jimmy, undefined);
assert.equal(ended.bob.game.id, "skribbl");
assert.equal(viewFor(ended, "bob", "jimmy").activeGame.id, "skribbl");
console.log("ok - ending Jimmy's game leaves Bob's game untouched and falls back to it");

assert.equal(viewFor(sessions, "bob", "missing-host").activeGame.id, "skribbl");
console.log("ok - a stale join falls back to the client's own game");

assert.notEqual(makeSessionId(), makeSessionId());
console.log("ok - every launch gets a unique session id");

console.log("\nAll game session checks passed.");
