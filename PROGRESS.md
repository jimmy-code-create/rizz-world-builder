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
- [ ] Item 1: Eliminate double "X" close buttons across dialogs, sheets, and drawers (`src/components/ui/dialog.tsx`, `src/components/ui/sheet.tsx`, `src/components/reactions/PostReactionsSheet.tsx`) - **PARTLY**
- [ ] Item 2: Remove unwanted lime outline borders from reaction popups and post cards; preserve subtle `#2a2a2e` border (`src/components/reactions/PostReactionsSheet.tsx`, `src/components/posts/PostCard.tsx`) - **PARTLY**
- [ ] Item 3: 8-color deterministic avatar palette for users without profile photos based on username hash (`src/components/ui/avatar.tsx`) - **NOT DONE**
- [ ] Item 4: Markdown formatting (bold `**`, italic `*`, inline links `[text](url)`) in user bio and post bodies (`src/lib/markdown.tsx`, `src/components/posts/PostCard.tsx`, `src/components/profile/ProfileView.tsx`) - **NOT DONE**
- [ ] Item 5: Center "+" action button styled with `#c8ff3d` lime circle, black icon, 44px tap target, active scale (`src/components/AppShell.tsx`, `src/components/navigation/MobileNav.tsx`) - **PARTLY**

### Phase 2: Compact Spacing & Account Menu
- [ ] Item 6: Compact spacing tokens, gutters (12px mobile, 16px desktop), 12px card padding, 44px action hit area, conditional translate button, slim trending pill, drops header polish (`src/index.css`, `src/components/posts/PostCard.tsx`, `src/components/trending/TrendingBar.tsx`) - **NOT DONE**
- [ ] Item 7: Account menu: 248px width, right-aligned, `#141416` background, 14px radius, compact 40px/44px rows, expandable inline status picker (no truncation), inline "Sign out?" confirm (`src/components/AppShell.tsx`) - **PARTLY**

### Phase 3: Avatar Interactions
- [ ] Item 8: Universal `InteractiveAvatar` component: tap = open story or navigate to profile; long-press 450ms = full photo lightbox viewer with pinch-to-zoom and swipe-down dismiss; zero browser callout menus (`src/components/ui/avatar.tsx`, `src/components/posts/PostCard.tsx`, `src/components/comments/CommentList.tsx`) - **PARTLY**

### Phase 4: Voice Chat Polish
- [ ] Item 9: Dedicated `VoiceSettingsSheet` with working mic sensitivity sliders, noise suppression toggle, input/output device pickers, and live mic test meter (`src/components/voice/VoiceSettingsSheet.tsx`, `src/components/voice/VoiceCallView.tsx`) - **PARTLY**
- [ ] Item 10: Real audio-driven speaking lime glow rings, labeled control bar, persistent docking mini-player, WakeLock screen API, and exponential backoff auto-reconnect (`src/components/voice/VoiceCallBar.tsx`, `src/components/voice/VoiceCallView.tsx`, `src/lib/voice-room-audio.ts`, `src/lib/webrtc.ts`) - **PARTLY**

### Phase 5: Loading & Shimmer Animations
- [ ] Item 11: Fast boot splash with recolored lime mascot (`public/cats/peek.svg`, `src/components/LimeCatSplash.tsx`), inline CSS/SVG fallback, animated peek, and progressive timeout messages at 4s / 8s / 12s - **PARTLY**
- [ ] Item 12: 1.4s smooth shimmer skeleton loaders, staggered list entrance rise animation, and blur-up lazy image placeholders (`src/components/ui/skeleton.tsx`, `src/index.css`, `src/components/posts/PostCard.tsx`) - **NOT DONE**

### Phase 6: Voice Room Activities
- [ ] Item 13: Server-authoritative architecture proposal using Supabase Realtime broadcast & presence; gamepad activity trigger button and minimizable bottom panel (`src/components/voice/VoiceActivities.tsx`) - **NOT DONE**
- [ ] Item 14: Interactive voice activities: Sketch & Guess It, Chess (`chess.js` + server clock sync), Pixel Board & Pixel Pong (`src/components/voice/activities/`) - **NOT STARTED**

### Phase 7: Final Regression Checklist
- [ ] Item 15: Cross-surface verification: no console errors, mobile touch targets >= 44px, accessibility tags, prefers-reduced-motion compliance, zero purple gradients - **NOT STARTED**
