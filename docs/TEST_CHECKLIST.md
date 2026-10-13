# RIZZ Test Checklist

## Story likes, any-source music, Voice & Sound, chat rhythm, face lenses (this pass)

### Stories
- [ ] Tap ❤️ on a story: the count goes up immediately; reload — it is still up, and a second tap removes it.
- [ ] Block the write (go offline) and tap ❤️: the flag and the count both snap back, with an error toast — nothing is left showing a like that was not saved.
- [ ] Double-tap a story: a heart bursts and the story gets liked once (a single tap never unlikes it).
- [ ] Open your own story: the button shows "N ❤"; the insights sheet lists views and shows the same like count.
- [ ] A story you have already watched loses its gradient ring; a new story from anyone brings the gradient back.
- [ ] Post with audience **Followers only** from an account that follows nothing: a second account that does not follow the author cannot see it (check the strip and direct API access).
- [ ] Post with **Close friends** and verify only close friends see it; add someone to **Hide from** and confirm they don't, even though the audience includes them.
- [ ] Reply to a story: it arrives as a normal DM in the author's inbox and no story bubble appears in any chat.
- [ ] Type `@` in a story caption and in a story text overlay: the member picker appears and inserting a mention renders as a link in the viewer.

### Music
- [ ] `/play` a song name → Apple preview, title, artwork and provider chip appear.
- [ ] `/play https://youtu.be/…` → real title, thumbnail and provider chip "YouTube", and the track plays through the embedded player (no download).
- [ ] `/play https://open.spotify.com/track/…` → "That link isn't supported yet" and nothing is queued.
- [ ] `/play https://youtube.com/playlist?list=…` → queues the playlist and plays it.
- [ ] `/play <direct .mp3 URL>` → plays inline, seek bar works.
- [ ] Join the channel's call: MUSIC BOT sings a YouTube track as well as an Apple one.
- [ ] Play a private/deleted video: the player shows "That video is unavailable" and skips to the next track.
- [ ] A video with embedding disabled shows "This track can't be embedded" and skips.
- [ ] Loop, restart, skip, queue list and inline volume all work in the voice-channel panel.

### Voice & Sound
- [ ] Settings → Voice & Sound opens and every slider saves (reload keeps the values).
- [ ] Moving the music slider changes a playing track's volume without restarting it.
- [ ] Test sound is audible; mute-everything silences it and shows the "you're muted" hint.
- [ ] A value above 100% on music shows "capped at 100%" for streamed media; the notification slider does go louder.
- [ ] Mic sensitivity changes when the speaking ring lights up; noise suppression shows as on/off for the next call.
- [ ] Input device picker lists devices after mic permission is granted; output picker is hidden where the browser has no `setSinkId`.
- [ ] Per-realm override changes only that realm's bot volume and can be reset.

### Chat rhythm
- [ ] Consecutive messages from one author sit ~3px apart; a new author gets ~18px.
- [ ] A day change inserts Today/Yesterday/dated separator, and the hover time appears in the avatar gutter on desktop (not on touch).
- [ ] At 375px, message side padding and media cards look right and nothing overflows.
- [ ] Changing `--chat-gap-same` / `--chat-gap-group` in `src/styles.css` visibly re-tunes the whole chat.

### Face lenses
- [ ] The story editor's Lens tool opens the studio and the camera permission prompt appears; denying it shows Retry + Pick a photo.
- [ ] Every category is reachable and the carousel swipes; tapping a lens applies it, tapping it again removes it.
- [ ] Intensity changes live for a warp (Big Eyes) and for a filter (Pixel 8-bit).
- [ ] With no face in frame, "No face found — showing the original image" appears and the frame is untouched.
- [ ] A gallery photo gets real detection (ears/hats track the head in the still).
- [ ] Reactive lenses respond to the right expression: jawOpen for fire breath, pucker for kiss burst, tongueOut for dog tongue.
- [ ] The fps badge appears; deliberately slowing the device drops it to "low" (half resolution) and it recovers.
- [ ] Background Replace and Face Swap show their "needs …" note instead of a broken result.
- [ ] Capture returns the frame into the story composer, where text/stickers/filters layer on top of it.

## Screenshot-focused changes

- [ ] On mobile, opening a story covers the app header and bottom navigation, respects safe areas, and prevents background scrolling.
- [ ] On desktop, the story viewer is above the app shell and closes with its close control or swipe gesture.
- [ ] In a DM, long-pressing a message dims and blurs the chat while keeping the selected message and menu readable.
- [ ] The DM menu shows six quick reactions and a working additional-reactions control; it has no voice/video call actions.
- [ ] Copy, reply, report, and available delete actions still work from the DM menu.
- [ ] Room 4B can be played in Hindi and English through all four story branches, reaches a distinct ending on each path, and replays from the start.
- [ ] Room 4B offers 1x, 1.5x, 2x and 3x narration rates; at 2x/3x the typing bubble and auto-advance are visibly faster, and the spoken rate changes with the pill.
- [ ] Room 4B selects distinct installed voices for narrator, player, Asha, Kabir, and Echo where available; pitch and volume profiles distinguish characters when only one system voice is available.
- [ ] On mobile Reels, the global create-post button is hidden and reel upload does not overlap Remix or the action rail.
- [ ] External Reels show the original source and an Open original link; no video is downloaded or rehosted.
- [ ] Verify the external-video card at full-screen Reel size and in the compact post-embed size.

## Realm chat, voice and pickers (this pass)

