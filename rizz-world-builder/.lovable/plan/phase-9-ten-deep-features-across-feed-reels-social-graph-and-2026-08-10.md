# Phase 9 — Ten deep features across feed, reels, social graph and chat

Ten fully-built features, each backed by real data, real-time where it matters, and mobile-first UI.

## Feed & posts

1. **Polls in posts**
   Composer gets a poll mode: 2-4 options, optional duration. Post cards render live vote bars with percentages, your choice highlighted, total votes and a countdown. One vote per person, changeable until the poll closes.

2. **Post editing with history**
   Authors can edit a caption within 15 minutes. The card shows an "edited" tag; tapping it opens previous versions.

3. **Quote posts**
   Share a post into your own feed with your own caption. The quoted post renders as an embedded card linking back to the original, and the original author gets a notification.

## Reels & stories

4. **Story highlights on profiles**
   Save expired stories into named highlight rings on your profile. Tap opens the full-screen story viewer, with reordering and cover selection for the owner.

5. **Story viewer list + reactions**
   Owners see who viewed each story with timestamps. Viewers can send a quick emoji reaction or a reply, which lands in DMs as a story-reply bubble showing the story thumbnail.

6. **Reel remix (stitch)**
   Any reel can be remixed: the new reel records its parent, shows a "Remixed from @user" chip, and the original gets a "Remixes" tab listing every derivative.

## Social graph

7. **Close friends**
   A private list. Stories and posts can be marked close-friends-only, shown with a green ring, and filtered out of everyone else's feed at the data layer.

8. **Blocking and muting (server-side)**
   Real block/mute records. Blocked users can't see your posts, profile or stories, and can't DM you; muted users stay followed but vanish from your feed. Managed from Settings > Privacy and from post/profile menus.

## Chat & groups

9. **Voice notes in DMs and groups**
   Hold-to-record with a live waveform, release to send, slide to cancel. Playback bubble with waveform scrub, duration and 1x/1.5x/2x speed.

10. **Group roles, pinned messages and message search**
    Owners and admins can promote, demote and remove members. Any message can be pinned to a group banner. A search sheet finds messages in a conversation, jumps to them and highlights the hit.

## Technical notes

- New tables: `post_polls`, `post_poll_options`, `post_poll_votes`, `post_edits`, `story_highlights`, `story_highlight_items`, `story_reactions`, `close_friends`, `blocks`, `mutes`, `pinned_messages`. New columns: `posts.quote_post_id`, `posts.visibility`, `posts.remix_of`, `stories.visibility`, `direct_messages.audio_url`/`duration_ms`/`story_id`, `group_messages.audio_url`/`duration_ms`.
- Every new table gets GRANTs plus RLS scoped to `auth.uid()`. Blocks and close-friends are enforced inside security-definer helpers (`can_view_post`, `is_blocked`) used by the read policies, not only in the client.
- Poll vote counts and remix counts maintained by triggers, in the same style as the existing `bump_*` counters.
- New storage bucket for voice notes; recording via `MediaRecorder` with an mp4/webm fallback for iOS Safari.
- Realtime enabled for poll votes, pinned messages and story reactions.
- All new overlays use the existing `FullScreenLayer` portal so they clear the mobile nav.