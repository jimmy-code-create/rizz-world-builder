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

### Phase 13: Realm Reaction Toggle Fix (reproduced → fixed → verified)
- [x] Root cause REPRODUCED against a real Postgres (PGlite; live objects copied verbatim): `20261014000000_realm_bots.sql` replaced the full unique index `message_reactions_scoped_unique` with PARTIAL indexes (`... WHERE user_id IS NOT NULL` / `WHERE bot_id IS NOT NULL`), but `toggle_message_reaction()` inserts with `ON CONFLICT (message_type, message_id, user_id, emoji)`. A partial index can only arbitrate that conflict when the target repeats its predicate, so every realm/group add failed at execution with `42P10: there is no unique or exclusion constraint matching the ON CONFLICT specification` → PostgREST 400 → "Couldn't react, try again". DM reactions kept working (plain unique constraint), matching the exact symptom - **DONE**
- [x] Fix migration: RPC recreated with the predicate-matching conflict target + explicit NULL-author (bot/system message) support; both partial indexes + grants re-asserted; idempotent, no rows deleted (`supabase/migrations/20261022000000_fix_realm_reaction_toggle.sql`) - **DONE (apply to DB)**
- [x] Verification harness (throwaway, outside the repo): 20/20 checks green with the fix file applied twice — add, toggle-off, re-add, bot message (sender_id NULL), un-react (AFTER DELETE trigger), reaction roles grant/revoke, group scope, mods-only guard, non-member guard, 20-emoji cap, duplicate-insert arbiter - **DONE**
- [x] Client: one automatic retry (350 ms) before the optimistic chip rolls back and the error toast appears; reaction bar and double-tap skip `pending-` messages that have no server id yet (`src/lib/reactions.ts`, `src/routes/_app/r.$slug.tsx`) - **DONE**

### Phase 14: App-wide Glass Toast System
- [x] One reusable card for the whole app: glass (blur + translucent surface), 16px radius, colored accent rail on the leading edge, typed icon, short title, optional one-line message and one action button ("Retry"/"Undo") (`src/components/ui/GlassToast.tsx`, `src/lib/toast.tsx`) - **DONE**
- [x] Top-center below the status bar/safe area (never over the composer or keyboard), up to 3 stacked, identical calls merge instead of stacking, slide in/out under 250ms, swipe up/sideways or tap to dismiss, countdown pauses while pressed or focused, auto-dismiss 3.5s (5s with an action), light haptic on error, prefers-reduced-motion honored (`src/components/ui/sonner.tsx`, `src/styles.css`) - **DONE**
- [x] Drop-in `toast` API (callable + success/error/info/warning/message/loading/dismiss, `description`/`action`/`id`/`duration`/`icon`) so all 71 previous sonner imports now render the glass card; the reaction rollback toast gained a "Retry" action that repeats the intended toggle - **DONE**

### Phase 15: Custom Embeds for the Existing Bots (welcome card + per-bot templates)
- [x] `bot_templates` (bot_id, realm_id, embed jsonb, updated_by/at) with member-read RLS and owner/admin-only RPCs (set / reset / send test) that re-check permissions server-side; `bot_insert_message` renders the realm template at post time and stays plain text when there is none - **DONE (apply to DB)**
- [x] Server validation mirrors webhook embeds (plain text, no HTML, https-only images, same 256/4096/25/1024/2048/6000 limits, optional wave button); variables {user} {username} {userAvatar} {realm} {memberCount} {date} {channel} substituted server-side; unresolved urls, avatar-less members and stale timestamps are dropped instead of shipped broken (`supabase/migrations/20261022010000_bot_embed_templates.sql`) - **DONE (apply to DB)**
- [x] WELCOME new-member message is now the card: accent bar, member avatar thumbnail, "Welcome to {realm}!", "{user} just joined, say hi!", footer "Member #{memberCount}" + timestamp and a "👋 Say hi" button that waves at the message and opens the new member's profile card; the owner's custom welcome line stays as the message body; old plain-text bot messages render exactly as before - **DONE (apply to DB)**
- [x] `<Embed>` draws the optional button row; mention chips verified to flow inline (`display: inline`) in message text; realm chat wires the wave + profile open (`src/components/chat/Embed.tsx`, `src/routes/_app/r.$slug.tsx`) - **DONE**
- [x] Realm Settings → Bots gains "Bot message embeds": per built-in bot editor reusing the webhook embed form, real variables chips, live preview rendered by the same `<Embed>` with the admin's name/avatar + real realm/channel/member count, "Send test" to a picked channel and "Reset to default"; graceful "needs migration" state (`src/components/bots/BuiltinBotEmbeds.tsx`, `src/components/bots/RealmBotsSheet.tsx`, `src/components/bots/EmbedBuilder.tsx`, `src/lib/bot-templates.ts`) - **DONE**
- [x] Verified against a real Postgres (PGlite), migration applied twice: 37/37 checks — welcome trigger end-to-end, plain-text fallback, per-bot template + every variable, permission/non-manager guards, validation + HTML-strip + https guards, avatar-less member drops the thumbnail, reset back to the default, send test posts the card, voice channels refused (`/tmp/opencode/react-repro/bot-embed-test.mjs`) - **DONE**

