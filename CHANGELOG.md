# Changelog

## 2026-10-13 — Realm forums: themed forum surface, per-forum settings, forum notifications

### The forum surface
- Forum channels (`kind = "forum"`) swap the message list for their own surface under `src/components/forum/`, built from the same tokens as the feed redesign so forums, feed and chat read as one app.
- **Hero header:** banner with a gradient overlay, forum icon/emoji, name, description, post count and a "New post" button; it collapses into a slim sticky header on scroll.
- **Sticky filter bar:** search field, sort dropdown and horizontally scrolling tag chips, each tag carrying its own colour and emoji.
- **Post cards:** 16px radius, soft shadow, thumbnail, title, 2-line preview, tag chips, avatars of recent repliers, reply and like counts, last activity. Pinned posts get a highlighted border, locked ones a lock icon, solved ones a green check badge.
- **Layout switcher:** Card, Compact list and Gallery (masonry for image posts), remembered per user in `rizz:forum-prefs` — together with comfortable/compact density, font scale and hide-read-posts. The forum's admin defaults apply until a member picks their own, and a per-room override lets a gallery board and a text board differ.
- **Motion:** staggered card fade-in, press-scale on tap, skeleton loaders, smooth expand/collapse for replies.
- **Themes:** dark, light and AMOLED black. Ink over an accent colour is chosen by real WCAG contrast (`readableInk` in `forum-content.ts`) instead of a fixed white/black guess, so tags and statuses stay legible on any background.

### Post page
- Optional cover image, large title, author card (avatar, role colour, badges, join date), tags and a reaction bar.
- Replies render as a clean thread with thin connector lines for nesting, an "OP" badge on the author's replies, role-coloured names, and the chosen **Best answer** highlighted with a green border pinned under the post.
- Rich embeds reuse the app's existing players: image galleries open in the media viewer, fenced code becomes a copyable code block, YouTube uses the same official iframe the reels use, and music links play through `MusicPlayer`.
- The reply box is sticky on mobile and expands when focused.

### Per-forum settings (moderators, with live preview)
- `ForumSettingsSheet` edits banner, icon, accent colour, description and the pinned guidelines post; default layout, default sort and card density; custom tags (name, colour, emoji) with an optional required-tag rule; custom statuses (Open / In progress / Solved / Closed …) with colours; post templates that render as a form when creating a post; the custom reaction set and allowed attachment types; slowmode, who can post or reply, and auto-archive after N days of inactivity.

### Notifications
- Two new types — `forum_reply` (someone replied to your thread) and `forum_tag` (a new post in a tag you follow) — rendered on the Notifications screen with a deep link straight to the thread through `?room=` and `?post=`.

### Data
- `supabase/migrations/20261018000000_realm_forums.sql`: `realm_forums` (per-room appearance and rules), taxonomy (`realm_forum_tags`, `realm_forum_statuses`, `realm_forum_templates`), content (`realm_forum_posts`, `realm_forum_replies`, reactions and likes) and member state (`realm_forum_reads`, `realm_forum_tag_follows`, `realm_forum_mutes`), each with RLS (17 policies).

## 2026-10-13 — Story likes and privacy, any-source music, Voice & Sound, chat rhythm, 69 face lenses

### Stories are their own feature, and likes finally save
- **Why likes failed:** there was nothing to write to. `public.stories` had `view_count` and no `like_count`, and there was no `story_likes` table at all — the heart only flipped a local flag, so nothing was saved, no count was ever shown, and a second tap silently re-inserted the same row. `story_reactions` covers emoji reactions, not likes.
- **Why the view counter was also stuck at 0:** `bump_story_views` is a plain trigger, so its `UPDATE public.stories` ran as the *viewer* — and the only UPDATE policy on `stories` is the author's. RLS matched zero rows, so `view_count` never moved. Both counters are now `SECURITY DEFINER`, and existing stories are recomputed from the `story_views` rows that were recorded.
- **Fix:** new `story_likes` table (own-rows policies, author can see who liked), `stories.like_count`, a `bump_story_likes` trigger, and a `StoryViewer` like button that is optimistic, shows the real count, and rolls back the flag *and* the count when the write fails. Double-tap likes with a heart burst.
- **Audience, enforced in RLS:** `everyone` / `followers only` / `close friends` plus a hide-from list (`stories.hidden_from`). `followers` is a new value on `post_visibility`, `can_view_story()` applies it, and the old expiry-only policies were replaced — a private story is not readable through a direct PostgREST call either. The composer has a privacy panel and a people picker before posting.
- **Unseen rings:** the gradient ring now means "new since you last looked" (tracked per device), instead of always looking the same.
- **Mentions in stories:** the story text editor and the new caption field use the same `@` picker as chat, and captions render mentions/tags as real links.
- **Replies stay DMs:** a story reply is inserted into `direct_messages` with `story_id`, so it lands in the author's inbox — the story is never rendered as a chat message.

