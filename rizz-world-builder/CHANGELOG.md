# Changelog

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