# Games and activities

Two kinds of game live in RIZZ, and both are launched from `/games` (the Games
hub) and from the gamepad button inside a voice call.

| | Built-in (`source: "builtin"`) | Web (`src/data/games.json`) |
|---|---|---|
| Where it runs | In the app, on a canvas | In a sandboxed iframe |
| Sign-up | Never | Whatever the site asks |
| Fullscreen | Yes, and as the call's background | Yes, inside the frame |
| Room sync | The voice channel **is** the room | Room codes / invite links |
| Adding one | Code: `src/lib/builtin-games.ts` + `src/components/games/` | One JSON entry |

## 1. The registry

`src/lib/activities.ts` merges both sources into one `GameEntry[]`:

- `builtinEntries()` reads `BUILTIN_GAMES` from `src/lib/builtin-games.ts`.
- `webEntries()` reads `src/data/games.json`.

`RoomActivity` (what the room sees live) carries `source`, so a URL-less built-in
game never round-trips through an iframe. Live state is ephemeral: one realtime
channel per voice room (`voice-activity-<roomId>`) with start/end broadcasts and
presence, shared by every consumer through a per-room store — two supabase-js
`channel()` calls with the same topic return the same instance, so sharing the
store is what stops the "tried to subscribe multiple times" crash.

## 2. Adding a web game (config only)

```json
{
  "id": "my-game",
  "name": "My Game",
  "icon": ":cat_hype:",
  "url": "https://my-game.example.com",
  "type": "room-link",
  "players": "2-8",
  "description": "One-line pitch shown on the card",
  "roomParam": "room"
}
```

Field notes:

- `id` — unique, lowercase, no spaces.
- `icon` — a cat-emoji shortcode (`":cat_hype:"`) rendered with the app's own cat
  set. A raw emoji glyph still renders, but new entries use shortcodes.
- `url` — must be a real `https://` URL or the surface shows a "no link yet" card
  instead of a broken frame. (`PASTE_…` placeholders never launch.)
- `type` — exactly one of:

  | `type` | When to use | What the launcher does |
  |---|---|---|
  | `"multiplayer-hub"` | A lobby app (e.g. Jackbox) where players gather first | Opens the hub URL and shows a room-code helper with copy-invite + QR |
  | `"room-link"` | A game whose URL accepts a room param (`?room=CODE`) | Generates a 6-letter code, opens `url?room=CODE`, so every member lands in the same room |
  | `"embed"` | A hosted HTML5 game with no rooms | Opens the URL in the sandboxed frame, no room sync |

- `roomParam` — only for `"room-link"`; the query-param name the game reads.
- `sharedCode` — omit (default `true`) when the game honors a launcher-generated
  room code. Set `false` for third-party sites (Jackbox, skribbl) where the room
  code lives on their side — the launcher opens the site and skips our code
  instead of showing a code that does not work there.
- Optional `accent` (hex) tints the card art; `hook` is the one-line badge text.

## 3. Adding a built-in game (the good kind)

This is what the 15 shipped games are. There are two families, and both are
first-party:

| Family | Games | Shape |
|---|---|---|
| Arcade (canvas) | Pixel Arena, Neon Snake, Pixel Rally, Breakout, Neon Void, Reaction Rush | A `draw(frame, stats)` over `useArcade`, rules in `src/lib/games/*` |
| Board & puzzle (DOM) | Chess, Checkers, Connect Four, Tic-Tac-Toe, Reversi, 2048, Minesweeper, Sudoku, Memory Match | A `<GameShell>` from `board-frame.tsx`, rules in `src/lib/games/*` |

The engines are plain modules with no React and no canvas (`chess.ts`,
`checkers.ts`, `connect4.ts`, `tictactoe.ts`, `reversi.ts`, `g2048.ts`,
`minesweeper.ts`, `sudoku.ts`, `breakout.ts`, `shooter.ts`), which is what makes
`bun run arcade:check` able to drive them without a browser.

Steps:

1. Add an entry to `BUILTIN_GAMES` in `src/lib/builtin-games.ts` (id, name, icon,
   tagline, hook, players, category, accent, controls, howTo).
2. Write `src/components/games/<name>.tsx`. Start from `useArcade` in
   `src/components/games/use-arcade.tsx` — it owns the canvas sizing, the frame
   clock, keyboard/pointer input, swipe detection and the throttled bridge back
   to React. Your component implements `draw(frame, stats)`: mutate the `stats`
   object (chips, score, best) and draw; React re-renders at most 5×/second and
   only when a value changed.
3. Keep the simulation a plain function of its world (`stepWorld(world, input)`)
   so it can be driven with no DOM — that is how `scripts/arcade-check.ts`
   catches physics bugs (it found two real ones: an unbeatable CPU and a
   room-code that never scored).
4. Register it in `BUILTIN_COMPONENTS` in `src/components/games/registry.tsx`.
5. Add its checks to `scripts/arcade-check.ts` and run `bun run arcade:check`,
   then `bun run games:render` (it renders every registered game, so a broken
   export or a bad hook shows up immediately).

Built-in games receive `players` (the voice-room size) and `fullscreen`, so a
game can scale its bots or hide its hints on a full screen.

## 4. How it works at runtime

1. Anyone in a voice room opens the Games hub (gamepad button in the call header,
   or `/games`).
2. **In a call**, "Play in call" broadcasts the game (id + name + room code +
   URL) over the room's realtime channel and tracks it in presence, so late
   joiners still see it. The launcher lands in the game; every other member gets
   a **Join game** banner and a toast.
3. The game renders through `GameStage`: a built-in component, or a sandboxed
   iframe (scripts + same-origin + forms + popups + pointer-lock,
   `allow="autoplay; microphone; camera; fullscreen; gamepad"`). Inside a call,
   `VoiceActivityOverlay` draws it as the background with the voice dock — who is
   talking, who is muted, camera tiles, mute/deafen/leave — floating on top; the
   desktop side panel (`ActivityPanel`) is the voice-first alternative.
4. **Outside a call**, a built-in game plays immediately in a full-screen layer
   (`GamePlayOverlay`); a web game opens in a new tab and its invite link is
   copied to the clipboard.
5. The starter (or the voice host) can **End game** for everyone; anyone can
   leave their own copy without ending it for the room.

## 5. Verified defaults

The shipped web entries are real, working sites (Jackbox.TV hub, skribbl.io
room-link, 2048 embed — HTTP 200, no framing headers). Point any entry at a
self-hosted deploy by swapping `url` — and drop `"sharedCode": false` if that
deploy auto-creates `?room=CODE` rooms.
