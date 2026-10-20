# Web Slinger — profile effect

A masked web-slinger swings in on a web line, releases at the top of the arc,
flips, lands in a deep crouch and holds the perch before zipping out again.
The same character is used on two surfaces:

- a **512×512 avatar decoration** that sits behind the profile avatar, and
- a **1200×420 banner scene** that fills the profile banner.

The character is **original work**: a masked hero in the red-and-blue spider
aesthetic, drawn from scratch as bezier paths in this repository. No Marvel,
Sony or Disney assets, models, textures or reference imagery are used. This is
a RIZZ effect system, not a Discord Shop upload — see the Discord note below.

---

## What ships

| File                                             | What it is                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------- |
| `public/effects/fx-web-slinger.json`             | The avatar decoration. 512×512, 30fps, 240 frames (8s loop), ~148 kB.            |
| `public/effects/fx-web-slinger-banner.json`      | The banner scene. 1200×420, 30fps, 240 frames (8s loop), ~301 kB.                |
| `public/effects/fx-web-slinger-frame.svg`        | A still of the avatar scene, generated from the same layers.                     |
| `public/effects/fx-web-slinger-banner-frame.svg` | A still of the banner at the perch (frame 130).                                  |
| `public/effects/fx-web-slinger-contact.svg`      | The avatar still on dark and light surfaces with the avatar disc drawn in place. |
| `public/effects/preview.html`                    | A standalone preview page for a real browser.                                    |
| `scripts/effects/web-slinger-rig.mjs`            | The articulated character: joints, original art, FK helpers.                     |
| `scripts/effects/web-slinger-motion.mjs`         | Shared poses, the pendulum solve and the square-scene timeline.                  |
| `scripts/effects/web-slinger-scene.mjs`          | The avatar-decoration composition.                                               |
| `scripts/effects/web-slinger-banner.mjs`         | The banner composition, its timeline and its Lottie document.                    |
| `scripts/effects/web-slinger-lib.mjs`            | Path parsing, keyframes, gradients, trim paths, layer helpers, `lottieZOrder`.   |
| `scripts/effects/web-slinger-svg.mjs`            | Renders any frame of either scene as a static SVG.                               |
| `scripts/effects/web-slinger-poses.mjs`          | QA contact sheet for the avatar timeline.                                        |
| `scripts/effects/web-slinger-banner-poses.mjs`   | QA contact sheet for the banner timeline.                                        |
| `scripts/build-web-slinger-effect.mjs`           | Builds the avatar Lottie and its stills.                                         |
| `scripts/build-web-slinger-banner.mjs`           | Builds the banner Lottie and its still.                                          |
| `scripts/check-web-slinger-effect.mjs`           | Plays both files through lottie-web, frame by frame, and validates them.         |
| `src/components/profile/WebSlingerEffect.tsx`    | The React player and placement for both variants.                                |
| `src/lib/effects.ts`                             | Catalogue entries `deco-web-slinger` and `fx-web-slinger`.                       |
| `src/routes/_app/effects.tsx`                    | The Effects gallery, with a live preview stage.                                  |

## Commands

```bash
npm run effects:build   # rebuild both Lottie files, their stills and the contact sheet
npm run effects:check   # play both files through lottie-web, all 240 frames
```

The build is deterministic: same source, same bytes. `effects:check` needs the
dev dependency `jsdom`; it skips cleanly if `jsdom` is not installed.

---

## The rig

The character is a 2D cutout, not a single silhouette. Every limb is a separate
articulated group:

- joints: shoulder, elbow, wrist/hand, hip, knee, ankle, toe, neck;
- each limb has its own art (deltoid, glove, boot shaft, sole, toe cap, knee
  and elbow transitions, sheen and rim light);
- the chest hinges at the pelvis (`lean`), and the head hinges at the neck;
- absolute joint angles in body space are converted to nested Lottie rotations
  by `buildCharacter`.

Two FK helpers make contact exact instead of eyeballed:

- `sceneHand(pose, side)` / `sceneToe(pose, side)` — the point in scene space;
- `withHandAt(pose, side, point)` / `withToeAt(pose, side, point)` — solve the
  root position so the hand or toe lands on a point.

### The swing

The swing is a real pendulum, not a hand-drawn arc:

- anchor `[1080, -240]`, rope `340`, landing `[470, 380]`, ledge top `382`;
- the hand follows the pendulum and the root is back-solved from it, so the web
  line is always attached;
- the line itself is an animated path rebuilt at every keyframe;
- the banner camera pushes in from 0.45 to 0.9 across the swing.

### Poses

`hangPose`, `tuckPose`, `landingPose` and `perchPose` are shared by both
compositions. The landing is a deep asymmetric crouch with one hand planted on
the roof; the perch keeps one knee up, the other leg folded, and the head
scanning.

---

## The two timelines

Both are 240 frames at 30fps and close on the value they started with, so the
loop has no visible reset.

### Avatar decoration (512×512)

| Frames  | Beat                                                                                  |
| ------- | ------------------------------------------------------------------------------------- |
| 0–16    | Drops in on the line from above, settling with a small overshoot.                     |
| 16–30   | Lands at the left edge of the avatar, clear of the disc.                              |
| 30–190  | Holds the perch: breath, weight shift, head scans. One hand stays on the raised line. |
| 190–214 | Looks up, pulls on the line and zips out of frame.                                    |
| 214–240 | Empty stage; the loop restarts invisibly.                                             |

The head sits at the upper left, outside the avatar disc; the raised glove and
the web line arc over the top of the disc. Reduced motion holds frame 140.

### Banner (1200×420)