- [ ] Options → "Channels & permissions" opens the sheet on mobile and desktop and never shows "This page didn't load"; switching channels in the sheet and flipping a member's switch both work.
- [ ] The realm composer still reflects a per-channel write block set from that sheet.
- [ ] Queue a song in a voice channel's music panel, then join that channel's call: MUSIC BOT appears as a participant and the song is audible to everyone in the call (first tap starts it if the browser blocks autoplay).
- [ ] A track with no preview audio says so on the bot tile instead of sitting silent; skip/stop still work from the call.
- [ ] The music panel's local preview does not play over the in-call bot (no doubled, out-of-sync audio).
- [ ] Long-pressing a message shows the author, time and text at the top of the menu; on a phone the menu arrives as a bottom sheet that does not cover the conversation.
- [ ] "View message" opens the full message with a working copy button.
- [ ] Delete your own message in a text channel and in the realm's own channel: it disappears in both, not just the second.
- [ ] As realm owner (and as a moderator), delete someone else's message from the long-press menu: it is removed for everyone and disappears without a reload.
- [ ] The @ mention picker and the / command picker show the section label, row layout, right-aligned app/handle and the keyboard-hint footer.
- [ ] With owner and moderator roles, the moderation actions (pin, reaction roles, delete for everyone) are all visible; a plain member sees only their own delete plus report.

## Broader regression checks from the project spec

- [ ] Calls: PC to PC.
- [ ] Calls: mobile to mobile.
- [ ] Calls: PC to mobile.
- [ ] Calls: mobile to PC.
- [ ] Group invite preview and join work for a full URL and a bare invite code.
- [ ] Block and unblock work from the DM and privacy settings.
- [ ] Group members can send messages and receive updates without duplicate messages.
- [ ] Like and comment counts stay correct after rapid taps and realtime updates.
- [ ] Story layout works for media and text stories without overlapping captions or global navigation.
- [ ] Reel layout has no Remix overlap; official embeds and original-site cards remain distinct.
- [ ] Chat-story playback offers 1x, 1.5x, 2x and 3x, and each selection changes narration speed exactly.
- [ ] Chat-story characters use distinct voices, and each voice can be previewed or muted.

## Build checks

- [x] `npm run build`
- [x] `npx tsc --noEmit`
- [ ] Verify authenticated screens in the running preview after the existing Supabase environment is available. The workflow starts, but the preview currently stops at the missing Supabase configuration; no authentication bypass or environment change was made.

## Full-screen call, MUSIC BOT and picker checks

- [ ] Joining a voice channel opens a full-screen call: tiles fill the screen, safe areas are respected, the chat sits behind it, and the minimize (⌄) button returns to the chat with the call still running and everyone's audio still playing.
- [ ] `/play <song>` in a voice channel: MUSIC BOT appears as a participant tile with the track title, the header count includes it, and the track plays with nobody tapping anything.
- [ ] With browser autoplay blocked, "Tap to let MUSIC BOT sing" appears and starts playback on tap.
- [ ] When a preview finishes the bot moves to the next queued song instead of going silent; Pause on the tile stops it for that listener only.
- [ ] The music panel shows "Singing in call" for the current track, and its form stacks on a phone with a full-width Play button.
- [ ] Reels no longer show the REALMS chip row; upload is the only control at the top-left.
- [ ] Typing `@` shows one row per member (avatar, bold name, handle right-aligned) under a "Frequently used"/"Members" heading, and Enter picks without sending.
- [ ] Typing `/` shows commands with the app name right-aligned and the quick-pick icon strip underneath; tapping an icon runs that command.
- [ ] The emoji button opens a bottom sheet with a drag handle, Emoji/GIFs/Stickers tabs, search, a "Top emoji" row, section headings and a category strip that scrolls to a section.

## Phases 3–11 checks added in this pass

- [ ] DM call: TURN credentials are requested from `/api/turn-credentials`; with no relay configured the screen says "No TURN relay configured…" instead of pretending the call can always connect.
- [ ] DM call: video starts and the encoder is capped (540p on a phone, 720p on desktop); the camera can be switched on mid-call without breaking audio.
- [ ] DM call: "Enhanced noise cancellation on/off" toggles without dropping the call, and background hum noticeably drops when it is on.
- [ ] DM call: pulling the Wi-Fi for a few seconds shows "Reconnecting…" and the call recovers; after three failed ICE restarts the troubleshooting message appears.
- [ ] DM call: remote audio blocked by autoplay shows "Tap to enable sound", and tapping it produces sound.
- [ ] DM call combinations, each in both directions: PC→PC, mobile→mobile, PC→mobile, mobile→PC.
- [ ] Incoming call on a phone vibrates while the sheet is up and auto-dismisses after 45 seconds.
- [ ] With a call already running between two accounts, the other account's DM header shows the "Call in progress · Join" pill, and tapping it joins the call. The pill disappears when the call ends.
- [ ] Missed calls in the chat with a "Call back" button are **not** implemented: they need the `calls` / `call_participants` backend that this repo does not ship yet.
- [ ] Counts: a post at 999,999,999 reads "1B" (never "1000M"), and 1,240 reads "1.2K".
- [ ] Chat stories: "Import JSON" accepts `src/data/room4b.json`, saves it under your account and opens the player; a malformed file shows a friendly error instead of a crash.
- [ ] Chat stories: importing a file while signed out, or that your account may not create, is refused by RLS with a message rather than a partial story.
- [ ] Desktop (≥1024px): opening a DM shows the thread rail on the left with the open conversation highlighted, and switching threads keeps the chat scrolled to the newest message.
- [ ] Mobile (390px): the DM page is still a single column and the thread rail is hidden.