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
- [x] Companion removed (widget, preference, settings toggle, CSS); `/badges` rebuilt on the 12-badge set with share image - **DONE**
- [ ] `20261022000000_fix_realm_reaction_toggle.sql`, `20261022010000_bot_embed_templates.sql` and `20261023000000_badge_set_v2.sql` proven in PGlite but NOT yet applied in Supabase — old badge rows stay invisible until applied

### Phase 24: Message long-press lag
- [x] Root causes: two racing 320ms long-press timers per press (row + menu trigger = double vibrate + double open) and 80 mounted Sheet/Popover portal trees per channel - **DONE**
- [x] `MessageActionMenu` takes `detectPress` (realm rows opt out; double-tap/context-menu/keyboard untouched) and mounts its overlay only for the open row (open animation intact); DMs/groups unchanged - **DONE**

### Phase 25: Award-a-badge redesign (from your screenshot)
- [x] Fixed the exact error you hit: handle lookup is case-insensitive (`Jimmy` finds `@jimmy`, LIKE wildcards escaped) - **DONE**
- [x] Award card matches the app: uppercase Admin label, live preview (big glowing cat icon + name + tier chip + flavor from the DB row), lime chips, pill input + lime Award - **DONE**

### Phase 26: Image uploads in posts
- [x] Composer image button (preview + remove + uploading state, 50MB/type guards); backend + feed already supported images, only the picker was missing; image-only posts allowed - **DONE**

### Phase 27: Custom badge art, Discord-style display
- [x] Five hand-drawn SVG badge icons (crown, clapperboard, mic, bolt, verified seal) with tier glows — no prompt emojis, no generic lucide; rendered via `CustomBadgeArt` everywhere badges show (rows, card pills + sheet, award preview, Main Character chip) with tooltips like Discord - **DONE**
- [x] Migration + PGlite test updated to art keys and re-proven

### Phase 28: Badge share image
- [x] Share button now generates a branded 1080x1350 PNG (near-black, lime accents, tier glow, app fonts via `document.fonts`, rasterized live badge SVG, avatar + name + @handle + unlocked date) — Web Share with file on mobile, download fallback; user-cancel silently ignored - **DONE**

### Phase 29: One loading screen
- [x] Single `AppLoader` (brand mark + lime bar, reduced-motion safe) for the auth gate + both route transitions; ambient lazy chunks already mount with null fallbacks; orphaned mascot splash deleted - **DONE**

### Phase 30: Boot splash de-catted
- [x] Cold-start splash drops the lime-cat SVG + "server cat" copy for the brand loader (logo + lime bar, neutral status copy, retry kept) - **DONE**

### Phase 31: Games hub — built-in games, overlay over voice
- [x] Three in-app games (Pixel Arena `.io` arena, Neon Snake vs 3 rival AIs, Pixel Rally solo/Duo) on a shared `useArcade` canvas/input/stats loop — no iframe, no sign-up, fullscreen - **DONE**
- [x] `/games` rebuilt as the hub (live-in-voice strip, filters, search, badges, real "Play in call"/"Play now" behaviour); the in-call gamepad button opens it - **DONE**
- [x] `VoiceActivityOverlay`: game as the background, translucent voice dock on top (speaking rings, camera tiles, mute/deafen/leave, room code, collapsible); desktop keeps `ActivityPanel` as the voice-first side panel; `ActivityShelf` removed - **DONE**
- [x] `src/lib/activities.ts` merges built-ins + JSON web games and shares ONE realtime channel per room (store + per-consumer playing flags) — fixes the multi-subscribe/removal race; `source: "builtin"` activities skip iframes and room codes - **DONE**
- [x] `scripts/arcade-check.ts` (`bun run arcade:check`) found and fixed two real bugs: an unbeatable CPU in Pixel Rally and the duo-mode key mismatch - **DONE**
- [x] 12 more games (15 built-in total): Chess (depth-3 engine + perft-verified rules), Checkers (forced longest captures), Connect Four, Tic-Tac-Toe (perfect), Reversi, 2048, Minesweeper, Sudoku (unique-solution generator), Memory Match, Breakout, Neon Void (shooter), Reaction Rush — rules in `src/lib/games/*`, boards via `board-frame.tsx` - **DONE**
- [x] hub filters for Action / Board games / Puzzles; `bun run games:render` renders every registered game; `arcade-check` grew to 60+ assertions (chess perft 8902, mate-in-one, etc.) and caught a double-merge bug in the 2048 engine - **DONE**

