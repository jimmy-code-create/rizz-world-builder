# Blocked / open questions

Answers needed from the repo owner. Each has a safe default already taken, so work continues
without blocking.

1. **Story text showing `?????` (P5).** I cannot read the live database from this workspace, so I
   cannot tell whether the *stored* `stories.caption` already contains `?????` or whether it is
   fine and only the render loses the glyphs. Code evidence points at fonts: `--font-sans` /
   `--font-display` (`src/styles.css:61`) and the canvas `fontStack()` families
   (`src/lib/story-creator/content.ts:12`) have no Noto / Devanagari / CJK / emoji fallback, and no
   code path strips non-ASCII.
   *Safe default:* treat it as a font-fallback bug, add the fallbacks (P1) and normalise to NFC on
   write (P5). If a stored caption really is `?????`, the text is already lost for that row and the
   fix only protects new posts — please paste one `select caption from stories order by created_at
   desc limit 3` result if you want the input-pipeline branch instead.

2. **VAPID keys for Web Push (P10).** The Worker (`worker/src/index.ts`) and the DB triggers
   (`backend-sql/10_push.sql`) already exist, but the deployment needs `VAPID_PUBLIC_KEY`,
   `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `PUSH_SHARED_SECRET` on the Worker and
   `VITE_VAPID_PUBLIC_KEY` in the app env. The private key must never be committed.
   *Safe default:* build the client/settings side so it degrades to in-app + desktop alerts while
   the key is absent, and document exactly where to paste each value.

3. **Currency naming (P1).** The app shows both "Rizz" and "Paws"; P1 must pick one name everywhere.
   *Safe default:* whichever the live profile/leaderboard surfaces label the score with today
   (audited in P1 before any rename).
