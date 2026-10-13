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

## Phases 3–11 checks added in this pass

- [ ] DM call: TURN credentials are requested from `/api/turn-credentials`; with no relay configured the screen says "No TURN relay configured…" instead of pretending the call can always connect.
- [ ] DM call: video starts and the encoder is capped (540p on a phone, 720p on desktop); the camera can be switched on mid-call without breaking audio.
- [ ] DM call: "Enhanced noise cancellation on/off" toggles without dropping the call, and background hum noticeably drops when it is on.
- [ ] DM call: pulling the Wi-Fi for a few seconds shows "Reconnecting…" and the call recovers; after three failed ICE restarts the troubleshooting message appears.
- [ ] DM call: remote audio blocked by autoplay shows "Tap to enable sound", and tapping it produces sound.
- [ ] DM call combinations, each in both directions: PC→PC, mobile→mobile, PC→mobile, mobile→PC.
- [ ] Incoming call on a phone vibrates while the sheet is up and auto-dismisses after 45 seconds.
- [ ] Counts: a post at 999,999,999 reads "1B" (never "1000M"), and 1,240 reads "1.2K".
- [ ] Chat stories: "Import JSON" accepts `src/data/room4b.json`, saves it under your account and opens the player; a malformed file shows a friendly error instead of a crash.
- [ ] Chat stories: importing a file while signed out, or that your account may not create, is refused by RLS with a message rather than a partial story.
- [ ] Desktop (≥1024px): opening a DM shows the thread rail on the left with the open conversation highlighted, and switching threads keeps the chat scrolled to the newest message.
- [ ] Mobile (390px): the DM page is still a single column and the thread rail is hidden.