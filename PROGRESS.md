# RIZZ Progress & Implementation Checklist

## Stack Overview
- **Framework**: TanStack Start (Nitro server + Vite 6) with React 19 & Tailwind CSS v4
- **Backend**: Supabase (PostgreSQL 15, Row Level Security, Auth, Storage)
- **Realtime Layer**: Supabase Realtime (Channels, Broadcast, Presence for signaling and presence tracking)
- **Voice Provider**: WebRTC P2P Mesh with custom TURN relay credentials (`/api/turn-credentials`, Coturn / Xirsys relay support)
- **Hosting**: Render (Web Service via `render.yaml`, Node.js environment)

---

## Phases & Audit Checklist

### Phase 0: Stack Audit & Baseline Verification
- [x] Item 1-14 codebase inspection across components, sheets, voice, and assets - **DONE**
- [x] Investigate "psi_gate" & "x86 build rule" (confirmed 0 occurrences in git history and codebase) - **DONE**
- [x] Create root `PROGRESS.md` tracking all phases and acceptance criteria - **DONE**

### Phase 1: Quick Bug Fixes
- [x] Item 1: Eliminate double "X" close buttons across dialogs, sheets, and drawers (`src/components/ui/dialog.tsx`, `src/components/ui/sheet.tsx`, `src/components/chat/PinnedMessages.tsx`) - **DONE**
- [x] Item 2: Remove unwanted lime outline borders from reaction popups and post cards; preserve subtle `#2a2a2e` border (`src/components/reactions/PostReactionsSheet.tsx`, `src/components/posts/PostCard.tsx`, `src/styles.css`) - **DONE**
- [x] Item 3: 8-color deterministic avatar palette for users without profile photos based on username hash (`src/components/ui/avatar.tsx`) - **DONE**
- [x] Item 4: Markdown formatting (bold `**`, italic `*`, inline links `[text](url)`) in user bio and post bodies (`src/components/MarkdownText.tsx`, `src/components/posts/PostCard.tsx`, `src/routes/_app/u.$username.tsx`, `src/components/ProfilePreview.tsx`) - **DONE**
- [x] Item 5: Center "+" action button styled with `#c8ff3d` lime circle, black icon, 44px tap target, active scale (`src/components/AppShell.tsx`) - **DONE**

### Phase 2: Compact Spacing & Account Menu
- [x] Item 6: Compact spacing tokens, gutters (12px mobile, 16px desktop), 12px card padding, 44px action hit area, conditional translate button, slim trending pill, drops header polish (`src/styles.css`, `src/components/PostCard.tsx`, `src/components/TrendingTagsRail.tsx`, `src/routes/_app/drops.tsx`, `src/routes/_app/feed.tsx`) - **DONE**
- [x] Item 7: Account menu: 248px width, right-aligned, `#141416` background, 14px radius, compact 40px/44px rows, expandable inline status picker (no truncation), inline "Sign out?" confirm (`src/components/AppShell.tsx`) - **DONE**

### Phase 3: Avatar Interactions
- [x] Item 8: Universal `InteractiveAvatar` component: tap = open story or profile preview sheet; long-press 450ms = full photo lightbox viewer with pinch-to-zoom and swipe-down dismiss; zero browser callout menus (`src/components/ui/avatar.tsx`, `src/components/PostCard.tsx`, `src/components/PostCommentsSheet.tsx`, `src/components/FollowSuggestions.tsx`, `src/routes/_app/explore.tsx`, `src/routes/_app/leaderboard.tsx`) - **DONE**

### Phase 4: Voice Chat Polish
- [x] Item 9: Dedicated `VoiceSettingsSheet` with working mic sensitivity sliders, noise suppression toggle, input/output device pickers, live Web Audio analyser mic test meter with threshold indicator, and in-call member volume/mute overrides (`src/components/voice/VoiceSettingsSheet.tsx`, `src/components/voice/VoiceCallView.tsx`) - **DONE**
- [x] Item 10: Real audio-driven speaking lime glow rings with simultaneous speaker support, labeled control bar (Mute, Deafen, Share screen, Camera, Settings, Leave with host confirmation), persistent docking mini-player with expand button, Screen WakeLock API integration, and exponential backoff auto-reconnect (1s, 2s, 4s, 8s, 16s) with 'Disconnected - tap to retry' (`src/components/voice/VoiceCallBar.tsx`, `src/components/voice/VoiceCallView.tsx`, `src/components/voice/VoiceCallProvider.tsx`, `src/lib/voice-room-audio.ts`, `src/lib/wake-lock.ts`) - **DONE**

