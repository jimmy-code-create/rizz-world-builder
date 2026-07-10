## Goal
Make equipped effects visible everywhere, add a nightclub-style animated canvas across the app, fix reel/post uploads, and dramatically expand the effects catalog.

## 1. Fix uploads (posts + reels)
- Investigate current failure by reading `src/lib/owner.functions.ts` (`createPostValidated`) and the reels composer path — user says "don't know what problem is coming", so I'll reproduce via Playwright, capture the exact server error, and fix root cause.
- Common suspects to verify and harden:
  - `media_type` enum vs DB check constraint (`"none"` may not be allowed on inserts with a `media_url`).
  - Numeric fields (`like_count`, etc.) using `int4` — ensure server never sends counts; DB defaults handle it.
  - Storage path length / filename sanitization.
  - Auth bearer middleware attached for `createPostValidated`.
- Return **clear user-facing messages** for: file too large, unsupported type, storage upload failure, validation failure, unauthorized.
- Apply the same validated path to the reel composer (currently may bypass `createPostValidated`).

## 2. Effects everywhere with unified timing
One shared hook + one shared wrapper so every surface renders effects identically:
- Use existing `useEquipped(userId)` on: `PostCard` (done), `StoryComposer`/story ring, `StoriesStrip` avatars, reels overlay author, `IncomingCallRinger` caller avatar, DM header + message bubbles, profile hero, comments, mentions, follow suggestions.
- Standardize animation timing via CSS custom properties in `styles.css` (`--fx-duration`, `--fx-ease`) so nameplates/rings/glows all pulse in sync.
- Nameplate + AvatarDecoration used consistently (replace raw `<Avatar>` usages on the surfaces above).

## 3. Nightclub animated canvas
- New `<NightclubCanvas />` mounted once in `AppShell` behind content:
  - Layered animated gradient blobs (pink/violet/cyan) with slow drift.
  - Subtle grain + light-beam sweeps using CSS `@keyframes` (GPU-only transforms/opacity).
  - Respects `prefers-reduced-motion` and the profile `reduced_motion` flag.
- Route-scoped motion polish (framer-motion):
  - Feed: stagger post cards on mount.
  - DM: message enter animation + typing indicator shimmer.
  - Profile: hero parallax on scroll, avatar float.
- Zero layout shift; canvas is `position: fixed; inset: 0; z-index: -1; pointer-events: none`.

## 4. Expand effects catalog to 1000+
- Generate programmatically in a single migration:
  - **Avatar decorations (~400):** ring styles × color palettes × rarities (neon, aurora, fire, holo, sakura, electric, ice, toxic, sunset, galaxy, etc. × 40 palette variants).
  - **Nameplates (~300):** gradient/animated text presets (gold, vapor, mythic, chrome, ember, ocean, matrix… × variants).
  - **Profile effects / gifts (~300):** background auras, particle overlays (hearts, sparkles, snow, confetti, embers, bubbles, stars, lightning) × color variants.
- Each row: `slug`, `name`, `type`, `rarity`, `unlock_rizz`, `preview_color`, `description`. All CSS-driven — no image assets required.
- Rendering: extend `AvatarDecoration` / `Nameplate` / `ProfileEffect` to resolve slugs via a small pattern map (prefix → CSS class + CSS var color), so 1000 rows share ~30 base animations parameterized by color.
- Owner panel: bulk-assign any effect/badge to a user (already scaffolded — just wire the new catalog).

## 5. Verification
- Playwright: log in, upload an image post, upload a video reel, publish a story, open DM, trigger a call — screenshot each and confirm no errors + effects visible.
- Confirm build passes and no console errors on `/feed`, `/reels`, `/dm/:id`, `/u/:username`.

## Technical notes
- No schema breaking changes; effects insertion is additive with `ON CONFLICT (slug) DO NOTHING`.
- Nightclub canvas is pure CSS/SVG — no new deps.
- Upload fix: any DB-side fix goes through a migration; app-side fixes go in `owner.functions.ts` + reel composer.

## Question before I start
The 1000+ effects will be procedurally generated variants (e.g. "Neon Ring · Cyan", "Neon Ring · Magenta", …) sharing base animations. That's the only realistic way to hit 1000+ without shipping thousands of custom assets. OK to proceed with that approach?