### Phase 31: Story Reactions & Haptic Feedback (components created, integration pending)
- [x] Instagram-style StoryReactions component with 6 emoji bar (❤️ 😂 😮 😢 🔥 👏), animated slide-up, author reaction counts, quick reaction button (`src/components/story/StoryReactions.tsx`) - **DONE**
- [x] Comprehensive haptics utility with 6 patterns (light/medium/heavy/success/error/selection) and specialized functions for all interactions (`src/lib/haptics.ts`) - **DONE**
- [x] Story reactions library with React Query hooks, optimistic updates, real-time subscriptions, and aggregation functions (`src/lib/story-reactions.ts`) - **DONE**
- [x] 6-week feature roadmap with 17 major features across engagement, monetization, growth, creator tools, and advanced features (`FEATURE_ROADMAP.md`) - **DONE**
- [x] Integration: the inline viewer reaction row + reply form are replaced by one shared `StoryFooter` (`src/components/story/StoryReactions.tsx`): IG-style quick-reaction row (6 emoji, selected = lime tint, emoji floats up on tap), round "Send message" pill, like heart and paper plane; the reply form is gone from `StoriesStrip` and the duplicate reactions query/realtime channel with it (`useStoryReactions` owns both, with optimistic add/remove and rollback) (`src/components/StoriesStrip.tsx`, `src/lib/story-reactions.ts`) - **DONE**
- [x] Author side of reactions: Story insights now has a per-emoji reaction summary and each viewer row shows the emoji that person left, via the new `useStoryReactors` hook (author-only read, matching the `story_reactions_select` policy) - **DONE**
- [x] Story timer pauses while the reply pill is focused, so typing never advances the story - **DONE**

### Phase 32: Haptic pass + voice/app lag
- [x] Haptics: `haptic()` is now SSR-safe (no `navigator` reference on the server), collapses repeats inside 90ms with a priority order (a send/reaction/error pulse may follow a generic tap; a tap never re-fires), and `installGlobalTapHaptics()` adds ONE capture-phase pointerdown listener (`button`, role button/menuitem/tab/switch, `nav a`) mounted once in `AppShell` — every control in the app ticks without touching hundreds of call sites (`src/lib/haptics.ts`, `src/components/AppShell.tsx`) - **DONE**
- [x] Patterns where they carry information: `hapticSend` on DM and realm-chat send, `hapticVoiceJoin`/`hapticVoiceLeave` in the call provider, error haptics already on the glass toast (`src/routes/_app/dm.$userId.tsx`, `src/routes/_app/r.$slug.tsx`, `src/components/voice/VoiceCallProvider.tsx`) - **DONE**
- [x] Voice lag root cause: `speakingIds` (recomputed every 180ms while anyone talks) lived in the main call context, so the call bar, both audio components, the provider children and every bot card re-rendered on each audio tick; it moved to `VoiceSpeakingContext` and only `<SpeakingTiles>` subscribes, so an audio tick re-renders the participant grid and nothing else (`src/components/voice/VoiceCallProvider.tsx`, `src/components/voice/VoiceCallView.tsx`, `src/components/voice/VoiceActivityOverlay.tsx`) - **DONE**
- [x] Call view: `Set` lookups for speaking/sharing instead of `Array.includes` per tile, memoised `videosByPeer`/`sharingParticipants` moved above the early return (they were hooks after `if (!call) return null`), and `transition-all` on tiles/avatars narrowed to `transition-colors` so border+shadow stop animating on every state change (`src/components/voice/VoiceCallView.tsx`) - **DONE**
- [x] App-wide: React Query defaults (`staleTime` 30s, `gcTime` 5min, `refetchOnWindowFocus: false`, `retry: 1`). Previously every remount/tab switch refetched the feed, inbox and leaderboard, and a failing query retried three times — both read as the app hanging (`src/router.tsx`) - **DONE**
- [ ] Not covered yet: `/drops` and the arcade timers still `setState` once a second (page-scoped), and the call view still re-renders on its own state changes (settings sheet, chat) — the next step is splitting those panels into their own components - **OPEN**

