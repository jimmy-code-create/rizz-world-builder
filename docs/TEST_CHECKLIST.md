# RIZZ Test Checklist

## Screenshot-focused changes

- [ ] On mobile, opening a story covers the app header and bottom navigation, respects safe areas, and prevents background scrolling.
- [ ] On desktop, the story viewer is above the app shell and closes with its close control or swipe gesture.
- [ ] In a DM, long-pressing a message dims and blurs the chat while keeping the selected message and menu readable.
- [ ] The DM menu shows six quick reactions and a working additional-reactions control; it has no voice/video call actions.
- [ ] Copy, reply, report, and available delete actions still work from the DM menu.
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
- [ ] Chat-story playback speeds 1x, 2x, and 3x scale message timing and audio playback.
- [ ] Chat-story characters use distinct voices, and each voice can be previewed or muted.

## Build checks

- [x] `npm run build`
- [x] `npx tsc --noEmit`
- [ ] Verify authenticated screens in the running preview after the existing Supabase environment is available. The workflow starts, but the preview currently stops at the missing Supabase configuration; no authentication bypass or environment change was made.