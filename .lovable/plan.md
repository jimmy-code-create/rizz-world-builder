## Goal
Make RIZZ genuinely mobile-first: every desktop feature reachable on phone, canvas + reels + call screen fully touch-friendly, and kill the upload/integer error.

## 1. Mobile parity for every desktop feature
Right now the desktop sidebar exposes 12 sections (Feed, Reels, Explore, Groups, Channels, Giveaways, DMs, Saved, Effects, Badges, Top, Labs) but the mobile bottom bar only shows 4. Fix:
- Keep the bottom bar at 5 core tabs (Feed, Reels, +, DMs, Explore) but swap the last slot for a **"More" sheet** (bottom `Sheet` from shadcn) that lists **all** sidebar items + Profile + Settings + Sign out with the same icons.
- Add the same **New post** and **notifications** entries inside the sheet header, plus the profile card.
- Move the search bar into a full-width tap target that opens `/explore` with the input focused.

## 2. Story canvas (`StoryComposer.tsx`) mobile fixes
- Lock canvas to `aspect-[9/16]` with `max-h-[calc(100dvh-8rem)]` and `touch-none` so gestures don't scroll the page.
- Fix pinch/rotate: pointer capture on the overlay, `touch-action: none` inline, prevent `preventDefault` errors on passive listeners.
- Bigger tap targets (44px min) for toolbar buttons; make the toolbar horizontally scrollable with `overflow-x-auto no-scrollbar snap-x`.
- Trash zone: move to top-right on mobile so it doesn't fight with the OS home bar; fade in only while dragging.
- Text overlay: switch double-tap to single-tap on mobile (double-tap zooms the page on iOS Safari); use `inputMode="text"` and blur on Enter.
- Persist draft to `localStorage` so accidental route change doesn't nuke the story.

## 3. Reels mobile UX (`routes/_app/reels.tsx`)
- Rebuild the side-action rail as **thumb-reachable**: right-edge, `bottom-32`, 56px hit areas, iconography with count under each (Like, Comment, React, Share, Save, More).
- Wire **Like** button to `toggleLike` with optimistic count + heart burst; wire **Comment** to open a bottom `Sheet` with the existing comments component; wire **React** to the emoji popover; wire **Save** to bookmarks.
- Ensure vertical snap works: `snap-y snap-mandatory h-[100dvh] overflow-y-scroll` on the reel list, each item `snap-start h-[100dvh]`.
- Mute button + top control bar collapse into a single translucent pill on mobile.
- Double-tap the video to like (with heart animation).

## 4. Call screen mobile polish (`call.$userId.tsx`)
- Switch layout to `h-[100dvh]` grid: remote video fills, self-view PiP draggable within safe-area, control dock pinned above `env(safe-area-inset-bottom)`.
- Buttons: 64px circular, spaced for thumbs, with haptic-style press animation.
- Hide the desktop-only side chat panel on mobile; expose it via a "Chat" button that opens a sheet.

## 5. Upload "integer" error
Symptom the user described ("text integer SMTH problem on uploading") most likely comes from Postgres complaining about the caption length or a numeric column overflow during `createPost`. Fix:
- Add client-side guards in `PostComposer` + `StoryComposer`: caption capped at 600 (already), enforce **file size numeric as Number**, and coerce any width/height metadata we send to `Math.round(...)` before insert.
- Wrap `createPost` and story insert in try/catch that surfaces the real Postgres message via `toast.error(err.message)` instead of the generic one so we can see the exact failing column if it recurs.
- If the DB has an `int4` counter that can overflow (e.g. `like_count`, `view_count`), migrate it to `bigint`. I'll inspect the schema first turn of build mode and, if needed, ship a single migration converting overflow-prone counters to `bigint` with matching GRANTs untouched.

## 6. Small "more interesting" polish
- Add a floating **quick-actions FAB long-press** on mobile: hold the + to reveal Post / Story / Reel / Go Live.
- Animate bottom nav active tab with a pill highlight (framer-motion `layoutId`).
- Add pull-to-refresh on Feed and Reels using a simple `overscroll-behavior` + touchstart delta.

## Files to touch
- `src/components/AppShell.tsx` — More sheet, mobile parity, active-tab pill, long-press FAB.
- `src/components/StoryComposer.tsx` — gesture + layout + text overlay fixes.
- `src/routes/_app/reels.tsx` — action rail, sheets, snap, double-tap like.
- `src/routes/_app/call.$userId.tsx` — mobile layout, safe-area dock, chat sheet.
- `src/components/PostComposer.tsx` — better error surfacing on upload.
- `src/lib/posts.ts` — surface real error, coerce numerics.
- **Maybe** one Supabase migration if a counter column is `int4` and overflowing.

## Out of scope
- No visual redesign of the color system.
- No new backend features beyond the counter migration (if needed).