| Frames  | Beat                                                 |
| ------- | ---------------------------------------------------- |
| 0–28    | Hangs off the top-right corner, web line taut.       |
| 28–58   | Swings down across the frame on the pendulum.        |
| 58–78   | Releases at the top of the arc, tucks and rotates.   |
| 78–101  | Falls, rotates through 360°, reaches for the roof.   |
| 101–112 | Impact: crouch, hand plant, shockwave and dust.      |
| 112–190 | Perch, breath, scan; the emblem and city sit behind. |
| 190–200 | Looks up, shoots a new line.                         |
| 200–216 | Zips out along the line.                             |
| 216–240 | Empty stage; the loop restarts invisibly.            |

Reduced motion holds frame 130.

---

## Lottie notes (the parts that bite)

These are the conventions the builders and checker enforce:

- **Layer and shape-group arrays are top-to-bottom** in Lottie, while the scenes
  are built in painter's order (bottom-to-top). `lottieZOrder` reverses sibling
  groups and the layer array for the player, but keeps paint items (`sh`, `fl`,
  `st`, `tr`) in their required order — the fill belongs to the path above it
  and the transform must stay last. Without this, an opaque sky covers the
  whole scene and a torso hides its own emblem in the real player even though
  the static still looks right.
- **Animated 1D trim paths need an explicit `e` on every keyframe.**
  lottie-web's trim modifier reads the end value directly; without it the layer
  fails to build and takes the rest of the render down with it. `trim()` fills
  the end values in.
- Fill and stroke opacity are **0–100**. Gradient stop alpha is **0–1**.
  `shapeLayer` scale is a **percentage** (`100` = 1×).
- The checker does a two-tick seek before sampling the painted paths: lottie
  updates transforms on one tick and layer visibility on the next, so a single
  seek can make a layer that starts transparent look permanently hidden.

`effects:check` currently enforces:

- Lottie 5.x, 512×512 or 1200×420, 24–60fps, `ip` 0, 240 frames;
- at least 6 (avatar) / 8 (banner) layers;
- valid vertices and tangents, including animated shapes;
- more than 40 animated properties;
- at least 40 / 120 **painted paths** and 4 coloured gradient stops at frame 60;
- a file budget of 300 kB (avatar) / 380 kB (banner);
- all 240 frames render without throwing and the SVG has a viewBox.

---

## In the app

The effect is registered twice in `src/lib/effects.ts`:

| Slug               | Type              | Where it plays                                                                   |
| ------------------ | ----------------- | -------------------------------------------------------------------------------- |
| `deco-web-slinger` | avatar decoration | Behind the avatar, sized 1.9× the avatar and offset so the head clears the disc. |
| `fx-web-slinger`   | profile effect    | Fills the profile banner with `preserveAspectRatio="xMidYMid slice"`.            |

`WebSlingerEffect` picks the asset by `variant`, loads it on visibility, and
uses the reduced-motion frame instead of autoplaying when the user prefers
reduced motion. The player is loaded on demand (`await import("lottie-web")`),
so it stays out of the main bundle.

### Preview only

`COSMETICS_ENABLED` in `src/lib/effects.ts` is **false**. That means:

- neither effect can be equipped or worn on a real profile;
- the `/effects` gallery still shows both, because `AvatarDecoration`,
  `ProfileEffect` and `Nameplate` accept a `preview` prop;
- the gallery's equip/notify UI preserves the existing behaviour and says
  "Preview only".

Equip/unequip and persistence are **not reimplemented** by this effect; they
remain on the existing auth/backend path and only become reachable when the
killswitch is turned on. No Supabase migration is introduced by this work.

---

## Discord

Discord profile effects are a Shop feature. The help centre documents buying
and applying one, not uploading one; there is no public REST API for
publishing a profile effect. This asset is built for RIZZ's own effect system,
which plays Lottie through lottie-web.

If a Discord-compatible file is wanted later, the banner and avatar files are
pure-vector Lottie with no images, masks or effects, which is the portable
subset. Getting one into Discord still goes through Discord's own Shop and
submission process; this repository cannot publish it.

---

## Honest limitations

- **There is no browser in this development environment** (Termux, no
  Chromium). The animation was verified by playing both files through the same
  `lottie-web` build in jsdom for all 240 frames, and by rasterising SVG stills
  with `rsvg-convert`. That catches malformed Lottie, missing paints and
  timing/z-order failures, but it is **not** a substitute for visual QA in a
  real mobile and desktop browser. A final pass on real devices is still
  required.
- The art is a **stylized 2D cutout**, not a 3D render. At very large sizes the
  limb joints, gradient transitions and flat cutout construction are visible.
  It is designed to read at profile sizes (96px avatar, 160–224px banner).
- The banner is a **1200×420** composition. At the 2.2:1 mobile banner it crops
  the sides; at the 3.1:1 desktop banner it crops the top and bottom. The hero
  and the roof line are kept in the safe area, but the outer city is cropped by
  design.
- `fx-web-slinger.json` is an avatar decoration, not a Discord badge; wearing it
  on Discord is not supported by this work.

---

## Editing the effect

- Character art and joints: `scripts/effects/web-slinger-rig.mjs`.
- Shared poses and the pendulum/timeline: `scripts/effects/web-slinger-motion.mjs`.
- Avatar-composition layers: `scripts/effects/web-slinger-scene.mjs`.
- Banner-composition layers: `scripts/effects/web-slinger-banner.mjs`.
- QA stills: `node scripts/effects/web-slinger-poses.mjs` and
  `node scripts/effects/web-slinger-banner-poses.mjs` (they write to
  `${TMPDIR}/ws-poses` and `${TMPDIR}/ws-banner`).

After any change:

```bash
npm run effects:build
npm run effects:check
```

Then look at the stills and the two contact sheets before committing. The
checker cannot see composition, weight or timing; those still need eyes.
