# RIZZ badge prompts

Exact prompts for the 12 badges live in `src/lib/badge-set.ts`, written for the
flat-vector / Discord-legacy look. One prompt per badge, one locked line, one
negative prompt.

Paste the **shared block** first, then the badge prompt, then the locked line
you want. Keep a single chat session so "same style as the previous badge"
actually holds.

---

## Why the set reads as a set

Discord badges never rely on detail — at 20px beside a username there is room
for a silhouette and one cut-out symbol, nothing more. So each badge gets:

| Tier | Silhouette | Used by |
| --- | --- | --- |
| Common | plain shield / rounded hexagon | Newcomer, Chatterbox |
| Rare | laurel ring / faceted gem | Rising Star, Night Owl, Verified, 7 Day Streak |
| Epic | burst / crosshair ring / flared flame | Meme Lord, Bounty Hunter, 30 Day Streak |
| Legendary | laurel + gem composite, double edge | Top Rizzler, Game Champ |
| Mythic | winged crest, asymmetric | Early Supporter |

Rules that keep it from looking cheap:

- **One fill, one cut-out.** Two shapes maximum. No inner shadows, no facet
  shading, no glow, no bevel, no gradient — even a subtle one turns to mush at
  20px.
- **The cut-out must survive 20px.** Minimum 28px wide at 1024px, and it must
  read as the symbol by silhouette alone.
- **Nothing touches the edge of the shape.** 10% inner padding all round.
- **Optical centering, not mathematical.** Cut-outs sit 1-2% above true center.
- **Locked state is the same shape**, not a different render: same geometry,
  fill dropped to ~15% brightness, cut-out barely lighter.

---

## Shared block (paste once, then per badge)

```
Flat vector app badge icon, Discord legacy badge style — the plain, confident
kind, not a sticker and not a 3D medal.

One bold solid silhouette [SILHOUETTE], filled with a single flat color
[COLOR]. No gradient, no gloss, no highlight, no inner shading, no bevel, no
drop shadow, no outline, no stroke, no texture, no grain. Pure flat fill.

Inside the shape, one symbol in negative space: [SYMBOL], fully cut out so the
background shows through. The cut-out is crisp, simple, unmistakable as a
silhouette, at least 28px wide at 1024px, and sits 10% clear of the shape's
edges.

Geometry: geometric and deliberate, slightly rounded corners (about 8% radius),
straight clean edges, perfectly optically centered, generous padding, generous
negative space. Reads instantly at 20px. No detail that disappears when small.

Solid flat background #232428, filling the square. Square 1:1, 1024x1024.

No text, no letters, no numbers, no words, no border, no frame, no mockup, no
perspective, no reflection, no star sparkles, no confetti.
```

## Locked line (append to any badge prompt)

```
Same badge in its locked state: identical silhouette and identical cut-out,
geometry unchanged. The shape fill drops to a very dark desaturated tint of the
same color ([LOCKED_TINT], roughly 15% brightness), the cut-out only faintly
lighter than the background so the symbol is barely visible. Same flat
treatment — still no gradient or glow — on the same solid #232428 background.
```

## Negative prompt (append when the tool has a field for it)

```
3d, render, bevel, emboss, gradient, drop shadow, glow, bloom, glossy, plastic,
metallic, chrome, photo, texture, noise, sketch, hand-drawn, sketchy outline,
stroke, text, letters, numbers, watermark, logo mockup, perspective, isometric,
frame, border, low contrast, muddy, multiple shapes, busy detail
```

---

## The 12 badges

### 1. Newcomer — `rookie` · common · lime

Shield, chevron-forward cut-out. First badge: quiet, confident, no flourish.

```
Silhouette: a classic badge shield — flat top edge, sides that bow out slightly,
then taper to a soft point at the bottom third. Depth is about 1.15:1.
Color: lime green #C6FF1A.
Symbol: a single upward chevron arrow, thick and slightly rounded at the tips,
cut clean out of the shield a touch above center.
```

