# RIZZ Test Checklist

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