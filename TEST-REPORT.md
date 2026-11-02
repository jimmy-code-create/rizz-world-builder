# Test report: bounty trust/fees and feed polish

Date: 2026-11-03.
Live build checked: `54724b4` (Render). The signed-out `/drops` route returns
to `/` with no console errors, and the served `drops` chunk contains the tag,
heading-colour and cover controls. Authenticated composer checks still need a
Purify account with a funded wallet.
Test plan: `TEST-PLAN.md`.
Security review: `SECURITY.md`.

## Verdict

The code-level gates pass: unit/static tests, TypeScript, production build,
Hallmark floor checks and public-route browser checks are clean. The feature is
not ready to take real money yet because the live database still exposes the old
one-argument `take_bounty` RPC. The take sheet calls the new
`take_bounty(_drop_id, _note)` signature and will get a PostgREST 404 until the
migration is re-applied and the schema cache is reloaded. See "Blockers" below.

## Automated gates

| Gate | Result |
| --- | --- |
| `npm test` | Pass, exit 0 (all suites) |
| `node tests/bounty-security.test.mjs` | 7/7 checks |
| `node tests/bounty-presentation.test.mjs` | 7/7 checks (tags, colour, compress-preview pickers, auth remount guard, migration) |
| `npx tsc --noEmit` | Pass, exit 0 |
| `NODE_OPTIONS=--max-old-space-size=4096 npm run build` | Pass, exit 0, Nitro SSR output generated |
| `pnpm audit --prod` | Zod advisory removed; remaining sharp/undici/seroval findings are upstream and documented in `SECURITY.md` |
| Hallmark `sloplint --tier floor` | 4 feature pages clean; 11 feature components clean |

The test suite covers the original post/escrow/review-window/auto-pay flows as
well as the new premium, fee, trust, warning, block, appeal, post-page,
comment-count, shared-picker and super-reaction contracts.

## Browser checks (Chromium, Convio browser)

Public routes only. The authenticated `/feed`, `/drops`, `/moderation` and
`/p/:postId` routes redirect to `/` when signed out, by design.

| Page | Widths | Result |
| --- | --- | --- |
| `/` | 360, 390, 768, 1024, 1440, 1920 | HTTP 200, no console errors, no failed requests, no horizontal overflow; LCP 0.6–1.8 s; CLS 0.03–0.08 |
| `/login` | 390, 1440 | HTTP 200, no problems; LCP 0.7–1.2 s; CLS 0.00–0.01 |
| `/signup` | 390, 1440 | HTTP 200, no problems; LCP 1.1–1.2 s; CLS 0.00–0.02 |

Screenshots at 390 and 1440 were reviewed. The mobile hero CTA row is now
stacked below `sm`, which removed a real 0.16–0.17 layout shift caused by the
web font changing the button widths after first paint. Desktop and mobile
screenshots are clean.

Public internal links checked from the landing page: `/`, `/feed`, `/login`,
`/signup`, manifest, logo, avatar and asset URLs all returned HTTP 200.

Response headers verified on the live build:

```
Content-Security-Policy: frame-ancestors 'self'; base-uri 'self'; object-src 'none'
Permissions-Policy: camera=(self), microphone=(self), display-capture=(self), geolocation=(), payment=()
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
```

## Authenticated and database checks

A seeded demo account (`talia_nguyen_0`) was signed in read-only against the
live Supabase project to verify RPC availability without writing data. It has
0 Paws and no Purify, so it cannot post or take a bounty.

Available and behaving as expected:

- `bounty_escrow_config` returns the configured fees, trust thresholds and
  review window.
- `bounty_trust_stats` returns `new / 0 warnings / 0 completed`.
- `post_paws_bounty` exists and rejects a 0-balance poster with
  "You need 25 Paws in escrow and you have 0."
- `warn_bounty_taker` exists and rejects a missing bounty.
- `appeal_bounty_warning` exists and rejects a missing warning.
- `bounty_appeal_queue` exists and rejects a non-admin with
  "Only an admin can read the appeal queue."
- `new` bounty columns (`min_trust`, `premium_only`, `proof_type`, `tags`)
  are present.

## Blockers before launch

1. **Apply the final migrations to the live Supabase project.**
   - `supabase/migrations/20261108000000_bounty_trust.sql`
   - `supabase/migrations/20261114000000_bounty_security.sql`
   - `supabase/migrations/20261115000000_bounty_presentation.sql`

   The presentation migration adds `drops.heading_color`, the tag validation
   trigger and the 11-argument `post_paws_bounty` wrapper used by the posting
   form. A read-only PostgREST probe on 2026-11-03 confirmed `tags` and the
   trust columns already exist live, while `heading_color` still returns
   `42703`. Until it is applied, open calls keep their tags through the retry
   path but lose the heading colour, and Paws bounties keep using the older RPC
   signature (default cream title).

   The live database currently still has `take_bounty(_drop_id)` and does not
   expose `take_bounty(_drop_id, _note)`. The new Take sheet will fail with
   `PGRST202` until the migration is re-applied. After applying, reload the
   PostgREST schema cache (Supabase Dashboard → API → Reload schema, or
   `NOTIFY pgrst, 'reload schema';`) and confirm:

   ```sql
   -- Should return exactly the two-argument function.
   select p.proname, pg_get_function_identity_arguments(p.oid)
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'take_bounty';
   ```

2. **Run a real authenticated smoke test after the migration.** Use a test
   account with active Purify and at least 1,000 Paws. Check: non-premium
   rejection, take sheet fee, successful take, taker cancellation fee, warning,
   appeal, block, approval and auto-pay. These flows were covered by static and
   SQL-contract tests, but not end-to-end against the live database because no
   funded Purify test account was available.

## Not covered / accepted limits

- Firefox and WebKit were not available in this Termux environment. The
  Chromium checks are real, but the cross-browser matrix still needs a machine
  with Playwright.
- Lighthouse and axe were not available locally; the browser service supplied
  LCP/CLS and basic accessibility checks. A full Lighthouse/axe pass remains a
  launch-day step.
- Authenticated screenshots of `/drops`, `/p/:postId` and `/moderation` were not
  possible without a signed-in browser session and seeded preview data.
- Proof media remains in the public `drops` bucket. This is documented in
  `SECURITY.md` as the next storage change (private bucket + signed URLs).
- The CSP is intentionally minimal (`frame-ancestors`, `base-uri`,
  `object-src`). A full script policy needs nonces for the inline theme boot
  script and an allow-list for media/API origins.
- `sharp` and `undici` advisories remain upstream/build-tooling exceptions;
  `seroval` remains a moderate router serialization exception. See
  `SECURITY.md`.

## Recommended launch sequence

1. Apply all three migrations and reload the PostgREST schema.
2. Verify the two-argument `take_bounty` appears and the one-argument overload
   is gone.
3. Seed or use a Purify test account with 1,000+ Paws.
4. Run the take/cancel/warn/appeal/block/approve smoke test in Chromium and
   Firefox.
5. Re-run `npm test`, `npx tsc --noEmit` and `npm run build`.
6. Only then announce the bounty upgrade.
