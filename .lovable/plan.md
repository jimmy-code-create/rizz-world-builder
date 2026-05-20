## Phase 7 — "Mega Transformation"

A large, multi-step phase. I'll ship in grouped commits, verifying the build after each. Reply **"Approved"** to start, or call out anything to drop.

---

### 1. Stories 2.0 (better canvas)
- Full-screen story viewer with progress bars, tap-to-advance, swipe-down to close (framer-motion).
- Story composer with canvas: image/video upload, text overlays, stickers, color filters, draw tool (HTML5 canvas), background gradients.
- Story replies → DM thread.
- Seen-by list for author.
- 24h auto-expiry already in DB; add view counter UI.

### 2. Groups (replaces "Voice Rooms" room concept)
- New `groups`, `group_members`, `group_invites`, `group_messages` tables.
- **Friends-only join**: invite-link join requires inviter and joiner to be mutual followers (DB trigger enforced).
- Shareable invite links: `/_app/join/$code` → preview group → Join button.
- Group chat (text + media), member list, owner controls (rename, kick, regenerate link).
- Group voice/video call entry point (WebRTC mesh, ≤8 participants) inside the group, not as standalone rooms.
- Remove standalone `/voice` discovery page; keep `voice_rooms` table but tie to `group_id`.

### 3. DMs upgrade
- Conversation list with last-message preview, unread badges, online dots (presence).
- Typing indicators (Realtime broadcast).
- Read receipts (already have `read` column — wire UI).
- Emoji reactions on messages.
- Reply-to / quote.
- Image + voice-note attachments (storage bucket `dm-media`).
- 1:1 voice & video call button (WebRTC, signaling via Realtime channel).

### 4. Calling (1:1 + group)
- Pure WebRTC peer mesh, Supabase Realtime for signaling (offer/answer/ICE).
- Pre-call screen (mic/cam preview, device picker).
- In-call UI: mute, camera toggle, screen share, hang up, picture-in-picture.
- Incoming-call toast + ringtone.
- Hand-raise, mic state pulse rings, speaker spotlight for group calls.

### 5. Drops → Giveaways
- Rename UX to "Giveaways". Keep `drops` table; add `winner_count`, `winners_picked_at`, `winner_user_ids[]`.
- Random winner picker (server fn) when expiry hits or owner clicks "Draw winners".
- Entry requirements (toggle): must follow host, must be in group X.
- Winner reveal screen + notification to winners.

### 6. Profile effects — "free trial month" + new effects
- Seed ~30 new effects across rings (12), nameplates (10), overlays (8): holographic, liquid-metal, galaxy, sakura petals, matrix rain, glitch RGB, neon pulse, fire trail, ice crystal, rainbow shimmer, etc.
- **Free trial flag**: add `trial_active` (bool) + `trial_ends_at` to `profiles`, auto-set on signup to `now() + 30 days`.
- `acquireEffect` and unlock UI bypass `unlock_rizz` while `trial_active` is true → all effects free for everyone for 1 month.
- Trial countdown banner in Settings → Appearance.
- Better nameplate equip flow: dedicated `/effects` tab with live preview using the user's actual @handle, equip persists everywhere (PostCard, profile, DMs, group lists).

### 7. UI/UX polish (~25 fixes)
- New aurora + noise background, tighter type scale, consistent button gaps, mobile nav cleanup, skeleton shimmers, hover glows, focus rings, reduced-motion respect, toast restyle, empty-state SVGs, infinite scroll on feed, pull-to-refresh, sticky composer, density modes wired everywhere.

### 8. Misc upgrades
- Mention autocomplete (`@username`) in composer + DMs.
- Link previews (Open Graph fetch via server fn).
- Post pinning on profile.
- Follow suggestions sidebar.
- Save-for-later already shipped; add folders.
- Keyboard shortcuts (`g f` = feed, `g d` = dms, `n` = new post).

---

### Order of execution
1. Migrations: groups, group_members, group_invites, group_messages, profiles.trial fields, drops winner fields, new profile_effects seed, dm_reactions, dm presence helpers.
2. Backend libs: `lib/groups.ts`, `lib/calls.ts`, `lib/giveaways.ts`, update `lib/effects.ts` for trial bypass, `lib/dms.ts` upgrade.
3. New routes: `/_app/groups`, `/_app/g.$id`, `/_app/join.$code`, `/_app/giveaways` (rename drops UI), call overlays.
4. Components: StoryViewer, StoryComposer (canvas), CallOverlay, GroupChat, GroupCallTile, GiveawayCard, MentionInput, LinkPreview.
5. UI polish pass + remove standalone voice rooms page.
6. Build verify.

This is large — I'll commit in chunks and keep you posted. Reply **"Approved"** to begin, or list anything to skip/change.
