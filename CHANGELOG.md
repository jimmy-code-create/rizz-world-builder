# Changelog

## 2026-10-13 — Fix: "This page didn't load" when joining a voice channel

### What happened
- Joining a voice channel on `/r/<slug>` crashed the route into the root error page ("This page didn't load").

### Why (the actual cause)
1. `useMusicQueue` subscribed to the realtime topic `music-queue-<realmId>`, and supabase-js keeps **one channel per topic per client** — a second `channel(topic)` call hands back the *existing* instance.
2. That instance is already joined, so calling `subscribe()` on it throws `tried to subscribe multiple times. 'subscribe' can only be called a single time per channel instance`.
3. The MUSIC BOT work added a **second live consumer** of that queue (the channel's music panel *and* the in-call bot), so the double subscribe happened exactly when a call started — inside a `useEffect`, which React escalates to the route error boundary. The whole page died instead of one feature failing.

### Fix
- `useMusicQueue` now gives every consumer its own topic (`music-queue-<realmId>-<instanceId>` via `useId`), so the panel, the queue sheet and the in-call bot never fight over one channel. This also removes the same latent crash when opening the Queue sheet while on a voice channel.
- Added `src/lib/realtime.ts` with two helpers: `subscribeSafely` (a duplicate-topic subscribe is not fatal — the channel is already live and handlers attached before it still receive events) and `findJoinedChannel` (reuse a live channel and leave its cleanup alone).
- Applied them to the other places where one client can hold the same topic twice: the DM header's "Call in progress" watcher, the incoming-call ringer's decline signal, the call screen's own subscribe, and the shared presence singleton (whose teardown is asynchronous, so a listener arriving right after the last one left could be handed a channel that was still closing).
- `MusicBotBoundary` now wraps the bot's audio owner: the bot is an optional extra on top of a call, so if it ever does throw the user loses the singing bot, not the page.

### How to confirm
- Join a voice channel in a realm whose channel already has a track queued: the call opens full screen, the page stays up, and no "tried to subscribe multiple times" error appears in the console.
- Open the Queue sheet while in the call, and hang up: neither action reloads the page.

## 2026-10-13 — Full-screen calls, MUSIC BOT in the call, Discord-style pickers

### Voice calls take the whole screen
- Why: The expanded call was a bottom sheet capped at 92% height, so tiles, the participant list and the controls had to share a cramped area — the one thing a call needs is room.
- Fix: The call view is now a full-screen layer above the app shell, with safe-area padding, a whole-viewport participant grid and a minimize button that drops back to the chat without ending the call. Audio is unaffected while minimized (it is owned by the provider, not the view).

### MUSIC BOT joins the call and sings
- Why: The bot only ever queued songs into `music_queue`. Nothing played unless you tapped a preview on your own device, so "/play" looked like it did nothing.
- Fix: The bot is now a call participant. Its tile sits with the other people, the header count includes it, and its track plays for everyone in the channel through an audio element owned by the voice provider (so minimizing the call does not cut the song). A queued track starts automatically, `Tap to let MUSIC BOT sing` appears when the browser blocks autoplay, and when a preview ends the bot skips the queue on so it keeps singing. The music panel shows an "In call / Singing in call" chip and its layout stacks on phones.
- Honest scope: tracks are the 30-second iTunes preview clips already stored in the queue, each client plays the same queue item from 0, and previews are start-synced on queue changes rather than sample-synced. Streaming full tracks to a channel needs a server-side audio worker, which this repo does not have.

### Reels: REALMS rail removed
- Why: The realm rail sat in the reels header next to upload and pushed the other controls around on small screens.
- Fix: Reels no longer render it; `ReelsRealmRail` stays in the repo for other surfaces.

### Discord-style mention and slash pickers
- Why: The mention list stacked the name over the handle and the slash menu buried the owning app in the middle of the row, so both read as generic autocompletes rather than the pattern people know.
- Fix: Mentions are one row per member — avatar, bold name, handle pushed to the right edge — under a "Frequently used" / "Members" heading. Slash commands put the app name at the right edge and gained Discord's quick-pick icon strip under the list.

### Emoji, GIF and sticker picker
- Why: The picker was a small popover with one long unsectioned emoji scroll, which is awkward on a phone.
- Fix: It is now a bottom sheet with a drag handle, safe-area padding and a scrolling body, keeping the Emoji / GIFs / Stickers tabs and search. Emoji gained a "Top emoji" quick row, sticky per-section headings and a category strip that jumps to a section.

## 2026-10-13 — UI phases 3–11: calls, counts, stories and import

### DM calls (phase 9)
- Why: The DM call screen built its own STUN-only list, so it ignored the TURN credentials the deployment already serves and failed on restrictive Wi-Fi, VPN and mobile networks while telling the user nothing useful.
- Why: Video started at 720p with no codec preference or bitrate cap, the microphone was published raw (no filtering), and a dropped connection had no recovery path — the screen just said the network failed.
- Fix: `/call/<userId>` now pulls ICE servers from `/api/turn-credentials` (STUN fallback + an honest "no TURN relay configured" note), prefers VP8 with H264 as fallback, caps video at 540p/800 kbps on phones and 720p/1.5 Mbps on desktop, enables `autoGainControl`, routes the mic through a voice-cleanup AudioWorklet (high-pass + noise gate, Web Audio filter fallback, raw mic as the last resort), restarts ICE up to three times with a visible "Reconnecting…" state, shows a poor-connection badge from live RTP stats, holds a screen wake lock, and offers "Tap to enable sound" when remote autoplay is blocked.
- Perfect negotiation replaces the hand-rolled offers: `onnegotiationneeded` handles camera changes, and an offer collision is resolved by the polite peer rolling back instead of both sides deadlocking.
- The RNNoise WASM binary could not be added here (no network access to fetch it, no npm registry), so the worklet implements a conservative gate + high-pass filter instead. It never gates to silence, and the mode is labelled honestly in the console.

### Incoming calls and "Call in progress"
- Why: A ring vanished after 30 seconds with no sound on desktop and no haptic at all, so calls were easy to miss.
- Fix: The ring window is 45 seconds and the sheet vibrates while it is up (best-effort; browsers without vibration simply stay silent).
- Why: Once a call started, anyone in the conversation had no way to tell it was happening.
- Fix: The DM header now watches presence on this conversation's call channel and shows a "Call in progress · Join" pill that opens the call. The watcher uses its own presence key and never tracks, so it is never counted as a participant.

**Not implemented — needs backend work:** the brief's "missed call appears in the chat with a Call back button" and the `start_call`/`join_call`/`end_call` RPCs rely on `calls` and `call_participants` tables that do not exist in this repository's Supabase schema (`backend-sql/` ships only `10_push`…`13_tts`, and `src/integrations/supabase/types.ts` has no call tables). Adding them as frontend-only UI would show buttons that cannot write anywhere, so that item is left out until the call tables land. The current call flow uses realtime presence/broadcast signalling only, which is why it works without them.

### Like / comment counts (phase 8)
- Why: `formatCount` rolled 999,999,999 up to "1000M": the millions branch rounded before it ever checked the billions threshold.
- Fix: One `compact()` helper per unit, with rollover at 999,500, so counts read 999K, 1M, 999M, 1B and never print a 1000 prefix. Verified against 23 fixed cases plus 682 rollover samples in Node.

### Chat stories (phase 10)
- Why: Playback could not go faster than 2x, and the message delays, typing bubble and speech rate were not tied to the speed pill.
- Fix: Added 3x (speaking rate clamps at 3), and the typing bubble and auto-advance now divide their base delay by the selected speed.
- Added an author-only **Import JSON** screen that accepts the documented `chapters → scenes → messages` schema (or an already-flat `lines`/`choices` file), converts it into the saved story shape and inserts it through the author's own session so the existing RLS policies apply. `src/data/room4b.json` is the placeholder example.
- The importer is pure and unit-tested: role-based voice mapping, encounter-order fallback for unnamed casts, scene-relative `goto` targets and friendly errors for invalid JSON, missing chapters or empty text.

### Desktop and chat layout (phases 3, 4, 11)
- Why: On a wide screen the DM page was a single stretched column, so switching conversations meant leaving the chat for `/dms`.
- Fix: `/dm/<userId>` now renders a thread rail beside the conversation from `lg` up, sharing the same `["dm-threads", user.id]` query as `/dms` so both views always agree.

## 2026-10-13 — Realm settings, voice-channel music and the feed

### Mobile scrolling stopped at the first screen
- Why: The app shell treated every `/r/...` path as a chat, so `/r/<slug>/settings` was rendered in a column with `overflow-hidden` and no scroller of its own. On a phone, nothing below the fold could be reached.
- Fix: Only real chat surfaces (DMs, groups, stories and `/r/<slug>` itself) take over the viewport. Realm settings keeps the shell header, the bottom navigation and a scrolling column.

### Channel permissions moved into realm settings
- Why: Per-channel permissions lived in a sheet behind a small "Per-channel" button, and on phones that sheet never opened.
- Fix: The same UI is now a first-class "Channel permissions" section of `/r/<slug>/settings` (channel picker, who may write, who may react). The sheet is still used from the realm chat, and both render one shared body so the two cannot drift apart.

### MUSIC BOT is a voice-channel feature
- Why: `/play` queued into whatever channel it was typed in while the music RPCs refused voice rooms — the opposite of where a music bot belongs — and the `/play` entry also appeared in channels where it always failed.
- Fix: `music_add` and the `/queue`, `/np`, `/skip`, `/stop` runner now require a voice channel, and `realm_slash_commands` offers MUSIC BOT in voice channels only (everything else in text channels only). Voice channels gained a music panel: a `/play` input, now playing with a tap-to-preview player, skip, clear and the queue sheet.

### Feed design
- Why: The feed opened with a bare heading, so the first screen carried no sense of who was reading or what was new.
- Fix: Added a greeting hero with live state and real drop counts, section rules for Stories and Latest drops, a "Share something" button that focuses the composer, and a caught-up footer with a refresh.

## 2026-10-04 — Screenshot-focused UI fixes

### Phase 5: DM message actions
- Why: The message popover was translucent, leaving chat content readable behind the action list.
- Why: Voice and video call controls were included in a message-specific menu.
- Fix: Added a dimmed, blurred backdrop, an opaque action panel, six quick reactions plus an expanded picker, and removed call actions from the menu.

### Phase 6: Story viewer
- Why: The fixed story viewer was rendered inside the app shell's stacking context.
- Why: The global header and navigation had a higher stacking order and covered the story.
- Fix: Rendered the viewer through the shared body-level full-screen layer so it covers the shell and locks background scrolling.

### Phase 7: Reels
- Why: The external-video placeholder did not make the source or next action clear.
- Why: The reel-upload button sat over the bottom action row and could cover Remix.
- Fix: Added a source-branded poster card with an Open original link, moved reel upload to the top of the reel area, and hid the global create-post button on Reels.

No official oEmbed thumbnail is present in the current reel data, so the external card uses a branded poster rather than fetching or rehosting media.

## 2026-10-04 — Room 4B story and narration

- Expanded the four existing Room 4B branches with complete closing sequences and distinct endings.
- Set story playback to exact 1x, 1.5x, and 2x rates.
- Prefer different installed system voices by character and language, with separate pitch and volume profiles when devices expose fewer voices.
- Kept narration on browser-native speech synthesis; this does not require an API key or paid voice service.