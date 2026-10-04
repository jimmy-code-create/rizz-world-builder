# RIZZ Progress

Baseline checked October 5, 2026. SQL application status is unknown; Lovable SQL changes are manual.

| # | Item | Status | Evidence / remaining |
|---|---|---|---|
| 1 | Reactions and likes | DONE | DM, group/channel messages, regular stories, chat stories, posts, and comments use RPCs with optimistic rollback and natural-key Realtime deduplication. `npm run build` and `npx tsc --noEmit` pass. SQL apply status is unknown; `backend-sql/11_reactions_likes.sql` now includes the chat-story-like RPC. |
| 2 | Counts on every post type | PARTIAL | Count triggers and RPC: `backend-sql/12_comment_counts.sql`; SQL must be applied manually. |
| 3 | Calls and TURN | PARTIAL | Realtime signaling: `src/routes/_app/call.$userId.tsx`; screen reports no TURN relay. |
| 4 | Story and Reels layouts | PARTIAL | Fix notes: `CHANGELOG.md`; checks: `docs/TEST_CHECKLIST.md`. |
| 5 | Glass toasts and friendly errors | PARTIAL | Styled wrapper: `src/components/ui/sonner.tsx`; raw backend errors still reach toasts. |
| 6 | Long-press message menu | PARTIAL | DM actions: `src/routes/_app/dm.$userId.tsx`; recent UI fixes in `CHANGELOG.md`. |
| 7 | Push for DMs and calls | PARTIAL | Worker: `worker/src/index.ts`; service worker: `public/service-worker.js`; SQL: `backend-sql/10_push.sql`. |
| 8 | Lazy loading | TODO | No route-level lazy loading found under `src/routes/`. |
| 9 | Chat-story player and Gemini UI | PARTIAL | Player: `src/components/chatstory/ChatStoryPlayer.tsx`; TTS Worker: `worker/src/index.ts`; browser voices remain in use. |
| 10 | Desktop, performance, test docs | PARTIAL | Shell: `src/components/AppShell.tsx`; checklist: `docs/TEST_CHECKLIST.md`. |

## Handoff notes

- `backend-sql/README.md` is missing; SQL apply order is not documented here.
- Before this batch, `git log --stat -15` showed only the imported baseline and a local scope-memory update. The earlier GitHub push authentication failure means this branch's remote backup is unconfirmed.
- Do not apply SQL or deploy. Build each numbered batch and commit it on `wip-features`.

## Current batch

- Done: orientation and baseline report.
- Done: item 1, route message, story, post, like, and comment interactions through RPCs; preserve optimistic rollback and dedupe Realtime rows.
- Next: item 2, verify counts on every post type.
- Manual: apply `backend-sql/11_reactions_likes.sql` in Lovable Cloud if it has not already been applied. No SQL was run by this batch.
- Preview: the route remained on its loading screen, so signed-in UI behavior was not visually verified.
- Lint: the repository-wide command reports thousands of Prettier and `no-explicit-any` errors; this batch did not reformat unrelated files.