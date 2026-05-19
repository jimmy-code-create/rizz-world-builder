
# RIZZ — Phase 5 & Phase 6

Two big waves of work. Phase 5 adds new core features (voice rooms, themes, profile effects). Phase 6 is a deep polish pass — fixing UI alignment, spacing, and visual hierarchy across the whole app, plus a Discord-style profile/badge upgrade.

---

## Phase 5 — Voice Rooms, Themes & Profile Effects

### 1. Voice Rooms (LiveKit-style, WebRTC)
- New tables: `voice_rooms` (id, channel_id, host_id, title, is_live, started_at), `voice_participants` (room_id, user_id, role: host/speaker/listener, muted, joined_at, hand_raised).
- Routes: `/_app/voice` (browse live rooms) and `/_app/voice/$id` (room detail with speakers grid + listeners + raise-hand).
- Realtime presence via Supabase Realtime (broadcast channel for mic state + hand raises; postgres_changes for join/leave).
- Audio: WebRTC peer mesh for ≤8 speakers using browser `RTCPeerConnection` + Supabase Realtime as signaling. Listeners get read-only audio elements. No external paid service.
- Floating "Now Live" mini-bar at bottom of app shell when user is connected to a room.

### 2. Theme / Appearance System
- New `Appearance` section in `/settings` with:
  - Theme presets: **Nightclub (current)**, **Midnight**, **Sunset**, **Cyber**, **Mono**, **Pastel Dream**.
  - Light / Dark / Auto toggle.
  - UI density (Comfy / Compact).
  - Motion preference (Full / Reduced).
- Persist to `profiles.theme_preset`, `profiles.theme_mode`, `profiles.ui_density`, `profiles.reduced_motion`.
- Theme tokens in `src/styles.css` as `[data-theme="..."]` selectors. ThemeProvider reads from profile + localStorage fallback, applies `data-theme` and `data-mode` to `<html>`.

### 3. Discord-style Profile Effects (the "realistic" upgrade)
- New tables: `profile_effects` (id, slug, name, type: avatar_decoration/profile_effect/nameplate, asset_url, rarity, unlock_rule), `user_profile_effects` (user_id, effect_id, equipped).
- Effects library (CSS/SVG/Lottie-driven, no external assets needed):
  - **Avatar decorations** — animated rings: neon pulse, aurora swirl, fire halo, holographic, sakura petals, electric arc.
  - **Profile effects** — full-banner overlays: confetti, snowfall, sparkles, glitch, rain, smoke.
  - **Nameplates** — animated gradient name backgrounds (gold, mythic, oil-slick, vaporwave).
- Equipped effects render on `u.$username.tsx`, `PostCard` avatars, comments, and DM headers.
- Unlocks tied to badges/rizz score: e.g. 1000 rizz → Aurora ring, mythic badge → Holographic.

### 4. Badge System Upgrade (more Discord-like)
- Add columns to `badges`: `animated` (bool), `glow_color`, `tier` (1–5).
- New badges seeded: **OG**, **HypeSquad**, **Bug Hunter**, **Verified Creator**, **Rizz Royalty**, **Active Developer**, **Boost Supporter**, **Streak 7/30/100**, **First Post**, **First Drop Claimed**, **Channel Founder**, **Voice Veteran**.
- Auto-award triggers (DB functions): on first post, first drop claim, first channel created, on rizz_score thresholds (100/500/1000/5000/10000).
- Dedicated `/_app/badges` showcase page with locked/unlocked grid, progress bars, and tier glow.
- Profile badges row → hover shows animated tooltip with rarity gradient (Discord-style popout).

---

## Phase 6 — The "50+ Fixes" Polish Pass

A systematic sweep. Everything below is real work, not filler.

### Layout & Spacing (the "messed up between buttons" problem)
1. Standardize button gap to `gap-2` in all action rows.
2. Fix mobile bottom nav — currently has 8 items crammed in (tabs + Post + Profile). Reduce to 5 primary + center "+" FAB.
3. Add safe-area padding to bottom nav for iOS notch devices.
4. Replace inconsistent `rounded-xl / rounded-2xl / rounded-3xl` with a token scale (`--radius-sm/md/lg/xl`).
5. Fix `PostCard` action bar — likes/comments/reactions/share alignment on narrow viewports.
6. Add consistent `max-w-2xl` content gutter across feed, profile, channel.
7. Profile header: avatar no longer overlaps display name on <400px.
8. Sidebar active state — replace harsh pink fill with subtle glass + accent border-left.
9. Mobile top bar: collapse logo + bell + avatar with proper spacing.
10. Settings form — group sections in cards with clear separators.