### MUSIC BOT plays more than Apple (and pasted links actually resolve)
- **Why only Apple Music ever played:** `/play` sent a typed song name to the iTunes Search API and, for anything that looked like a link, queued the raw URL as the *title* with `preview_url = null`. So a YouTube link produced a chat card reading "https://youtu.be/…" with no artwork, no metadata and no audio — and the in-call bot, whose only playback path was `<audio src={preview_url}>`, could not sing it.
- **Fix:** `src/lib/music-sources.ts` classifies a link (YouTube watch / youtu.be / shorts / playlists / music.youtube.com, Apple Music, direct audio files) and `src/lib/music-resolve.ts` resolves it per provider on the server — YouTube through its public oEmbed endpoint (no API key), Apple through the existing search, audio files by checking the content type. Each provider is one entry in a registry, so adding one is a case, not a rewrite.
- **Playback:** one `MusicPlayer` handles every source — an `<audio>` element for Apple previews and direct files, and the official YouTube IFrame Player API for YouTube. **YouTube is never downloaded or extracted.** Play/pause/seek/volume/loop/end-of-track behave identically for all three.
- **Errors:** video unavailable (100), embedding blocked (101/150), region-locked, invalid link and not-audio all map to friendly copy with a skip to the next track; the queue keeps the track so it can retry.
- **Player features:** the voice-channel panel gained a now-playing card, seek bar, restart, skip, loop, shuffle, inline volume and the upcoming queue; queued-track cards play inline instead of showing a dead title.

### Voice & Sound settings
- New **Settings → Voice & Sound**: master (0–200%), separate music / voice & TTS / notification sliders, mute-everything, Test sound, input + output device pickers, mic sensitivity and noise suppression. Stored in `rizz:sound` and applied live — no playback restart.
- Per-realm bot volume override on top of the music slider, plus quick volume + mute inside the player.
- Honest limits, stated in the UI: the browser caps streamed media at 100%, while the notification tones are generated here and do go above it; output-device selection is hidden where `setSinkId` doesn't exist.

### Chat rhythm (Realms chat)
- Message spacing is now theme tokens: ~3px between consecutive lines from one author, ~18px between groups (5-minute grouping window), with the date divider adding its own gap.
- Consecutive messages group under one avatar/name/time, and the time appears in the avatar gutter on hover (desktop); on touch the long-press preview carries it.
- Added `Today` / `Yesterday` / dated separators, a comfortable line height token, 14px side padding, and media/embed cards with their own spacing.

