# Security review

Scope: the bounty trust/fee upgrade, the full post page and threaded comments,
the shared emoji picker, and the new moderation queue. Reviewed against the
existing RIZZ app (React + TanStack Start + Supabase) on 2026-11-02.

## Fixes shipped

### Critical — browser-created escrow could mint Paws

`drops` had a permissive insert policy (`auth.uid() = creator_id`) and the
bounty columns live on that table. A client could insert a row with
`prize_paws > 0, escrow_state = 'held'` without paying, then let the normal
payout path credit the wallet.

- `supabase/migrations/20261114000000_bounty_security.sql` replaces the insert
  policy with `users create free open drops`: a browser may create only a free
  open call (`prize_paws = 0`, `escrow_state = 'none'`, `state = 'open'`, no
  assignee, no review deadline). Only `post_paws_bounty()` may create escrow.
- The same migration adds `require_funded_bounty_escrow`, an `AFTER UPDATE`
  guard that refuses to settle (`paid`/`refunded`) unless a matching negative
  `bounty_escrow` ledger row exists. This also protects any legacy row created
  before the policy fix.

### High — proof links could run script in the poster's session

`bounty_submissions.links` were rendered directly into `href`. A taker could
submit `javascript:...` and run script when the poster clicked the proof.

- The migration adds `validate_bounty_submission`: links and media must be
  `http(s)`, at most 2048 characters, with the existing count limits.
- `BountyActions` also sanitises before rendering, so old rows are safe too.
- Notes, warning notes and admin resolution notes now have length caps.

### Medium — missing response headers

The standalone Render launcher now sets `X-Content-Type-Options`,
`X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, a minimal
`frame-ancestors`/`base-uri`/`object-src` CSP, and HSTS when the request is
HTTPS. A full `script-src` policy is still open because the app has an inline
theme boot script and third-party media embeds; adding nonces is a separate
front-end change.

### Medium — dependency audit

`zod` was upgraded from 3.25.76 to 4.6.6, which removes the high-severity
oversized-collection memory advisory. `pnpm audit --prod` still reports:

- `sharp` (three high advisories) through `@huggingface/transformers`. The app
  uses that package for text-to-speech, not image decoding, so untrusted images
  do not reach the vulnerable libvips path. Upgrading sharp is blocked by the
  transformers version; track upstream.
- `undici` (four high, several moderate) through `wrangler`/`miniflare`, which
  are build tooling, not the Render runtime.
- `seroval` (two moderate) through TanStack Router's serialization layer. The
  app does not serialize attacker-controlled HTML with it; track upstream.

These are recorded as accepted, upstream-scoped exceptions rather than
introduced by this feature.

## Authorisation checks verified

- `take_bounty` is server-side: Purify (`purify_until > now()`), creator block,
  warning count, minimum trust and the 1,000-Paws fee cover check all run in
  SQL before the row is assigned. `purify_until` itself cannot be self-granted
  (existing `protect_purify_entitlement` trigger).
- `warn_bounty_taker` is creator-only, one warning per bounty, and caps text.
- `appeal_bounty_warning` is taker-only, one appeal, 10–500 characters.
- `resolve_bounty_warning` and `bounty_appeal_queue` require `has_role(admin)`.
- `bounty_blocks` is creator-owned; the insert policy cannot write another
  creator's blocks.
- `bounty_warnings` and `bounty_cancel_log` have no client write policies; the
  tables are written only through `SECURITY DEFINER` RPCs.
- Bounty submissions are readable only by the taker and the poster; there are
  no client insert/update/delete policies.
- Direct post/comment text is rendered through React; the new feature has no
  `dangerouslySetInnerHTML`.

## Secrets

No service-role key, Stripe secret, private API key or private token is tracked
in the working tree. The only `.env` ever committed contained the public
Supabase URL and publishable key (public by design). `VITE_*` values are public
by definition. The Convio API key used during development lives in the user's
shell profile, not in this repository; rotate it if it was shared.

## Accepted risks / follow-ups

1. **Proof media is still in the public `drops` bucket.** Upload paths contain
   a UUID and the row-level policy limits who can read the URL, but a leaked
   public URL does not expire. Moving proof media to a private bucket with
   signed URLs is the next storage change.
2. **Full CSP.** The minimal CSP protects framing, base tags and plugins, but
   does not restrict script sources. Needs nonces for the inline boot script and
   an allow-list for media/API origins.
3. **Cancel-fee cover is checked at take time, not held.** A taker who spends
   below 1,000 after taking can be charged only what remains. The fee is a
   penalty, not an escrow hold; holding it would require a new wallet
   reservation flow.
4. **Dependency exceptions** listed above.

## Verification

- `node tests/bounty-security.test.mjs` — 7 checks.
- `npx tsc --noEmit` — clean.
- `npm test` — all suites pass (Node 24, after the review fixes).
- `pnpm audit --prod` — remaining findings are the upstream exceptions above.