Locked tint: `#232917`

### 2. Chatterbox — `smooth-talker` · common · white

Rounded hexagon, speech bubble. The only near-white badge in the set.

```
Silhouette: a regular hexagon standing on a flat bottom edge, corners rounded
to about 8% so it reads as a hexagon and not a circle.
Color: soft off-white #F2F2F2.
Symbol: a rounded speech bubble cut clean out of the middle, with its tail
pointing down-left, 1:1 proportions, no lines inside.
```

Locked tint: `#2A2A2A`

### 3. Rising Star — `rising-star` · rare · gold

Laurel ring, star. Laurel = earned, so nothing else in the set reuses it at
this size.

```
Silhouette: an open laurel ring — two curved sprays of three chunky leaves each,
rising from the bottom center, meeting in a small gap at the top. Thick, simple
leaf shapes with no veining.
Color: gold #FFC93C.
Symbol: a four-point star (sharp vertical and horizontal points, concave sides)
cut out of a small solid disc at the center of the ring.
```

Locked tint: `#2A2415`

### 4. Night Owl — `night-owl` · rare · violet

Faceted gem, crescent. The gem is tall and narrow so it never reads as the
Rising Star.

```
Silhouette: a tall faceted gem — narrow flat crown across the top, two straight
shoulders angling in, coming to a sharp point at the bottom.
Color: violet #8B5CF6.
Symbol: a clean crescent moon cut out of the upper half, open side facing right,
tips tapered to fine points.
```

Locked tint: `#1E1730`

### 5. Meme Lord — `meme-lord` · epic · pink

Burst, grin. The only radiating shape in the set.

```
Silhouette: a twelve-point starburst, alternating long and short rounded points,
compact and even like a seal, points short enough that it never reads as a sun.
Color: hot pink #FF5FA2.
Symbol: a wide smiling mouth cut out of the center — a thick upward arc with two
short rounded corner ticks, no teeth, no eyes.
```

Locked tint: `#2A1A22`

### 6. Top Rizzler — `top-rizzler` · legendary · lime

Laurel + gem composite. The busiest silhouette in the set, and still only two
shapes.

```
Silhouette: a laurel wreath enclosing a gem — the two sprays from Rising Star
scaled up, closed into a near-circle, with the gem's pointed base forming the
bottom of the crest.
Color: lime green #C6FF1A.
Symbol: a single bold human-heart cut out of the gem's center face, wide lobes,
clean point at the bottom.
```

Locked tint: `#232917`

### 7. Verified — `verified` · rare · teal

Shield with a notched edge, checkmark. Must read as a checkmark at 20px, so no
circle behind it.

```
Silhouette: a compact shield with a shallow V notch cut into the top edge and a
pointed base, wider than it is tall (about 1.15:1).
Color: teal #2EE6C5.
Symbol: a single thick checkmark cut clean out of the shield, rising diagonal
then longer falling stroke, both ends cut square, slight round on the elbow.
```

Locked tint: `#152825`

### 8. 7 Day Streak — `streak-7` · rare · amber

Flame, cut-out numeral. Flames are readable as fire even at 16px, so keep them
clean and avoid inner flicker shapes.

```
Silhouette: one flame — broad rounded base, two asymmetric licks, the taller one
leaning right, tip tapered but blunt enough to survive scaling.
Color: amber #FFB020.
Symbol: the numeral 7 cut out of the flame's lower half — thick strokes, flat top
bar, diagonal descending leg, geometric and square-cut. Numerals only here, no
other text anywhere.
```

Locked tint: `#2A2215`

### 9. 30 Day Streak — `streak-30` · epic · crimson

Same flame family as #8 but flared and wider, so the pair reads as a progression
rather than a duplicate.

```
Silhouette: a flared three-lick flame, wider at the base than the 7-day flame,
outer licks curling outward, tip leaning slightly left.
Color: crimson #FF3B30.
Symbol: the numeral 30 cut out of the lower body of the flame — geometric
strokes, flat counter in the 0, tight tracking. Numerals only, no other text.
```