### Phase 33: Audit pass — dialogs, links, voice, reactions
- [x] One shared `<ConfirmDialog>` (`src/components/ui/confirm-dialog.tsx`) built on the existing responsive overlay: bottom sheet with a drag handle on phones, 420px card on desktop, async confirm with a spinner, destructive tone, closing only on success. It replaces every `window.confirm` (delete comment, delete account, regenerate webhook secret, revoke webhook bot) (`src/components/PostCommentsSheet.tsx`, `src/routes/_app/settings/account.tsx`, `src/components/bots/WebhookBotsSection.tsx`) - **DONE**
- [x] Chat/post links: `break-all` + `text-sky-400` → `break-words` + `text-primary`, so URLs stop splitting mid-word and links use the brand lime instead of an unrelated blue (`src/components/PostCard.tsx`, `src/routes/_app/u.$username.tsx`, `src/routes/_app/r.$slug.tsx`, `src/routes/_app/dm.$userId.tsx`, `src/routes/_app/g.$id.tsx`) - **DONE**
- [x] Voice: a speaking tile is a lime border plus a 2px avatar ring — no colored glow, no infinite `animate-ping` halo (the brand forbids glow); pre-join actions are sentence case with matching label sizes ("Join voice", "Open text chat") (`src/components/voice/VoiceCallView.tsx`, `src/routes/_app/r.$slug.tsx`) - **DONE**
- [x] Reaction chips readable on a phone: 28px tall, 15px emoji, 12px count, stronger unselected surface, lime text when it is mine, glow replaced by a ring (`src/components/chat/ReactionChips.tsx`) - **DONE**
- [x] Feed side discussion no longer uses `100vh` (clipped under the mobile URL bar) — now `100dvh` (`src/components/FeedSideDiscussion.tsx`) - **DONE**
- [ ] Integration: Add haptic feedback throughout app (buttons, sends, reactions, voice, story transitions) - **PENDING**

