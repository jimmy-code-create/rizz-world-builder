# Web Slinger — profile effect

A cinematic, looping profile effect: a masked web-slinger looms out of the
dark behind the avatar, webbing reaches in from the edges, a spider sigil
burns behind the hero at the climax, and the whole thing loops without a seam.

The character is **original work**. It is a masked web-slinger in the
red-and-blue spider aesthetic, drawn from scratch as bezier paths in this
repository. No Marvel, Sony or Disney assets, models, textures or reference
imagery are used, referenced or required — so the effect can ship without
carrying anyone's licence.

---

## What ships

| File | What it is |
| --- | --- |
| `public/effects/fx-web-slinger.json` | **The effect.** A Lottie file, 512×512, 30fps, 240 frames (8s loop), ~80 kB. |
| `public/effects/fx-web-slinger-frame.svg` | A still of the hero moment, generated from the same scene. |
| `public/effects/fx-web-slinger-contact.svg` | The still on a dark and on a light background, with the avatar disc drawn in place. |
| `public/effects/preview.html` | A standalone preview page: the effect on dark and light, at full size, small and tiny. |
| `scripts/effects/web-slinger-lib.mjs` | The drawing primitives: path parser, keyframes, gradients, trim paths, shape builders. |
| `scripts/effects/web-slinger-scene.mjs` | The scene: the character, the web physics, the particles, the lighting, the timeline. |
| `scripts/effects/web-slinger-svg.mjs` | Renders any frame of the scene as a static SVG. |
| `scripts/build-web-slinger-effect.mjs` | Builds every output above. |
| `scripts/check-web-slinger-effect.mjs` | Validates the Lottie by playing it through lottie-web, frame by frame. |
| `src/components/profile/WebSlingerEffect.tsx` | The React player the app uses. |
| `src/lib/effects.ts` | The two catalogue entries: `deco-web-slinger` and `fx-web-slinger`. |

## Commands

```bash
npm run effects:build   # rebuild the Lottie, the still and the contact sheet
npm run effects:check   # validate the file by rendering every frame
```

The build is deterministic: same source, same bytes.

---

## The scene

Fourteen layers, back to front. Each one is a separate Lottie shape layer, so
any of them can be re-timed or re-coloured without touching the others.

| Layer | What it does |
| --- | --- |
| `stage` | The dark stage, its cold pool of light and its warm counter-light. Carries the slow camera push-in. |
| `haze-back` | Colour clouds drifting on the far parallax plane. |
| `backlight` | A cold pool of light behind the mask. A dark figure on a dark stage is invisible; this is what makes the silhouette read. |
| `emblem-back` | The spider sigil, which flares at the hero moment. |
| `web-back` | Strands that reach in from the edges, drawn on with a trim path. |
| `hero` | The character: a tilted mask, glowing lenses, rim light, the web texture. |
| `web-line` | The line the hero swings on. |
| `shockwave` | The ring that lands with them. |
| `web-front` | Strands that spread outward at the hero moment. |
| `particles-back` / `particles-front` | Motes on closed orbits, so the loop closes exactly. |
| `hero-light` | A specular sweep across the suit. |
| `bokeh` | Out-of-focus foreground dust. |
| `grade` | The vignette that focuses the centre. |

### The timeline (240 frames, 30fps)

| Frames | Beat |
| --- | --- |
| 0–34 | Darkness. The strands draw on from the edges. |
| 34–112 | The hero swings in on a web line, rotating as they come. |
| 112–132 | They land. The web line retracts, the shockwave ring expands. |
| 120–168 | The hero moment: the sigil flares, the front strands spread, a light sweeps the suit. |
| 168–240 | Idle — a breath, drifting motes — then the scene returns to its opening state. |

Every animated property ends on the value it started with, so frame 240 is
frame 0 and the loop has no seam.

---

## Discord: what actually works