Locked tint: `#2A1717`

### 10. Bounty Hunter — `bounty-hunter` · epic · burnt orange

Crosshair ring, star core. Distinct from the burst because it is a ring, not a
solid mass.

```
Silhouette: a thick crosshair ring — a solid circular band with four short
straight tabs at 12, 3, 6 and 9 o'clock, ends cut flat, no centre cross lines.
Color: burnt orange #FF7A1A.
Symbol: a solid five-point star cut out of the ring's open center as a single
negative-space island, slightly larger than the ring's inner radius so it reads
as a star floating in the hole.
```

Locked tint: `#2A2015`

### 11. Game Champ — `game-champ` · legendary · gold

Laurel shield, controller face. Gold is deliberately reused from Rising Star —
legendary tier shares the metal, silhouette separates them.

```
Silhouette: a laurel-wrapped shield — a shield whose two side edges are formed
by the laurel sprays, leaves merging into the shield outline, pointed base.
Color: gold #FFC93C.
Symbol: a simple gamepad face cut out of the shield — a rounded horizontal
capsule with a plus-shaped D-pad on the left, two round buttons on the right,
no cable, no hands.
```

Locked tint: `#2A2415`

### 12. Early Supporter — `og` · mythic · lime

Winged crest. The only asymmetric, outward-swept shape — it should look like it
lands on the profile rather than sits on it.

```
Silhouette: a wing crest — a narrow central shield core with one swept wing on
each side, three stacked tapered feathers per wing, wings angled up and outward,
tips sharp, base solid.
Color: lime green #C6FF1A.
Symbol: a five-pointed spark cut out of the shield core, one long point up and
two short points down, geometric and thin-free.
```

Locked tint: `#232917`

---

## Swap-in variants (ideas from the brief that are not in the live set)

Use these only if you are renaming badges. Each keeps the same shared block,
locked line and negative prompt.

**Den Founder — hexagon, door · purple #8B5CF6**
`Silhouette: a tall regular hexagon, flat sides, tightly rounded corners. Symbol: a house cut out of the center — gabled roof, two straight walls, one centered door with a flat top.`

**Rizz Coin Collector — coin, R · gold #FFC93C**
`Silhouette: a thick coin — a solid disc with a slightly raised flat rim band, no milled edge, no shine. Symbol: a capital R cut out of the face, thick geometric strokes, flat bowl, straight leg, no serifs.`

**Rizz Score 1000 — diamond gem, flame · pink #FF5FA2**
`Silhouette: a wide brilliant-cut gem seen face-on — flat table across the top, angled shoulders, sharp pavilion point. Symbol: a single flame cut out of the gem face, centered, blunt tip, no inner licks.`

**Voice Regular — shield, mic · blue #4D9BFF**
`Silhouette: a shield with straight sides and a single sharp base point, height slightly greater than width. Symbol: a studio microphone cut out of the center — rounded capsule head, thin stand, wide flat foot, no grille lines.`

Mapped to existing badges already: wing/arrow → Early Supporter, crosshair/star →
Bounty Hunter, flame/red → 30 Day Streak, laurel + checkmark/teal → Verified.

---

## Wiring generated art back into the app

The badges do not have to stay hand-coded. If you generate raster art:

1. Export **1024×1024 transparent PNG** for each badge and its locked twin.
2. Trace each to a single-path SVG on a **24×24 grid with 2px padding**, keeping
   one `fill` and one even-odd cut-out, so it stays crisp at 20px and in the
   share canvas.
3. Drop the `symbol` into `public/badges/badges.svg` under the existing slug id.
   Nothing else needs to change — `Badge` renders `use href="#slug"` at 20px,
   28px and 96px from the same geometry, and `slug`/`tier` live in
   `src/lib/badge-set.ts`.
4. Locked state in the app is CSS (`badge--locked`), not a second asset, so only
   the unlocked art is needed in the sprite.