### Phase 34: Share / forward, inbox deep links, voice menus, media speed
- [x] One share/forward layer for every surface: `src/lib/share-to-chat.ts` routes a draft to `direct_messages`, `group_messages` or `messages` (default text channel) with no schema change, and `src/components/share/ShareToChatSheet.tsx` is the single picker (searchable People / Groups / Realms, per-row tick, "Sent to …" toast). Wired into: every post's Share button, every reel's Share action, and Forward on DM, group and realm messages (media messages forward their attachment too) - **DONE**
- [x] Voice menus actually open: `RealmMusicHub` / `RealmGamesHub` / `MusicSheet` / `GameLauncher` now sit at `z-160/170`. At the sheet default `z-100` they opened **behind** the full-screen call (`z-130`), so the gamepad and music buttons in the call header looked dead - **DONE**
- [x] Call chrome: removed the radial lime wash behind the header and the coloured shadows on primary buttons; header actions are compact 36/40px icon buttons with 44px hit areas so five actions fit at 360px - **DONE**
- [x] Voice moderation: the host can remove someone from the call. `kickFromCall` broadcasts `voice-kick` on the call's roster channel; the target verifies the sender against the room's host id, leaves, and sees a notice. Participant popover (volume / mute for me / Remove from call) renders it only for the host (`VoiceCallProvider`, `VoiceCallView`) - **DONE**
- [x] Bots are removable and restorable: MUSIC BOT dismissal stops its audio (`setMusicBotDismissed` unmounts the player) and leaves an "Add MUSIC BOT" chip with the `/play` hint; GAME BOT remove leaves the game and the same chip restores the card - **DONE**
- [x] Media/GIF speed: chat images are `loading="eager"` + `fetchPriority="high"` (they are the message — lazy loading waited for an observer tick), GIF/sticker images likewise. A GIF/sticker-only message is detected by `isOnlyMediaMarker()` and rendered as media — no lime bubble, no caption padding (this is the oversized green card around GIFs in DMs) - **DONE**
- [x] Reaction rows fit: the row is `w-full max-w-full` so `flex-wrap` can actually wrap inside the shrink-to-fit message column (chips used to run past the bubble and clip in DMs/groups/realms); chips are 32px tall, 8px radius, 44px hit areas, six visible then `+N` - **DONE**
- [x] Mentions: one Discord-style inline pill across the whole `@name` (`padding 1px 3px`, `margin 0 -1px`, `box-decoration-break: clone`), no more underline-only or half-covered highlight; removed the duplicate later rule that overrode it - **DONE**
- [x] Mention and bot-command popups scroll on phone and desktop: the slash menu keeps a visible thin scrollbar, momentum scrolling and a taller cap (`52dvh`); the mention list is a single scrolling panel with a thin bar instead of a nested double scroller - **DONE**
- [x] Inbox: a new **Messages** tab lists unread DM threads (avatar, last body, count) and links to `/dm/:id?message=<id>`; realm/group mention notifications now resolve `data.source` + `message_id` (realm slug fetched once per page) and link to the exact message. The three chat routes accept `?message=`, scroll the row into view and hold a lime ring for 2.4s (`notifications.tsx`, DM/group/realm routes) - **DONE**
- [ ] Not covered yet: DM/group message notifications are not *generated* for people who have the inbox closed (that needs an `after insert` trigger on `direct_messages`/`group_messages` writing to `notifications`); the inbox lists unread DMs from the existing rows instead. Mention notification settings per surface also still live only in push prefs - **OPEN**

### Phase 35: Realm settings entry + full channel manager
- [x] Dedicated **Settings** shortcut on every "My realms" card (`/realms`), as a sibling control above the card's full-card link — no nested buttons, 32px chip with a 44px row. The realm header gear and the options sheet still work; this makes the settings page reachable without opening the realm first (`src/routes/_app/realms.tsx`) - **DONE**
- [x] `/r/$slug/settings?section=channels` deep link: the settings route validates `?section=` (falls back to Overview for an unknown value), so "Rename, reorder or delete channels" in the realm's Rooms dialog lands on the channel manager instead of the top of the page (`src/routes/_app/r.$slug_.settings.tsx`, `src/routes/_app/r.$slug.tsx`) - **DONE**
- [x] Channels rewritten as a real manager: a collapsible **Create a channel** composer with all four kinds (Text / Voice / Forum / Announcement), private-at-create support, Enter-to-create; each channel is a compact card (kind icon, name, Default badge, private lock, topic + slowmode summary) that expands into name/topic/slowmode/private fields with Save, Open channel and Delete (`src/routes/_app/r.$slug_.settings.tsx`) - **DONE**
- [x] **Delete channel** is new and guarded: `deleteRealmRoom` was defined but never called. Deletion uses the shared `ConfirmDialog` (bottom sheet on phones), states clearly that the channel's messages go with it (`messages.realm_room_id` is `ON DELETE CASCADE`), and is blocked for the default channel, the last channel and the last text channel. On success the cache drops `realm-rooms`, `realm-channel-calls` and the realm row, and the editor closes - **DONE**
- [ ] Not covered yet: the Rooms dialog on the realm page still only toggles "Mods only" — it links to the channel manager for everything else rather than duplicating rename/delete in a second place - **OPEN**