### Face effects — 69 lenses on one shared warp shader
- `src/lib/face-effects.ts` is a data-driven registry of all 69 effects (16 warp, 8 reactive, 12 overlays, 8 beauty, 12 filters, 8 world, 5 fun) with per-effect parameters and a default intensity. New lenses are rows, not code.
- **One shared GPU mesh-warp shader** drives every warp effect: a subdivided grid displaced in the vertex shader from `uWarp[6]` (centre, radius, signed strength) plus `uSwirl`. No CPU pixel loops anywhere in the warp path.
- Tracking is MediaPipe Face Landmarker, imported lazily from its pinned CDN bundle (no new dependency, so the repo's three lockfiles and the Render `npm ci` step are untouched) and it asks for **blendshapes** — `jawOpen`, `mouthPucker`, `tongueOut`, `eyeBlinkLeft/Right`, `browInnerUp`, `mouthSmileLeft/Right` — so the reactive lenses respond to the right expression instead of guessing from geometry. Head roll/yaw/pitch come from landmarks and drive the overlays.
- The studio (camera or gallery photo) has the effect carousel above the capture button, tap-to-apply, an intensity slider for every effect, and the "No face found — showing the original image" hint. Sustained frame rate under 24fps halves the render resolution until it recovers above 28fps, and the measured fps is shown.
- **Scope, stated plainly:** `Background Replace` and `Face Swap` are registered but marked unavailable in the UI — the first needs a segmentation model that isn't bundled, the second needs a two-face texture transfer. Nothing pretends to work: those two say what they need. The 30fps target is implemented as the guard above but has not been measured on a mid-range phone from this environment.

### Story editor status (section 2 of the brief)
- Added: privacy picker before posting, mention/tag people in story text and captions, the lens tool, 44px touch targets, a scrollable toolbar that survives 375px, and safe-area handling.
- Already present and kept: 9:16 canvas, pinch/rotate/drag/tap/swipe-down gestures, text with fonts/colours, stickers, filters, gradient backgrounds, undo, trash-drop.
- **Not built:** the drawing brush, story music picker, GIF picker and crop/trim trimmer. They are additive tools on top of the existing canvas model and are the natural next step, not something this pass silently dropped.

## 2026-10-13 — Channels & permissions crash, silent MUSIC BOT, message actions, Discord-style mobile pass

### "Channels & permissions" no longer takes the page down
- Opening Options → **Channels & permissions** replaced the realm with "This page didn't load".
- Cause: the same duplicate-topic bug as the voice-join crash, in a second place. `useChannelPermissions` subscribed to the fixed topic `realm-channel-permissions-<realmId>`, and the realm page *and* the sheet body both use that hook — so opening the sheet subscribed an already-joined channel, `subscribe()` threw inside an effect, and React escalated it to the route error boundary.
- Fix: every consumer of `useChannelPermissions` gets its own topic (`...-<instanceId>` via `useId`) and subscribes through `subscribeSafely`, so the composer hint and the moderation sheet watch the same data without sharing a channel. The realm settings panel uses the same hook and is covered by the same fix.

### MUSIC BOT sings in the call (it was keyed to the wrong id)
- Cause: the queue is keyed by the **realm channel** id (`realm_rooms.id`), but the in-call bot passed `call.roomId`, which is the **voice_rooms row** id. Every lookup missed, so the bot stood in the call with an empty queue and never made a sound — the track really was queued, it was just invisible to the bot.
- Fix: the in-call bot and its `skip` now use `call.channelId`. Queuing in the channel's music panel and joining that channel's call is enough for everyone in the call to hear the same song, and the panel's local preview steps aside so the track never plays twice, out of sync.
- Autoplay: a track queued by someone else starts with no gesture of mine, which browsers refuse. The bot now resumes on the first tap or key press anywhere in the call (the mic/camera buttons count), instead of waiting for a dedicated button.
- Honesty: when a track has no playable preview (Apple Music shares 30-second previews only, and pasted links have none) the bot tile and the panel now say so instead of sitting silent.

### Long-press on a message
- The menu no longer covers what you pressed: it opens with the author, the time and the message text at the top, and `View message` opens the whole message full size with a copy button.
- On phones the menu is a **bottom action sheet** (Discord-style) rather than a popover over the conversation, so the chat stays readable.
- Deleting your own message in a *text channel* now removes it from the list: the handler patched only the realm-level cache, so a message in a channel stayed on screen after being deleted and looked like the delete had failed.
- Realm owners and moderators can remove anyone's message; if the row is not theirs to delete (a bot message, or a moderation-only policy) the moderation RPC is used instead of refusing with "you can only delete messages you sent".

### Mobile top bar and feed hero
- Top bar is Discord's arrangement and one tidy row on any phone: logo, round search button, then the bell, status pill and avatar on the right.
- Feed hero is compact (smaller avatar, tighter heading, one action row with Share/Reels/Explore) so more of the feed is visible without scrolling.

### @ mentions and / commands
- Both pickers now match: section label on top, one row per entry with the avatar leading, the name and secondary line, the owning app or handle pushed to the right, an accent bar on the highlighted row, and a keyboard-hint footer. The slash list keeps its app strip.

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