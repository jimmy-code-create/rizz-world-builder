# Phase 8 — Upload debugging, smoother app, mobile canvas fixes

## 1. Reel upload debug panel (owner-only)
- Every upload step (validate file, storage upload, get public URL, insert post) gets a step name, timestamp and a generated request ID.
- On failure the toast keeps the friendly message; the full trace (request ID, failing step, raw backend message and status) is kept and shown in an owner-only debug drawer.
- Drawer opens from the Owner Control Room (RIZZ logo, password) and from a small badge on the reel/post composer that only the owner/admin sees.
- Copy-to-clipboard button for the whole trace.

## 2. Text-only posts
- The post composer already allows text-only. The reel editor gets a "text reel" mode that renders the caption over a gradient and uploads that, so nothing forces you to pick media.

## 3. Delete all content + hide raw IDs
- Delete every post, reel, story and their child rows (likes, comments, reactions, bookmarks, hashtag links, views) for your account.
- Sweep the UI so no raw UUID is ever shown as text — profiles, groups, DMs and share links use usernames, slugs or short codes instead.

## 4. Remove Labs
- Delete the `/labs` route and its entries in the desktop sidebar, mobile "More" sheet, command palette and keyboard shortcuts.

## 5. Smoothness pass
- Lighter nightclub canvas on mobile, GPU-friendly transforms only, fewer simultaneous animations, capped stagger.
- Lazy-load feed media (`loading="lazy"`, `decoding="async"`); videos preload metadata only.
- Debounce realtime invalidations so a burst of events causes one refetch instead of many.
- Respect reduced-motion everywhere.

## 6. DM long-press + reply fix
- Long-press sheet gets reliable touch handling: no accidental trigger while scrolling, haptic feedback, no text selection.
- Reply becomes a real quoted-reply chip above the input instead of injecting `> text` into the box. Tapping a reply scrolls to the original message and highlights it with a fading glow.

## 7. Full-screen canvas fixes (from your screenshots)
- The story composer and the "Create reel" overlay currently render inside the app shell, so the RIZZ header and bottom nav bleed through and there are two close buttons.
- Both move to a true full-screen layer above the shell: one close button, safe-area padding, canvas sized to the real viewport, bottom toolbar always reachable, no nav overlap.
- The call screen gets the same treatment so controls never sit under the bottom nav.

## Technical notes
- Debug trace lives in a small client store (`src/lib/upload-trace.ts`), not persisted; owner gate uses `has_role(auth.uid(),'admin')` plus the existing password gate.
- Content deletion runs as a data operation scoped to your user id.
- Overlays use `createPortal` into `document.body` with `position: fixed; inset: 0` and `env(safe-area-inset-*)` padding.