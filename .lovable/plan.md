# RIZZ — Build Plan

"Your feed. Your server. Your world." A nightclub-aesthetic social app that fuses Instagram-style feeds with Discord-style live communities. Built on Lovable Cloud (Postgres + Auth + Storage + Realtime).

Because the full vision (feed + channels + stories + drops + voice + badges + Rizz Score) is enormous, we'll ship it in 5 phases. Each phase results in a fully working, polished app — you can stop or pivot at any phase.

---

## Phase 1 — Foundation, Identity & Aesthetic

Goal: a beautiful, usable shell with auth, profiles, and the signature look.

- Lovable Cloud enabled (Postgres, Auth, Storage, Realtime)
- Auth: Email + Password and Google sign-in; `/login`, `/signup`, `/reset-password`
- Design system in `src/styles.css`: dark base, hot pink + deep violet glow tokens, gradient/aurora backgrounds, glassmorphism cards, glow shadows, pulse/shimmer animations, bold display typography (e.g. Space Grotesk + Inter)
- Routes: `/` landing, `/feed`, `/explore`, `/u/$username` profile, `/settings`
- Persistent app shell: glowing top nav + bottom tab bar (mobile-first per current 432px viewport), responsive to desktop sidebar
- DB tables: `profiles`, `user_roles` (separate roles table, `has_role()` SECURITY DEFINER), `follows`
- Profile page: avatar, banner, bio, follower/following counts, follow button, tabs (Posts / Channels / About)

## Phase 2 — Feed, Posts & Reactions

Goal: the Instagram half.

- DB: `posts` (image/video/carousel/text), `post_media`, `comments`, `likes`, `reactions` (Discord-style emoji on posts)
- Storage buckets: `avatars`, `banners`, `posts` (public); RLS policies
- Composer: multi-image/video upload, captions, mentions, hashtags
- Feed: following feed + algorithmic Explore (recency × engagement × Rizz Score)
- Post detail page with comment threads and public emoji reactions
- Realtime: live like/reaction counters, new comments stream in
- Notifications table + bell with realtime updates

## Phase 3 — Channels (the Discord half)

Goal: every profile is also a server.

- DB: `channels` (per-user, types: text/announcement/drops), `messages`, `message_reactions`, `channel_members`, `presence`
- Channel UI inside profile: left rail of channels (#vibes, #drops, #art-dump), chat view with realtime messages, typing indicators, emoji reactions, replies, attachments
- Live presence: online/idle/offline dots powered by Supabase Realtime presence
- Stories strip on feed shows who's currently active in their channels (live ring)
- Permissions: owner/mod/member roles per channel via `user_roles` pattern
- Slash commands (basic): `/giphy`, `/poll`, `/drop`

## Phase 4 — Stories, Drops & Rizz Score

Goal: urgency, exclusivity, reputation.

- Stories: 24h ephemeral image/video, viewer list, live presence ring, reply-to-DM
- DM system: `conversations`, `dm_messages` with realtime
- Drop System: `drops` table — creator drops content/file/link with `expires_at` and/or `claim_limit`; claim flow, countdown UI, claim leaderboard
- Rizz Score: server function recomputes score from engagement quality (reactions/comment ratio), posting consistency, channel activity, drop participation; surfaced as animated gradient number on profile + leaderboard route `/leaderboard`
- Badges system (Discord-style): `badges` and `user_badges` tables; auto-awarded (Early Adopter, Verified, Top 1%, Drop Hunter, Voice Veteran, Streak 30, Founder, Mod) and admin-grantable; rendered as glowing chips on profile and next to username everywhere

## Phase 5 — Voice Rooms & Polish

Goal: live audio + production polish.

- Voice Rooms attached to any post or channel using LiveKit (requires `LIVEKIT_API_KEY` + `LIVEKIT_API_SECRET` — we'll request these via the secrets tool when we reach this phase)
- Server function mints LiveKit tokens; UI shows speakers, listeners, raise-hand, mute, leave
- Live room indicators bubble up to feed and profile
- Search (users, posts, hashtags, channels) with Postgres full-text
- Moderation: report, block, mute; admin dashboard at `/admin` (role-gated)
- Performance pass: image optimization, lazy loading, route-level code splitting, SEO/meta per route
- PWA: installable, offline shell, push notifications

---

## Technical Architecture

- TanStack Start (already scaffolded) with file-based routing in `src/routes/`
- Lovable Cloud: Postgres + Auth + Storage + Realtime; `requireSupabaseAuth` middleware on all protected `createServerFn` handlers; `supabaseAdmin` only inside server-only files for trusted ops (Rizz Score recompute, badge awarding, LiveKit token minting)
- Roles: separate `user_roles` table + `has_role()` SECURITY DEFINER (never on profile)
- Realtime: Supabase channels for messages, presence, reactions, notifications
- Voice: LiveKit Cloud (Phase 5)
- State: TanStack Query for server state; Zustand for ephemeral UI (composer, voice room)
- Animation: Framer Motion + custom CSS keyframes for pulses, glow, shimmer
- Design tokens: all colors as oklch HSL semantic tokens — no raw color classes in components

---

## What I need from you to start

1. Confirm phasing (or tell me to merge/skip any phase).
2. Pick a username for your seed admin account so I can grant you the Founder badge after auth is up.
3. Confirm Phase 5 will use LiveKit (I'll request keys when we get there).

Once you click **Implement plan**, I'll start with Phase 1 and we'll iterate phase by phase.