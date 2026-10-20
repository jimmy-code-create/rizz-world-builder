# Cinematic profile effects

The effects gallery is now a four-piece cinematic collection cut from one
supplied reel. The old avatar-decoration / nameplate catalogue and its
placeholder thumbnails are gone from `/effects`.

| Effect | Slug | Source segment | Price |
| --- | --- | --- | --- |
| Web Slinger | `fx-web-slinger` | 5.2s–14.8s | $4.99 (rights review) |
| Sakura Bloom | `fx-sakura-bloom` | 15.2s–24.8s | $2.99 |
| Arcane Nexus | `fx-arcane-nexus` | 25.2s–34.8s | $3.99 |
| Sakura Storm | `fx-sakura-storm` | 35.2s–44.8s | $3.49 |

## Assets

`public/effects/cinematic/` contains, for each effect:

- a **VP9 WebM with a real alpha plane** (`yuva420p`, `ALPHA_MODE=1`);
- a **1600×480 RGBA PNG poster** taken from the same loop.

The video canvas is 1600×480. The effect occupies the central 853×480
(16:9) and the sides are transparent, so a member's banner image still shows
through on a profile. The clips are 24fps and about 9.6 seconds, with a
0.25-second alpha fade at each end so the loop breathes rather than cuts.

The source reel is **not committed**. The build uses `CINEMATIC_SOURCE` (or
the default development path) and writes only the finished assets.

## Mattes

The source reel had a baked checkerboard behind the cherry and spider takes,
and a Gemini watermark in the lower-right of the arcane take.

- **Cherry:** a saturation/luma matte (`sat > 0.19 && lum < 228`), component
  cleanup, small-hole filling, a 3×3 alpha blur, and a very light procedural
  rose halo. The halo is deliberately restrained: the source already carries
  a delicate petal trail, and a heavy glow turned grey over light banners.
- **Spider:** a body matte (`sat > 0.12 || lum < 140`), speck cleanup, hole
  filling, a close/erode pass to remove the bright checker rim, and neutral
  highlights cleaned to cool white. The source's web strands are intentionally
  not extracted: they are transparent over the checkerboard and carried the
  pattern into the overlay. The close-up pose and the landing still read.
- **Arcane:** alpha is derived from the brightest channel, with a threshold
  that clears the checker/noise floor and an unpremultiplied RGB pass so the
  glyphs keep their neon colour. The lower-right watermark is cleared by
  rectangle, outside the ring.
- The small lower-right corner is also cleared on the other clips, so no
  watermark survives on any poster or frame.

## Build and verify

```bash
CINEMATIC_SOURCE=/path/to/source.mp4 npm run effects:build-cinematic
npm run effects:check-cinematic
```

The checker verifies VP9, 1600×480, `ALPHA_MODE=1`, the 9.4–9.9s duration,
and the matching RGBA poster. It does not need the source reel.

## Preview behaviour

- The effects page stage plays the **actual loop**. Grid cards use poster
  frames from that same loop, not a different static illustration. The stage
  crops to the effect's 16:9 area; the profile preview shows the full 1600×480
  banner placement.
- The player renders the poster first. The video fades in only when it can
  play; a failed load, blocked autoplay, or an unsupported browser leaves the
  real poster visible rather than a black rectangle.
- Chromium-family browsers use the VP9 alpha video. Safari and Firefox
  currently keep the poster because a reliable alpha video path could not be
  verified for them here.
- `prefers-reduced-motion` or the member's reduced-motion preference shows the
  poster. The stage badge changes to "Still preview".
- Only one video is mounted on the gallery stage, and videos pause when they
  leave the viewport. The profile banner plays one loop.

The gallery's **Preview on profile** link opens
`/u/<username>?previewEffect=<slug>`. The banner labels the result as a
preview and renders it even while the cosmetics killswitch is off. Opening the
link never equips the effect.

## Buy sheet and checkout

The buy sheet is honest about what is wired:

- `COSMETICS_ENABLED` is still `false`. The sheet therefore offers a per-effect,
  on-device save-for-launch marker and does not charge while unlocks cannot be
  equipped. There is no server-side launch list yet.
- A single `VITE_EFFECTS_CHECKOUT_URL`, or per-effect
  `VITE_EFFECTS_CHECKOUT_WEB_SLINGER`,
  `VITE_EFFECTS_CHECKOUT_SAKURA_BLOOM`,
  `VITE_EFFECTS_CHECKOUT_ARCANE_NEXUS`, and
  `VITE_EFFECTS_CHECKOUT_SAKURA_STORM` links can be set at build time. When
  cosmetics are enabled and a link is present, the sheet opens a real
  checkout in a new tab.
- There is **no entitlement webhook** in this repository yet. A completed
  checkout does not automatically write `user_profile_effects`; that sync still
  needs a provider webhook or a server-side fulfilment job. Do not advertise
  automatic unlocks until it exists.
- The **Web Slinger** clip is supplied Spider-Man footage. It is marked
  `rightsReview: true` in `src/lib/cinematic-effects.ts`; the buy sheet is
  locked for it regardless of checkout configuration. Clear the rights before
  selling it. Do not describe it as original RIZZ art.

## Source and rights

The four clips are cut from the Google Drive reel supplied for this build.
The cherry and arcane takes are the supplied generated footage; the spider
take is a recognizable third-party character. The project's earlier "original
art only" rule does not apply to this supplied reel, and the spider effect
must not be presented as original art. Review the rights for every clip before
publishing or charging for it.