### Phase 36: Flat chats, share cards, mention colour, member-safe realms
- [x] DMs and group chats dropped their bubbles: both now render through one shared `MessageRow` (`src/components/chat/MessageRow.tsx`) — avatar, author name in the readable palette colour, time, then the text on the app background, exactly like realm chat. The centred time pills, `chat-bubble` classes, `w-fit` shrinking columns, per-side alignment and the glass typing bubble are gone; the older-messages button and typing line got the row's side padding so all three surfaces align (`dm.$userId.tsx`, `g.$id.tsx`) - **DONE**
- [x] Mention highlight is one customisable Discord-style chip: `--rizz-mention-color` drives a filled pill (colour pulled 72% toward ink, label 24% toward white, `box-decoration-break: clone` so a wrapped mention stays rounded). Settings → Preferences gains the colour picker **plus six presets** (Discord, Rizz lime, Rose, Sky, Amber, Cream) and a live preview that uses the exact chat recipe; the default is Discord blurple (`src/styles.css`, `src/routes/_app/settings/preferences.tsx`) - **DONE**
- [x] Story text can be moved while typing: a "Drag to move" grip plus a four-way nudge pad sit above the open text editor (the caret used to swallow every pointer event, so the words could not be dragged at all). Dragging commits the text and hands the layer to the normal pinch/rotate drag; nudges move 2% of the stage per tap (`src/components/StoryComposer.tsx`) - **DONE**
- [x] Shared posts and reels render as real cards everywhere: `src/components/chat/SharedPostCards.tsx` resolves a `/p/<id>` permalink into a dark card (media reserved at 16:9 for video, 4:3 for photos, author row, play badge) and is mounted in DM, group and realm rows; the raw URL is stripped from the text with `withoutShareLinks()` so the same link never prints twice, and link previews skip internal permalinks. Validated by `src/lib/share-links.ts` - **DONE**
- [x] The "send to…" picker gained categories and app-wide people search: All / People / Groups / Realms tabs with counts, and `searchShareProfiles()` (debounced 250ms, `ilike` on username + display name, 20 results) so a post can be sent to someone you have never messaged — the row IS a new conversation (`src/components/share/ShareToChatSheet.tsx`, `src/lib/share-to-chat.ts`) - **DONE**
- [x] Bot embeds are flat black rectangles: `#0b0b0c` panel, squared 8px corners, hairline border, full-width media and stacked full-width cards; card buttons are 36px rounded rectangles instead of lime pills (`src/components/chat/Embed.tsx`) - **DONE**
- [x] Realm settings moved inside the realm: the per-card Settings shortcut is gone from `/realms`, so settings are reached from the realm header gear or its options sheet (`src/routes/_app/realms.tsx`) - **DONE**
- [x] Members see only what they can use: realm settings shows **Overview** and a new **Leave realm** section (with a confirm sheet; owners are pointed at hand-over/delete instead) and hides Channels, Roles, Members, Moderation, Bans, Invites, Bots, Audit and Danger. The realm options sheet hides Moderation, Channels & permissions and Bots, and the New-room button is gone for members — all re-checked server-side by the existing RLS/RPC rules (`r.$slug_.settings.tsx`, `r.$slug.tsx`) - **DONE**
- [ ] Not covered yet: a permalink-only message (a shared reel with no caption) has no drag target of its own, since the card is the whole message — long-press actions live on the card instead - **OPEN**