### Phase 5: Loading & Shimmer Animations
- [x] Item 11: Fast boot splash with recolored lime mascot (`public/cats/peek.svg`, `public/cats/box.svg`, `public/cats/searching.svg`, `src/components/LimeCatSplash.tsx`), inline CSS/SVG fallback in `src/routes/__root.tsx`, animated peek mascot, and progressive timeout messages at 4s / 8s / 12s with retry - **DONE**
- [x] Item 12: 1.4s smooth shimmer skeleton loaders (`src/components/ui/skeleton.tsx`), staggered list entrance rise animation with prefers-reduced-motion safety (`src/styles.css`, `src/routes/_app/feed.tsx`), and blur-up lazy image placeholders (`src/components/PostCard.tsx`) - **DONE**

### Phase 6: Voice Room Activities
- [ ] Item 13: Server-authoritative architecture proposal using Supabase Realtime broadcast & presence; gamepad activity trigger button and minimizable bottom panel (`src/components/voice/VoiceActivities.tsx`) - **NOT DONE**
- [ ] Item 14: Interactive voice activities: Sketch & Guess It, Chess (`chess.js` + server clock sync), Pixel Board & Pixel Pong (`src/components/voice/activities/`) - **NOT STARTED**

### Phase 7: Final Regression Checklist
- [ ] Item 15: Cross-surface verification: no console errors, mobile touch targets >= 44px, accessibility tags, prefers-reduced-motion compliance, zero purple gradients - **NOT STARTED**

### Phase 8: Voice, Leaderboard & Onboarding Polish
- [x] Voice settings lag fix: sliders write to a local draft while dragging and commit on release (`onValueCommit`), mic meter fftSize 256→128 + ~12fps throttle + releases mic on sheet close, `devicechange` listener, memoized device lists (`src/components/voice/VoiceSettingsSheet.tsx`, `src/components/voice/VoiceCallView.tsx`, `src/routes/_app/settings/voice.tsx`) - **DONE**
- [x] Leaderboard upgrade: skeleton loaders, error retry, empty state, refresh button, self-rank banner + YOU badge, top-3 medals, tie-break ordering, tap-any-row profile card (`src/routes/_app/leaderboard.tsx`) - **DONE**
- [x] Onboarding: live username availability, display-name field, reserved-name blocklist, late-profile avatar sync, invite-link honored after tutorial, skip keeps picked cat (`src/routes/claim.tsx`, `src/routes/tutorial.tsx`) - **DONE**

### Phase 9: Top Rizz Podium + Discord Profile Card (backend proposed, not applied)
- [x] Leaderboard redesign: podium top-3 (crown center), uniform rank-4+ rows, Today/Week/All-time tabs, Everyone/Following filter, sticky "You're #N · X to pass @user" bar with scroll-to-me, rank ▲▼ arrows, >0 rizz only, How-to-earn sheet, infinite scroll 50/page, skeleton, pull-to-refresh, realtime top-10 (`src/lib/leaderboard.ts`, `src/routes/_app/leaderboard.tsx`) - **DONE (UI; period boards need migration)**
- [x] Discord profile card: single `<ProfileCard userId>` (banner, presence dot, pronouns, status line, tappable badges, bio/member-since, score/rank/followers/following, mutuals, Message/Follow/Call + Copy/Block/Report/Mute menu, View full profile, Edit own, blocked/deleted states), tapped from leaderboard/feed/reels/comments/chat/explore/notifications (`src/components/profile/ProfileCard.tsx`, `src/components/ProfilePreview.tsx`, `src/components/realms/RealmProfilePreviewDialog.tsx`, `src/routes/_app/reels.tsx`, `src/routes/_app/explore.tsx`, `src/routes/_app/notifications.tsx`) - **DONE (RPC-first, direct-query fallback)**
- [ ] DB migration (ASKED, NOT APPLIED): `supabase/migrations/20261020000000_rizz_events.sql` (rizz_events + award_rizz + get_leaderboard, RLS no-client-write, index on (created_at, user_id)) and `20261020010000_profile_card.sql` (pronouns/status_text/badges columns + get_profile_card) - **WAITING FOR OK**

---

