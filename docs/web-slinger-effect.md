# Web Slinger — the one profile effect

A masked web-slinger crouched on a strand, lenses lit, both hands throwing
web. The scene is **transparent inline SVG**: the character, the strand, the
web lines, two energy trails and a handful of motes. There is no stage, sky,
city, floor, card or badge behind it — the profile's own banner shows through
and around the art.

The character is **original work**, drawn from scratch as vector paths in
`src/components/profile/WebSlingerEffect.tsx`. No Marvel, Sony or Disney
assets, models or reference artwork are used. No image-generation provider was
available for this pass, and none was faked: the shipped artwork is the
hand-authored vector scene, not a generated bitmap and not a placeholder.

---

## What ships

| File | What it is |
| --- | --- |
| `src/components/profile/WebSlingerEffect.tsx` | The scene: character geometry, lighting, webs, particles, and the placement/motion shell. |
| `src/components/profile/ProfileEffect.tsx` | The profile-effect layer. Renders the Web Slinger for its slug and nothing for anything else. |
| `src/styles.css` | `.wsx*` animation rules (breath, sway, strand draw, lens pulse, motes) with reduced-motion and calm fallbacks. |
| `src/lib/effects.ts` | The catalogue — exactly one entry, `fx-web-slinger` — plus equip/acquire/fetch. Stale database rows are filtered out. |
| `src/routes/_app/effects.tsx` | The single-effect showcase and equip/remove control. |
| `supabase/migrations/20261029000000_web_slinger_only.sql` | Seeds the effect row (for the uuid foreign key) and retires the old catalogue. |
| `tests/web-slinger-effect.test.mjs` | Guards transparency, the removed effects, the integration and the motion fallbacks. |

No binary asset is required. Nothing is fetched at runtime for the effect, so
there is no asset URL, CDN dependency or loading failure to handle: if React
renders, the art renders.

## Transparency

- The `<span>` host paints nothing. The `<svg>` paints nothing. There is **no
  `<rect>` covering the canvas** and no gradient behind the figure.
- Every gradient is attached to a suit panel, lens, strand or trail shape.
  The only `rect` in the scene is a clipped fabric-weave pattern inside the
  torso; it is transparent outside the weave lines.
- The preview surface on `/effects` and the real banner on a profile are the
  app's own surfaces. The asset never supplies one.
- The host is `pointer-events: none` and `aria-hidden="true"`, and it sits in
  the banner layer. Avatars, names, buttons, menus and links stay clickable.

## Composition