### Phase 37: Knock Knock — ask if someone is around before you type
- [x] "App open" is now measurable instead of guessed: `ping_presence()` only moves `last_seen_at` (never the status the user picked) and an open tab calls it every two minutes plus on every return to the tab, so an idle account with the tab closed no longer looks like one watching YouTube in another window (`supabase/migrations/20261106000000_knock_knock.sql`, `src/lib/presence.ts` now selects `last_seen_at`) - **DONE**
- [x] One verdict, four honest answers: `knockMood()` reads the presence row and the timestamp into **Live now** / **Around, away** (app open, nobody at the keyboard) / **Do not disturb** / **App closed · last seen 12m ago**, and the DM header's passive "Active now" line is replaced by the verdict pill that IS the doorbell (`src/lib/knock.ts`, `src/routes/_app/dm.$userId.tsx`) - **DONE**
- [x] Knocks are delivered and answerable: `knocks` (one row, one answer, readable by both sides only) plus `send_knock` / `respond_knock` / `mark_knocks_seen`; sent in both-directions-blocked refusals and rate limited per person (one per 30 seconds, fifteen per hour) so it stays a doorbell and not a mash button - **DONE**
- [x] The doorbell rings wherever you are: `KnockDoorbell` sits in the app shell, animates in at the top of the layout (clear of the composer, the mobile nav and the in-call bar), plays its own two-thud knock that respects Do not disturb, and offers the three answers a person gives — "Open the door" also walks you into the conversation (`src/components/knock/KnockDoorbell.tsx`, `src/lib/notification-sound.ts`) - **DONE**
- [x] A knock is part of the conversation: cards are merged into the DM timeline in order (and trailing when a knock is newer than every message), the thread card shows `Seen 👀` / the answer for the sender, and opening the thread marks the door seen (`src/components/knock/KnockThreadCard.tsx`, `dm.$userId.tsx`) - **DONE**
- [x] Knock from anywhere a name shows: the DM header pill, the profile card's action row and the full profile, all opening one sheet with the verdict, four preset knocks and an optional note (`src/components/knock/KnockControls.tsx`, `ProfilePreview.tsx`, `u.$username.tsx`) - **DONE**
- [ ] Not covered yet: knocks are 1:1 only (no knock into a group or realm), and they are in-app — the OS push path still only carries messages and mentions. The migration has to be applied to Supabase before the doorbell is live; until then `send_knock` reports the migration name and everything else degrades quietly - **OPEN**