### Phase 16: ProfileCard polish (badges, stats, realm context)
- [x] Badge pills show real icons: `badges.icon` keys ("badge-check", "hash", "image", "BadgeCheck"…) map to lucide glyphs, real emoji stay emoji, unknown keys fall back to a medal — a pill never prints an icon name; badges dedupe by slug and merge Verified/Verified Creator (`src/components/profile/ProfileCard.tsx`) - **DONE**
- [x] Badge row = up to 4 icon-only 44px pills (+N chip) opening a badge sheet with icon, name, description and "Earned <date>"; order Verified → Top 10 → founder → activity; the stray description bar that leaked "Posted your first vibe" under the row is removed - **DONE**
- [x] Numbers formatted (943 · 9,999 · 12.4K · 500K · 1.2M) for rizz/followers/following, rank shows "#1" with a trophy inside the top 10, and the Followers/Following stats are buttons opening real lists (50/page, skeleton, empty/error states, rows open profiles) - **DONE**
- [x] About me is normal weight with line breaks preserved and @mentions/links tappable; taller banner with a gradient fade into the card; avatar ring in the profile's accent color - **DONE**
- [x] "In this realm" shows the role chip in its role color plus "Joined realm <Month Year>" when the card knows the realm; realm chat and mention previews now pass realmId (4 call sites) - **DONE**
- [x] Others: Message primary, Follow/Following secondary, icon call button, mutuals (3 avatars + "and N more"), Block/Report/Mute in the "..." menu; own profile: outlined Edit profile + full-width View full profile (real secondary button, not faint text) - **DONE**
- [x] Skeleton refreshed, swipe-down close kept, 44px targets, `env(safe-area-inset-bottom)` padding, glass toast errors, graceful missing/blocked/deleted data; build green, tsc at the exact 47-error baseline - **DONE**

### Phase 17: Profile status bubble move (/u/:handle)
- [x] Mood bubble moved to top-right of the avatar, overlapping the banner (`left-[122px] top-2`, click-through wrapper, 380px-safe); two-dot tail points down-left to the avatar; presence dot stays bottom-right - **DONE**
- [x] Bubble truncates at ~60% width with ellipsis; others tap for a small popover with the full text; owner taps open the existing PresenceSheet (presence + mood picks + text + 1h/today/never expiry + Clear); dashed "Set status" placeholder for the owner when empty; nothing rendered for others without a status - **DONE**
- [x] Under @handle: muted custom-status line only when set; presence label for others; "You" label removed; invisible still reads as offline with status hidden - **DONE**
- [x] 160ms pop-in + subtle 5s float, both off under `prefers-reduced-motion`/`data-reduced-motion`; realtime updates via shared presence channel plus an expiry timer that clears the bubble without refresh; StatusIcon colors unified with presence tokens - **DONE**
- [x] tsc adds zero errors (47 pre-existing before/after), `vite build` exit 0 - **DONE**

### Phase 18: Account menu redesign (bottom sheet on phones, dropdown on desktop)
- [x] New `src/components/account/AccountMenu.tsx` replaces the old `ProfileMenu`: mobile bottom sheet (drag handle, dimmed backdrop, swipe-down/tap-outside close, safe-area) vs desktop dropdown anchored to the avatar, picked by the 768px breakpoint - **DONE**
- [x] Header card (banner thumb, avatar + presence dot, name, @handle, custom status, Rizz/Followers stats with skeletons) opens the profile card; Status submenu has Online/Idle/DND/Invisible with dots + hint descriptions, custom-status row opening the existing PresenceSheet, and Clear when set - **DONE**
- [x] Groups: [View profile, Edit profile, Saved, Badges, Leaderboard] with live Saved/Badges counts; [Switch account (≤3 `rizz-accounts` on device + Add account, Current tag) → sign out + `/login`, Copy profile link]; [Settings (Appearance stays a section inside Settings, no separate row), Help & feedback dialog]; [red Sign out with inline "Sign out of @handle?" confirm, also applied to the drawer dialog] - **DONE**
- [x] "Effects (Soon)" removed from the menu and the mobile drawer; Effects now lives only in Settings with a Soon badge; unreleased-feature rule documented by example - **DONE**
- [x] 48px rows, aria labels/expanded/checked, keyboard-navigable desktop items, glass toasts, best-effort stats that hide (never break) on missing data; tsc identical to baseline, `vite build` exit 0 - **DONE**