- 640 × 360 viewBox, figure centred, full body visible from mask to boots.
- The hand strands and the strand under the boots intentionally run past the
  viewBox; the SVG paints with `overflow: visible`, so they reach the edges of
  a wide banner instead of ending in mid-air. The banner's own `overflow:
  hidden` keeps the excess inside the header.
- Red suit with a deep-red gradient, blue side panels, blue forearms and
  shins, red gloves and boots. Black web lattice clipped to the mask, torso
  and thighs; dashed stitching along the seams; a fabric weave on the torso.
- White lenses with a blue bevel, catchlights and a soft bloom that pulses
  inside the mask.
- Cool rim light from the upper right and a warm red rim on the left, applied
  to the shared silhouette paths.
- Thin white strands extend from both hands; a taut strand runs beneath the
  crouch. Subtle red and blue energy trails sit behind the figure, plus small
  glowing motes and two four-point sparks.
- The small chest mark is an original ink spider, not an official logo.

## Motion

One seamless loop, built from CSS keyframes in `src/styles.css`:

| Element | Behaviour | Period |
| --- | --- | --- |
| Figure | breath from the feet, ±2 px | 8 s |
| Strands | gentle sway around each hand | 7 s / 8.5 s |
| Strand draw | extend, hold, settle; closes on its start | 11 s |
| Lenses | soft pulse | 5.5 s |
| Chest mark | soft pulse | 6.5 s |
| Motes | slow drift and twinkle | 9–14 s |
| Trails | slow dash flow | 7 s / 9 s |

No shaking, flashing or sudden jumps. The loop's first and last frames hold
the same values, so it restarts without a seam.

### Reduced motion and low-performance devices

- `prefers-reduced-motion: reduce` removes every animation and shows the
  fully-drawn still (strands visible, motes at rest).
- A device reporting ≤ 2 logical cores or ≤ 2 GB memory gets the same still
  through `data-calm="true"`, detected in `prefersStillFrame()` and updated
  live when the OS preference changes.
- An `IntersectionObserver` pauses every animation while the banner is off
  screen (`data-visible="false"`).
- Only transforms and opacity are animated; the filters are small and static.

## Profile integration

`src/routes/_app/u.$username.tsx` renders the effect **after** the banner's
bottom gradient, so the feet and the strand are not dimmed:

```tsx
<div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
{eq?.profile_effect && <ProfileEffectVisual slug={eq.profile_effect.slug} />}
```

The banner already clips its children, so the scene stays inside the effect
layer and cannot cover the identity row. The avatar, name, bio, badges and
actions are untouched. On a 160 px-tall mobile banner the hero is ~122 px tall;
on a 224 px-tall desktop banner it is ~170 px, centred with the webs reaching
toward both edges.

## Equipping it

`/effects` is no longer a coming-soon page. It shows the effect at banner size
with the avatar disc in place, and the owner can equip or remove it:

1. `equipEffect(userId, "fx-web-slinger", "profile_effect")` writes the local
   fallback immediately (so the owner sees the change on this device).
2. It then resolves the database row by slug — `user_profile_effects.effect_id`
   is a uuid foreign key — and upserts `equipped = true`.
3. `fetchEquippedEffects` reads that row for visitors and only accepts slugs
   that still exist in the catalogue, so a retired effect can never reappear.

Apply `supabase/migrations/20261029000000_web_slinger_only.sql` to make the
effect visible to other members. Without it, equipping still works on the
owner's device and the toast says so; nothing throws a raw PostgREST error.

## Verify

```bash
bun tests/web-slinger-effect.test.mjs
bun tsc -b --noEmit
```

Then, in the running app:

1. Open `/effects`; the scene plays inside the banner preview.
2. Press **Equip on my profile**, open your profile: the hero sits in the
   banner, the avatar and name are unobstructed, and every button still works.
3. Enable **Reduce motion** in the OS: the scene becomes a still with strands
   drawn.
4. Resize to phone width: the figure stays centred and complete.
5. Right-click/inspect the scene: there is no background element and no
   `<img>`; the host is `pointer-events: none`.

## Optional painted upgrade

The art shipped here is final, hand-authored vector work. No image-generation
provider was available in this environment, so no generated raster is claimed
or used. If a painted still is wanted later, this is the brief for an external
image tool:

> A full-body original masked web-slinger in a dynamic crouching, web-shooting
> pose: detailed crimson and deep-blue suit, fine black web lattice, white
> angular eye lenses, subtle fabric weave and visible stitching, balanced
> heroic proportions, crisp silhouette. Cinematic cool rim light from the
> upper right, a soft warm red rim on the left, thin white web strands leaving
> both hands, restrained red and blue energy trails and a few glowing motes.
> Character centred and complete in frame. **Transparent background** — a PNG
> or WebP with a real alpha channel, 1024 × 1024, no background, floor, city,
> card, frame, text, watermark or official logos. Original design, do not copy
> any existing superhero artwork.

That raster would need its own integration pass: the current loop animates SVG
parts (figure breath, strand draw, lens pulse), which a flat image cannot do
without a separate rig.

## Editing the art

Geometry lives as plain path constants at the top of
`WebSlingerEffect.tsx` (`HEAD`, `TORSO`, `ARM_RIGHT`, `SHIN_LEFT`, …). Keep the
canvas at 640 × 360 and the feet near `y = 324` so the character stays on the
strand. The rim-light `<use>` list must include any new silhouette path.
Animation belongs in the `.wsx*` section of `src/styles.css`; keep the first
and last keyframes identical so the loop stays seamless.
