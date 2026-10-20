# Cinematic profile effects

The effects gallery is a four-piece cinematic collection cut from one supplied
reel. One piece is a full-profile effect; the other three are avatar
decorations. The shop spends **Paws**, the RIZZ currency earned by claiming
bounties.

| Effect | Slug | Placement | Paws | Card | Rights |
| --- | --- | --- | --- | --- | --- |
| Web Slinger | `fx-web-slinger` | Full-profile effect | 1,800 | $4.99 | Review |
| Sakura Bloom | `fx-sakura-bloom` | Avatar decoration | 1,200 | $2.99 | Clear |
| Arcane Nexus | `fx-arcane-nexus` | Avatar decoration | 1,500 | $3.99 | Clear |
| Sakura Storm | `fx-sakura-storm` | Avatar decoration | 900 | $3.49 | Clear |

## Placement

- **Web Slinger** is the only `profile_effect`. `/u/<username>` renders it in
  a page-wide layer that starts on the banner, continues behind the profile
  header, and fades into the page. It is not clipped to the banner.
- **Sakura Bloom, Arcane Nexus and Sakura Storm** are `avatar_decoration`.
  `AvatarDecoration` sizes the 1600×480 clip from the avatar diameter so the
  central 480×480 ring sits around the picture. The wide transparent sides
  stay transparent.
- Buying an effect applies it immediately. Only one effect of each type can
  be worn at a time; the other rows are unequipped in the same transaction.

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
  crops to the effect's 16:9 area; Web Slinger uses a page-wide layer on the
  profile, and the other three clips are centred on the avatar.
- The player renders the poster first. The video fades in only when it can
  play; a failed load, blocked autoplay, or an unsupported browser leaves the
  real poster visible rather than a black rectangle.
- Chromium-family browsers use the VP9 alpha video. Safari and Firefox
  currently keep the poster because a reliable alpha video path could not be
  verified for them here.
- `prefers-reduced-motion` or the member's reduced-motion preference shows the
  poster. The stage badge changes to "Still preview".
- Only one video is mounted on the gallery stage, and videos pause when they
  leave the viewport. A member can wear one full-profile effect and one avatar
  decoration at the same time.
- Small avatars in feeds use the poster instead of mounting a video.

The gallery's **Preview on profile** link opens
`/u/<username>?previewEffect=<slug>`. A full-profile slug renders in the
page-wide layer; an avatar-decoration slug renders around the profile picture.
The badge labels the result as a preview. Opening the link never equips the
effect and never charges Paws.

## Paws shop

- `COSMETICS_ENABLED` is `true`. Equipped effects render across the profile and
  avatar surfaces.
- `profiles.paw_balance` is the wallet. Only `award_paws()` and
  `purchase_profile_effect()` may change it; a trigger rejects direct profile
  updates that touch the wallet.
- Bounty claims pay **25 Paws** via `claim_bounty()`. The trigger rejects
  self-claims, expired bounties and sold-out bounties. Every payout and
  purchase writes a `paw_transactions` row.
- `purchase_profile_effect(_slug)` checks the server-side price, deducts the
  balance under a row lock, inserts ownership, and equips the new look. The
  client cannot choose its own price or write `user_profile_effects` directly.
- `equip_profile_effect(_slug)` and `unequip_profile_effect(_slug)` are the only
  equip surfaces. The old direct INSERT/UPDATE/DELETE policies are removed so
  the shop cannot be bypassed with PostgREST calls.
- The migration is
  `supabase/migrations/20261027000000_paws_effects_shop.sql`. Apply it before
  deploying this client; `/api/me` now selects the wallet columns.

## Card checkout

Card checkout is still optional infrastructure, and the UI says so:

- A single `VITE_EFFECTS_CHECKOUT_URL`, or per-effect
  `VITE_EFFECTS_CHECKOUT_WEB_SLINGER`,
  `VITE_EFFECTS_CHECKOUT_SAKURA_BLOOM`,
  `VITE_EFFECTS_CHECKOUT_ARCANE_NEXUS`, and
  `VITE_EFFECTS_CHECKOUT_SAKURA_STORM` links can be set at build time. Without
  one, the sheet shows **Card checkout not connected**.
- `VITE_EFFECTS_CHECKOUT_READY=true` is a second, explicit gate. Set it only
  after the fulfilment webhook is live; a checkout URL alone never enables the
  card button.
- The sheet adds `client_reference_id=<user.id>` and `effect=<slug>` to the
  checkout URL. A provider that preserves `client_reference_id` (Stripe Payment
  Links do) can map the completed payment to the member; use per-effect links
  or your own metadata to identify the slug.
- There is **no entitlement webhook** in this repository yet. A completed
  checkout does not automatically write `user_profile_effects`; that sync still
  needs a provider webhook or a server-side fulfilment job. The sheet never
  advertises an automatic card unlock.
- Once the webhook is live, it should call the service-role-only
  `grant_profile_effect(_user, _slug)` RPC after verifying the payment. That
  RPC refuses rights-review clips, grants ownership, and never touches Paws.
- The **Web Slinger** clip is supplied Spider-Man footage. It is marked
  `rightsReview: true` in `src/lib/cinematic-effects.ts` and `rights_review` in
  the database. Both Paws and card purchasing are refused until the operator
  clears the rights. Do not describe it as original RIZZ art.

## Source and rights

The four clips are cut from the Google Drive reel supplied for this build.
The cherry and arcane takes are the supplied generated footage; the spider
take is a recognizable third-party character. The project's earlier "original
art only" rule does not apply to this supplied reel, and the spider effect
must not be presented as original art. Review the rights for every clip before
publishing or charging for it.