### Visual Polish
11. New animated aurora background on landing page.
12. Add subtle noise/grain texture to glass surfaces.
13. Replace flat gradients with mesh gradients on hero / profile banners.
14. Add `will-change` hints to animated elements.
15. Smooth scroll behavior + scroll-snap on stories strip.
16. Hover glow on all interactive cards (channels, drops, posts).
17. Animated skeleton loaders (shimmer) replacing the pulse blocks.
18. Toast notifications restyled in glass + accent glow.
19. Empty states with illustrations (SVG) on feed, DMs, channels, drops.
20. Reaction picker repositioned + animated scale-in.

### Typography
21. Tighten display font tracking (`-0.02em`) on h1/h2.
22. Establish type scale (`text-display / text-title / text-body / text-meta`).
23. Fix line-height inconsistencies in PostCard captions.
24. Username gets monospaced tabular numerals for follower counts.

### Interactions & Motion
25. Tab switches with `AnimatePresence` slide.
26. Like button: heart burst micro-animation.
27. Story progress bar: smoother CSS animation, pause on hold.
28. DM input: auto-grow textarea + send-on-enter.
29. Channel message: hover reveals reaction/reply buttons.
30. Drop countdown: pulsing red when <1h left.

### Performance & Architecture
31. Convert all `useEffect` data fetches to `useQuery` for caching.
32. Add `React.memo` to `PostCard`, `BadgeChip`, `StoryItem`.
33. Lazy-load video posts with intersection observer.
34. Optimize avatar/banner uploads with client-side resize.
35. Add `loading="lazy"` on all images.

### Accessibility
36. Add aria-labels to all icon-only buttons.
37. Focus-visible rings using accent color.
38. Color contrast pass on muted-foreground text.
39. Keyboard nav for stories viewer (arrows, esc).
40. Respect `prefers-reduced-motion` everywhere.

### Bug Fixes Found in Current Code
41. `AppShell` mobile "Post" button just navigates to feed — wire to actual composer modal.
42. `AppShell` has both bottom nav tabs AND a Post + You button, causing 8 cramped items on 432px — restructure.
43. `u.$username.tsx` follower/following counts fetched via useEffect outside React Query — won't update on follow without manual refresh.
44. `settings.tsx` Username field uses `disabled` (looks broken) — switch to read-only with lock icon + tooltip.
45. Banner upload preview doesn't show until reload.
46. `notifications` table exists but no UI — add `/notifications` route + bell badge count.
47. `post_reactions` insert allows duplicate same-emoji per user — add unique constraint.
48. `messages` channel page lacks scroll-to-bottom on new message.
49. `dms` list doesn't show last message preview / unread badge.
50. `drops` countdown drifts because it's recalculated on render — use single interval.
51. Landing page CTA buttons stack awkwardly on mobile.
52. Login/signup card lacks Google button visual.
53. `BadgeRow` overflows on profiles with >6 badges — add horizontal scroll or +N pill.
54. `feed` infinite scroll not implemented — currently loads everything once.
55. Profile route title `@username · RIZZ` lowercase mismatch with display.

---

## Technical notes

```text
src/
  routes/_app/
    voice.tsx              (NEW — live rooms list)
    voice.$id.tsx          (NEW — room detail)
    badges.tsx             (NEW — showcase)
    notifications.tsx      (NEW)
  components/
    voice/RoomCard.tsx     (NEW)
    voice/SpeakerTile.tsx  (NEW)
    voice/RaiseHand.tsx    (NEW)
    profile/AvatarDecoration.tsx (NEW — wraps Avatar with ring effect)
    profile/Nameplate.tsx  (NEW)
    profile/ProfileEffect.tsx (NEW — overlay)
    theme/ThemeProvider.tsx (NEW)
    theme/ThemePicker.tsx  (NEW)
    Composer modal (NEW — extracted from feed)
  lib/
    voice.ts               (WebRTC signaling helpers)
    theme.ts
    effects.ts
  styles.css               (theme tokens, effect keyframes)
```

DB migrations (one combined file per phase): voice_rooms, voice_participants, profile_effects, user_profile_effects, badges columns, profiles theme columns, auto-award triggers.

---

## Approach

Phase 5 first (new surfaces + theme + effects + badge upgrade). Once stable, sweep Phase 6 in grouped commits (layout → visual → motion → bugs) so you can review checkpoints. No external paid services. Voice runs on free WebRTC + Supabase Realtime signaling.

Reply **"Approved"** or call out anything you want changed/skipped and I'll start with Phase 5.
