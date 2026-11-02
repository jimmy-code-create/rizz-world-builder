# Test plan: bounty trust/fees and feed polish

Scope: premium-only bounty taking, the 1,000-Paws taker fee, trust/warnings/
blocks/appeals, the full-screen take sheet, the full post page, threaded
comments, the shared emoji picker, and the comment-count fix.

## What "correct" means

- A bounty cannot be taken unless the taker is signed in, has active Purify,
  has no creator block, meets the poster's minimum trust, has fewer than three
  active warnings, and can cover the 1,000-Paws cancellation fee.
- Taking assigns exactly one taker, starts the review clock, and does not move
  the prize. Approval, auto-pay, creator cancel and expiry keep the existing
  escrow rules and never mint Paws.
- A warning is creator-only, one per bounty, and can be appealed once. Only an
  admin can uphold or reject the appeal. Blocking is creator-owned.
- A post opens at `/p/:postId`, comments are threaded, replying increments the
  visible comment count, and the shared picker posts emoji that render on the
  card, post page, comments and chat.
- Super reactions still show the cat burst, pills stay the same height as a
  normal reaction, and the composer has one emoji/GIF control.

## Journeys and edge cases

### 1. Taking a bounty

| Case | Expected |
| --- | --- |
| Signed out, open escrow bounty | `Sign in to take` |
| Signed in, no active Purify | `Premium to take`, links to `/purify` |
| Direct `take_bounty` call without Purify | SQL error, no assignment |
| Creator opens their own bounty | `Your bounty`, no take control |
| Taker below `min_trust` | Take sheet explains the requirement, RPC rejects |
| Taker has 3+ active warnings | Take sheet shows trust gate, RPC rejects |
| Creator blocked the taker | Take sheet says blocked, RPC rejects |
| Taker balance < 1,000 | `Keep 1,000 Paws to take`, RPC rejects |
| Happy path | Take sheet shows prize and fee; confirm sets `taken`, assignee and review deadline |
| Second taker / race | `already_taken`, no second assignment |
| Expired open bounty | No take control, RPC rejects |
| Already submitted | No duplicate submission; review clock unchanged |

### 2. Fees and escrow

| Case | Expected |
| --- | --- |
| Creator cancels before take | Existing percentage fee, remainder refunded |
| Creator cancels after take | Higher existing percentage fee, remainder refunded |
| Taker releases after take | 1,000 Paws charged to the configured recipient, prize refunded to poster, bounty reopens/cancels per existing flow |
| Taker misses deadline | 1,000 Paws charged, prize refunded, state records the miss |
| Creator approves | Prize paid once, escrow marked paid |
| Review window expires | Auto-pay exactly once, escrow marked paid |
| Expired open bounty | Prize returned exactly once |
| Fake escrow row | Payout/refund refuses without a matching funding ledger entry |

### 3. Warnings, blocks and appeals

| Case | Expected |
| --- | --- |
| Creator warns taker | Warning row, notification, warning count increments |
| Second warning on same bounty | Rejected |
| Non-creator warns | Rejected |
| Taker appeals 10–500 chars | One pending appeal |
| Appeal outside 10–500 chars | Rejected |
| Second appeal | Rejected |
| Non-admin opens `/moderation` | Empty queue; RPC rejects |
| Admin upholds | Warning removed; automatic block lifted when appropriate |
| Admin rejects | Warning stays; no second appeal |
| Creator blocks someone | Block row; that person cannot take the creator's bounties |

### 4. Posting

| Case | Expected |
| --- | --- |
| Prize below minimum / above cap | Form and RPC reject |
| Prize above wallet balance | Form disables post; RPC rejects |
| Missing title / description | RPC rejects |
| Premium-only flag | Stored and shown as a take requirement |
| Minimum trust `new`/`trusted`/`top` | Stored and enforced |
| Proof type and tags | Stored, capped at the documented limits |
| Free open call | Still posts without escrow and still pays 25 Paws per claim |
| Direct `drops` insert with a prize | RLS rejects; only `post_paws_bounty` may create escrow |
| Proof link `javascript:` | RPC/trigger rejects; old row does not render a link |
| Oversized note / warning note | Rejected at the database boundary |

### 5. Feed and comments

| Case | Expected |
| --- | --- |
| Tap a post card | Full post page opens |
| Back from post page | Returns to the feed without losing scroll state where possible |
| Comment count | Matches root + visible replies after posting a reply |
| Threaded reply | Nested under the parent, correct author/time |
| Shared picker | Emoji selected in composer appears in the post; custom emoji renders as a pill |
| Super reaction | Cat burst plays once, pill does not grow taller than a normal pill |
| Composer controls | One emoji/GIF control; no duplicate smiley button |
| Reduced motion | Shimmer, spin and pulse effects stop when the user asks for reduced motion |

### 6. Cross-cutting

- Widths: 360, 390, 768, 1024, 1440, 1920.
- Keyboard: focus ring visible on take, cancel, report, sort and picker controls.
- Console: no unexpected errors; the signed-out `/api/me` 401 is expected.
- Links: every public internal link returns 200.
- Browser: Chromium checks on public routes; Firefox/WebKit need a real browser
  matrix on a machine that can run Playwright.
- Performance: mobile LCP under 2.5 s, CLS under 0.1.

## Current coverage and limits

- Automated unit/static tests cover the SQL contracts, client wiring, copy and
  the security guards. `npm test`, `npx tsc --noEmit` and `npm run build` pass.
- The live site is a signed-out marketing/auth surface. The bounty and post
  routes are inside `_app`, which redirects signed-out visitors. No production
  test account with Purify and a funded wallet was available, so authenticated
  E2E flows were not exercised against production.
- Chromium checks and screenshots cover the public landing, login and signup
  pages at phone and desktop widths. Firefox/WebKit and a seeded authenticated
  preview remain a launch-day smoke test.