### Phase 38: Calm receipts, squared bounties, recreated badges
- [x] Toasts are receipts, not announcements: `<GlassToast />` is a content-width ink pill (12.5px title, 6px type dot, no accent rail, no icon medallion) instead of a full-bleed glass banner, errors are the only type that keeps a glyph, and the host holds at most two at once (`src/components/ui/GlassToast.tsx`, `src/components/ui/sonner.tsx`) - **DONE**
- [x] They also leave sooner: 2s success, 2.4s info, 3.2s warning, 4.5s error (5s with an action), and identical calls already merge into one card, so a burst of confirmations can't pile up over the page (`src/lib/toast.tsx`) - **DONE**
- [x] Bounty page speaks one shape language: every CTA is a 40px squared `rounded-lg` button (`Top Paws`, quest `Go` / `Share`), the `🪙` empty state and the `✓ Claimed` text glyph are gone in favour of real icons, and a finished quest shows a `Done` chip instead of an empty right side (`src/routes/_app/drops.tsx`) - **DONE**
- [x] Quest "badges" recreated as achievement tokens: a squared tile with a hairline border, a top sheen and a lime corner tick when complete — shared by the quest rows, the Paws balance tile and the empty state, so nothing on the page is a round settings-pill anymore (`QuestEmblem` in `drops.tsx`) - **DONE**
- [x] The profile popup stops showing a void: a profile with no banner photo and no gradient now paints a branded fallback cover (lime sheen over ink, paper version in light mode) instead of flat `#141416`, on every surface that shares the header (`src/styles.css` `--profile-banner-fallback`, `ProfileHeader.tsx`) - **DONE**
- [x] Badge details never cover the buttons: `BadgeInfoPopover` gained a `sheet` layout (the app's shared bottom sheet / dialog, 44px mark, name, tier, rule) and the profile preview uses it, because a popover under the handle landed squarely on Message / Follow / Knock. The preview's action row also wraps now instead of crushing the Message label on a 360px screen (`BadgeInfoPopover.tsx`, `ProfilePreview.tsx`) - **DONE**
- [x] The installable app finally wears the brand: the PWA manifest's `theme_color` was `#6C4BFF` (generic purple leftover) with a `#12101A` splash — both are now the ink `#0a0a0b` that the rest of the shell uses (`public/manifest.webmanifest`) - **DONE**
- [ ] Not covered yet: badge marks themselves are unchanged — only how their details open. Reworking the badge art (the Purify crystal and friends) is a separate pass - **OPEN**

### Phase 39: The Purify animation introduces the page
- [x] The advert ships with the app (`public/purify/purify-intro.mp4`, 1920×1080 H.264, 5s, 10 MB) and plays the first time `/purify` opens in a visit: full-screen portal (so it covers the mobile nav and header), the wordmark above the frame, a lime progress line under it, and `PurifyIntro` in `src/components/purify/PurifyIntro.tsx` - **DONE**
- [x] It is an introduction, never a gate: tapping the backdrop and the always-visible **Skip** both close it, Escape works, it autoplays muted (the only autoplay browsers allow) with an opt-in sound toggle, and it plays **once per session** — `sessionStorage` remembers, so a member comparing benefits does not sit through it again - **DONE**
- [x] Members who asked for less motion never get an autoplaying film: `prefers-reduced-motion: reduce` skips the automatic open entirely, and a blocked autoplay (iOS Low Power Mode) falls back to the same poster-and-play-button state the replay path uses (`shouldAutoPlayPurifyIntro()`) - **DONE**
- [x] Replay on demand: a **Watch the intro** chip in the hero reopens it, so the animation is part of the page rather than a one-off popup (`src/routes/_app/purify.tsx`) - **DONE**
- [x] The art is swappable in one place: `PURIFY_INTRO_SRC` is the only path the component knows, so a new render dropped at `public/purify/purify-intro.mp4` needs no code change, whatever its length or aspect ratio - **DONE**
- [ ] Not covered yet: the clip is 10 MB and loads when the page opens. That is fine for a 5s brand film on the one page that sells the subscription, but if mobile data matters more than fidelity, the 3.4 MB / 8s source clip (`wan2.6-t2v_…`) is the lighter alternative — swap the file, change nothing else - **OPEN**

### Phase 40: One emoji button, the realm crash, and a call that answers on time
- [x] The two smileys became one control: the realm's custom emoji (and its Manage editor) now live **inside** the emoji tab of the composer's picker, so standard emoji, this server's own emoji, GIFs and stickers are all behind the same button and the second `SmilePlus` button is gone. The picker takes an optional `realmId` — posts, reels and DMs keep the free emoji/sticker/GIF tabs they had (`src/components/GifPicker.tsx`, `src/routes/_app/r.$slug.tsx`) - **DONE**
- [x] The realm page crash (minified **React #310**) was a hook after an early return: the mention deep-link effect sat below the loading/not-found returns, so the skeleton passage ran fewer hooks than the loaded one and `/r/<slug>` threw the moment the realm arrived. The effect now lives with the other hooks, above those returns (`src/routes/_app/r.$slug.tsx`) - **DONE**
- [x] The call surface stopped re-rendering at audio rate: the provider owns the engine, so every speaking-level change re-rendered the whole 1.6k-line call view (grid, chat, bot panels, stage). `VoiceCallView` is now `memo`-bound and only `<SpeakingTiles>` reacts to levels (`src/components/voice/VoiceCallView.tsx`) - **DONE**
- [x] Roster events coalesce instead of stampeding: joining, muting or leaving writes several `voice_participants` rows at once, and both realtime listeners invalidated their queries per row — which re-rendered the realm screen and the call bar while the finger was still on the button. Each burst now collapses into one refetch (350ms in the call, 400ms in the realm rail) and the timers are cleared on teardown (`VoiceCallProvider.tsx`) - **DONE**
- [x] Participant long-press survives a hold on Android: tiles are `select-none`, so the browser no longer starts a text selection (and takes the touch away) before the 320ms press lands - **DONE**
- [ ] Not covered yet: a **Reel Party** (watching a reel together in a voice call with synced playback) does not exist. Reels are a page of their own, and the party side of the app is games (Draw Party rooms, the Party/Jam categories in the Games hub); the reel player has no shared-playback state at all, so this is a feature to build rather than a switch to flip - **OPEN**
- [ ] Not covered yet: `tests/voice-rerender.test.mjs` counts the renders the `memo` boundary saves using jsdom, which is declared in `package.json` but not installed in this workspace — the guard skips with a note here and runs wherever jsdom is present, so the change is reasoned from the code path rather than profiled on a device - **OPEN**