## Discord-Style Polish (5 Tasks)
- [x] Task 1: One Close (X) Button (Investigate cause of double X, unify with shared `<CloseButton />` 44x44px target, single 20px SVG stroke 2 cream #f2efe6 at 70%/100%, lime :focus-visible ring, flex header vertical alignment, replace ad-hoc close buttons across sheets/dialogs/stories/viewers) - **DONE**
- [x] Task 2: Small set of 12 custom animated cat emojis (`src/components/emoji/CatEmoji.tsx`, `src/components/emoji/cat-emoji-manifest.ts`, `src/components/emoji/CatEmojiPicker.tsx`, `src/lib/cat-emoji-text.tsx`, `src/components/chat/ReactionQuickBar.tsx`, `src/components/chat/ReactionChips.tsx`, `src/components/presence/PresenceSheet.tsx`, `src/styles.css`) - **DONE**
- [x] Task 3: Status, fast and Discord-style (`src/components/presence/PresenceSheet.tsx`, `src/components/presence/StatusDot.tsx`, `src/components/AppShell.tsx`, `src/routes/_app/u.$username.tsx`) - **DONE**
- [x] Task 4: Discord-style unified profile card (`src/components/profile/ProfileCard.tsx`, `src/components/realms/RealmProfilePreviewDialog.tsx`, `src/components/ProfilePreview.tsx`) - **DONE**
- [x] Task 5: Discord-style mention highlight + chat polish (`src/styles.css`, `src/lib/chat-appearance.ts`, `src/components/bots/BotBadge.tsx`, `src/components/MentionAutocomplete.tsx`, `src/routes/_app/r.$slug.tsx`) - **DONE**

### Phase 10: Discord Bot Embeds (backend proposed, not applied)
- [x] Embed stack: shared limits + sanitize lib, reusable `<Embed>`/`<EmbedList>` (color bar, author, linked title, description links, 3-col inline fields, image, right thumbnail, footer+timestamp, lazy https images, 380px-safe), bot messages show bot avatar + BOT badge + cards under text, full-message modal included (`src/lib/embeds.ts`, `src/components/chat/Embed.tsx`, `src/lib/realms.ts`, `src/routes/_app/r.$slug.tsx`) - **DONE (renders when columns exist)**
- [x] Webhook delivery: `POST /api/bot-webhook/{botId}/{secret}` (secret-hash verify, revoked reject, 30/min rate limit, plain-text + https + embed-limit validation, service-role insert with bot_id, realtime delivery) (`src/routes/api.bot-webhook.$botId.$secret.ts`) - **DONE (503 until migration lands)**
- [x] Realm Settings → Bots (owners/admins): create bot, webhook URL shown once + copy + secret warning, regenerate/revoke, per-bot channel picker, embed builder with live preview + validation messages + send-test-to-channel (`src/lib/webhook-bots.ts`, `src/components/bots/WebhookBotsSection.tsx`, `src/components/bots/EmbedBuilder.tsx`, `src/components/bots/RealmBotsSheet.tsx`) - **DONE (RLS-gated; empty until migration)**
- [x] Safety: report available on bot messages (existing non-mine path), admin delete-any via existing moderate path, glass toasts + builder validation messages - **DONE**
- [ ] DB migration (ASKED, NOT APPLIED): `supabase/migrations/20261021000000_realm_webhook_bots.sql` (realm_bots + RLS owner/admin-manage + messages.embeds/webhook_bot_id/webhook_meta + embeds guard trigger + 30/min rate-limit table + realtime) - **WAITING FOR OK**

### Phase 11: Profile Preview Fix (everywhere)
- [x] Root cause: the shared card's fallback query asked PostgREST for `profiles.verified` — a column that does not exist — so every preview errored ("Couldn't load this profile") in feed, realms, explore, notifications and reels. Verification is now derived from earned badges (`badges.slug = verified / verified_creator`), matching `src/lib/posts.ts` (`src/components/profile/ProfileCard.tsx`) - **DONE**
- [x] Missing RPC (`get_profile_card`, pending migration) is remembered after the first 404: no more console errors on every open, fallback is instant (`src/components/profile/ProfileCard.tsx`) - **DONE**
- [x] Bot messages no longer open a user card with a null user id (page crash); the card also guards a falsy `userId` (`src/routes/_app/r.$slug.tsx`, `src/components/profile/ProfileCard.tsx`) - **DONE**
- [x] `ProfilePreviewDialog` shows a proper error state with "Try again" instead of "no longer available" on transient failures (`src/components/ProfilePreview.tsx`) - **DONE**
- [x] Migration RPC derives `verified` from user_badges too (file still NOT APPLIED) (`supabase/migrations/20261020010000_profile_card.sql`) - **DONE (file only)**

### Phase 12: Render Deploy Fix (npm ERESOLVE)
- [x] Root cause: `^1.168.60` let fresh installs resolve `@tanstack/react-start@1.169.2` (wants vite>=8, repo has vite 7) — ERESOLVE on `npm install` plus a broken build (`index.html` entry) even with `--legacy-peer-deps`. Pinned to exact `1.168.61` (matches `pnpm-lock.yaml`; verified `build-exit:0` with lovable config `2.26.5`) (`package.json`) - **DONE**
- [x] `.npmrc` gains `legacy-peer-deps=true` so Render's plain `npm install` survives future peer drift - **DONE**
- [x] `render.yaml` build used `npm ci` + a lockfile-normalize script but no lockfile is committed (`package-lock.json` is gitignored) — switched to `npm install --legacy-peer-deps` + build - **DONE**
