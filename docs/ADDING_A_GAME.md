# Adding a game to the Activities shelf

The shelf is config-only. **One JSON entry in `src/data/games.json` — nothing else.** No code per game, no redeploy of any service besides the web app itself.

## 1. Pick the connection type

| `type` | When to use | What the launcher does |
|---|---|---|
| `"multiplayer-hub"` | A hub/lobby app (e.g. GameNest) where players gather first, then pick a game inside | Opens the hub URL; shows a room-code helper with copy-invite + QR so phones join instantly |
| `"room-link"` | A game whose URL accepts a room param (e.g. `?room=CODE`) | Generates a 6-letter room code, opens `url?room=CODE`, and every room member who taps Join lands in the SAME game room |
| `"embed"` | A plain hosted HTML5 game (Gamezop / GameDistribution) with no rooms | Opens the URL in the sandboxed iframe, no room sync |

## 2. Add the entry

```json
{
  "id": "my-game",
  "name": "My Game",
  "icon": "🕹️",
  "url": "https://my-game.example.com",
  "type": "room-link",
  "players": "2-8",
  "description": "One-line pitch shown in the shelf",
  "roomParam": "room"
}
```

Field notes:

- `id` — unique, lowercase, no spaces.
- `icon` — any emoji, rendered as-is.
- `url` — must be a real `https://` URL or the panel shows a "no link yet" card instead of a broken iframe. (`PASTE_…` placeholders never launch.)
- `type` — exactly one of the three values above.
- `players` — free text (`"2-16"`, `"1+"`).
- `roomParam` — only for `"room-link"`; the query-param name the game reads (default `"room"`).

## 3. Examples (one of each type, already in the registry)

```json
{ "id": "gamenest", "name": "Party Games", "icon": "🎲",
  "url": "https://games.example.com", "type": "multiplayer-hub",
  "players": "2-16", "description": "32 board, card & party games" }

{ "id": "draw-guess", "name": "Draw & Guess", "icon": "✏️",
  "url": "https://draw.example.com", "type": "room-link",
  "players": "2-12", "description": "Draw and guess together", "roomParam": "room" }

{ "id": "quick-play", "name": "Quick Play", "icon": "👾",
  "url": "PASTE_GAMEZOP_EMBED_URL_HERE", "type": "embed",
  "players": "1+", "description": "Solo HTML5 arcade" }
```

> The `quick-play` entry ships with a placeholder URL: paste your Gamezop /
> GameDistribution embed URL over it. That paste is the whole integration.

## 4. How it works at runtime

1. Anyone in a voice room taps the controller icon → shelf → game.
2. The launcher broadcasts the game (id + room code + URL) over the room's
   realtime channel and tracks it in presence, so members who join late still
   see it. Every member gets a **Join game** banner.
3. The game runs in a sandboxed iframe
   (`allow-scripts allow-same-origin allow-pointer-lock`,
   `allow="autoplay; microphone; camera"`) beside the tiles on desktop and
   full-screen on phones. Voice is provider-owned and keeps running.
4. The starter (or the voice host) can **End game** for everyone; anyone can
   leave by closing their own panel.
