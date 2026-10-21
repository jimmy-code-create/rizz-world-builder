/**
 * Render test for the per-user games-in-call strip.
 *
 * Verifies that another person's session exposes a direct Join game button,
 * while the viewer's own session shows the host controls instead.
 *
 * Run: bun tests/game-sessions-bar.render.test.tsx
 */
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GameSessionsBar } from "../src/components/voice/GameSessionsBar.tsx";
import type { GameSession } from "../src/lib/game-sessions.ts";

const game = {
  id: "krunker",
  name: "Krunker",
  emoji: "🎯",
  icon: "https://krunker.io/favicon.ico",
  cover: "",
  url: "https://krunker.io/",
  players: "1+",
  description: "FPS",
  category: "action" as const,
};

const jimmy: GameSession = {
  sessionId: "jimmy-1",
  hostId: "jimmy",
  hostName: "Jimmy",
  game,
  startedAt: 100,
  paused: false,
  roomCode: "TEAM42",
  joinUrl: null,
};
const bob: GameSession = {
  ...jimmy,
  sessionId: "bob-1",
  hostId: "bob",
  hostName: "Bob",
  startedAt: 200,
  roomCode: null,
};

const html = renderToStaticMarkup(
  createElement(GameSessionsBar, {
    sessions: [bob, jimmy],
    viewersByHost: { bob: ["bob"], jimmy: ["jimmy", "bob"] },
    meId: "bob",
    viewingHostId: "bob",
    streamingIds: ["jimmy"],
    onOpen: () => {},
    onJoin: () => {},
    onLeave: () => {},
    onStream: () => {},
  }),
);

assert.match(html, /Games in call/);
assert.match(html, /Join game/);
assert.match(html, /Your game/);
assert.match(html, /2/);
assert.match(html, /live/);
console.log("ok - another host's session exposes Join game");
console.log("ok - my own session shows host controls and viewer count");
console.log("ok - a live game stream is labelled on the session card");