**Discord's profile effects are a Shop feature, and the official way to get
one is to buy it.** The help centre documents no user upload path: you buy an
effect in the Shop, then apply it from *User Settings → Profiles → Change
Effect*. There is no public REST API for uploading a profile effect, and no
supported way for a third party to publish one into a user's profile.

What *is* true, and what this asset is built for:

- Discord's profile effects are **Lottie animations**. That is the format the
  client plays, and `fx-web-slinger.json` is a Lottie file.
- The same file is what the RIZZ app plays, through `lottie-web`, so the
  effect in the app and the effect on Discord are one asset.

### To use it on Discord

1. Open the effect in a Lottie player and confirm the loop:
   `public/effects/preview.html`.
2. Apply the effect's size and frame rate to your design. This one is
   **512×512, 30fps, 8 seconds, looping** — a square canvas, because Discord
   draws the avatar disc in the middle of it.
3. Export the Lottie with the same settings bodymovin uses: shapes only, no
   expressions, no raster images, no masks with unsupported features. This
   file already avoids all of those: it is pure vector, and it uses no effect
   layers, so it renders in the simplest possible player.
4. Upload it through the profile effect upload in the Discord desktop client,
   where the client exposes it, and apply it from *Change Effect*.

**The honest caveat:** because Discord has no public upload API, step 4 is a
client-side action that has to be done in the app, and distribution to other
users still goes through the Shop. This repository can produce the file; it
cannot publish it for you. If you want the effect in the Shop, it has to go
through Discord's own submission process.

### If a different Discord surface is meant

Discord also accepts Lottie for animated **stickers** and **emoji** (as
`.json` or the gzipped `.tgs`). Those use the same file, but the canvas and
the framing change: a sticker wants a square canvas with the character
centred and a safe margin, and a 128×128 emoji wants the character to fill
the frame. The scene is built on a 512 grid, so either is a re-frame of the
same source rather than a redraw.

---

## Using it in the RIZZ app

The effect is registered twice in `src/lib/effects.ts`:

| Slug | Type | Where it plays |
| --- | --- | --- |
| `deco-web-slinger` | avatar decoration | Behind the avatar, the way Discord draws a profile effect. The lenses peek out at the upper left. |
| `fx-web-slinger` | profile effect | At the left of the profile banner, so the hero looms behind the avatar that overlaps it. |

Both are behind the global `COSMETICS_ENABLED` killswitch in `src/lib/effects.ts`.
That flag is currently `false`, so nothing renders until it is turned on — the
effect is wired and ready, but it stays hidden while cosmetics are paused.

### Performance

- The player only loads the animation when the effect scrolls into view
  (`IntersectionObserver`), and the file is fetched once and cached by the
  browser.
- It is vector, so it stays sharp at any size and costs nothing to resize.
- `prefers-reduced-motion` holds the hero moment instead of looping it.
- The player is loaded on demand (`await import("lottie-web")`), so it never
  lands in the main bundle.

---

## Editing the effect

Everything is in `scripts/effects/web-slinger-scene.mjs`:

- The character is four bezier paths — `HEAD`, `LENS_LEFT`, `LENS_RIGHT`,
  `TORSO`, `ARM_RAISED`, `ARM_LOW` — written as ordinary SVG path strings and
  parsed into Lottie geometry by `web-slinger-lib.mjs`.
- The web strands are bezier paths with a **trim path**, which is what makes
  them draw on and retract. The physics is the curve and the easing, not a
  simulation.
- The particles are closed orbits: the last keyframe of each mote is written
  back to its first, so the loop closes exactly.
- The lighting is gradients over stacked ellipses, so it renders identically in
  the Lottie player and in the SVG still.

After any change:

```bash
npm run effects:build
npm run effects:check
```

`effects:check` loads the file into the real player, steps through all 240
frames, and fails if a frame throws, if a shape's tangents do not match its
vertices, if the file is over 300 kB, or if the scene is missing its layers.