### Phase 19: Status sheet rebuild + surfaces
- [x] Rebuilt `PresenceSheet`: sticky header (handle + "Set status" + X always visible, content scrolls under it); emoji picker expands inline under the input (max-h 220px, own scroll — never clipped); lime Smile toggle instead of the yellow glyph; 80-char input; kept presets, 1h/4h/today/never expiry, Cancel/Save footer, Clear - **DONE**
- [x] Picker shows the cat-emoji set first, then a standard emoji grid (6/row, 44px targets); picked emoji previews in the lime toggle - **DONE**
- [x] New `StatusDotButton`: tap/long-press the online dot opens a popover with status + custom status + "Clears in Xm/Xh / Stays on until cleared"; empty state shows "No custom status set", never broken; invisible still reads as offline - **DONE**
- [x] Surfaced everywhere listed: profile page (under @handle, already) + tappable avatar dot; mini profile cards (shared ProfileCard, already); avatar menu Online row now shows the custom text; voice tiles show status next to the display name + tappable dot - **DONE**
- [x] tsc identical to baseline, `vite build` exit 0 - **DONE**

### Phase 20: Game Activities shelf + room sync
- [x] `src/data/games.json` registry (hub / room-link / embed) + `src/lib/activities.ts` (types, room-code gen, `?room=CODE` URLs, `useRoomActivity` over realtime broadcast + presence — no migration, late joiners sync) - **DONE**
- [x] Controller (Gamepad2) button in the voice-room header; `ActivityShelf` bottom sheet grid; `ActivityPanel` sandboxed iframe (side panel desktop, full-screen overlay mobile, minimize/close, End-for-everyone for starter/host); `JoinGameBanner` for members + toast; hub room-code helper with copy-invite + QR (graceful offline fallback) - **DONE**
- [x] Voice keeps running (provider-owned engine, panel is a sibling); `docs/ADDING_A_GAME.md` — one JSON entry per game - **DONE**
- [x] tsc identical to baseline, `vite build` exit 0 - **DONE**

### Phase 21: Games actually load + black media stage
- [x] Root cause: `games.example.com` / `draw.example.com` never resolved (verified http=000) and the embed slot was a `PASTE_…` placeholder — no code could load them. Registry now ships verified-working URLs (Jackbox.TV hub, skribbl.io room-link, 2048 embed — all HTTP 200, no framing headers, titles confirmed) - **DONE**
- [x] New `sharedCode` entry flag (default true = launcher code drives same-room joins for self-hosted hubs/clones; false = third-party sites where the code lives externally, with honest helper copy instead of a fake code); one-line URL swap points any entry back at a self-hosted deploy - **DONE**
- [x] Panel hardened: sandbox extended to forms/popups/modals (real games need logins + fullscreen; stated deviation from the original string), open-in-new-tab button so a framing-blocked host never strands you, shelf probes each URL (no-cors) and flags dead ones "Unreachable" - **DONE**
- [x] `MediaViewer`: pure black backdrop (was 85% + blur) + body scroll/overscroll lock while open, restored on close; zoom/pan/dismiss untouched - **DONE**
- [x] tsc identical to baseline, `vite build` exit 0 - **DONE**

### Phase 22: Realm lag fixes + games page + settings categories + music section
- [x] Realm chat renders newest 80 messages with "Show earlier messages" paging (was unbounded AnimatePresence + per-row queries); member list was already capped - **DONE**
- [x] `StatusDotButton` subscribes to presence only while its popover is open (was one live query per voice tile); voice settings sheet mounts content a frame after open; settings reorganized into Devices/Microphone/Volume/Members tabs with one tab mounted at a time - **DONE**
- [x] Game panel mounts ONE iframe (was side + overlay both loading the game = double audio/CPU); `/games` page lists the registry with cat-emoji `GameIcon`s, Play launches into the live call or opens solo games externally; Games added to nav + shelf "Browse all games" link - **DONE**
- [x] Music: header Music icon button opens the music section (now-playing + transport + queue + skip/clear); in-call tile is now a compact icon entry point; blocked-banner retry moved into the sheet; audio engine untouched - **DONE**

### Phase 23 (partial, in tree): status-to-avatar + canonical 5-badge set
- [x] Banner status pill removed; avatar gets bottom-left emoji badge + bottom-right tappable dot; `StatusPill` (rounded-full, no tail) under @handle on profile + mini cards, `+ Set status` for owner, popover with expiry for others - **DONE**
- [x] Canonical badge set lib (`rare/epic/mythic` + cat icons + tier glows), `BadgeIcon` everywhere, `BadgeRow`/ProfileCard filter to the 5, post chip renamed Main Character, `no-cap` replaces `verified_creator` for verification - **DONE**
- [ ] `20261022000000_fix_realm_reaction_toggle.sql`, `20261022010000_bot_embed_templates.sql` and `20261023000000_badge_set_v2.sql` proven in PGlite but NOT yet applied in Supabase — old badge rows stay invisible until applied; companion removal + /badges rebuild + share image still open
