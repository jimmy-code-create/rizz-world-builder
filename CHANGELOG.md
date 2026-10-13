# Changelog

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