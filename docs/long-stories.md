# Long stories (200–2000 messages)

Two ways to reach 1k–2k messages. Both use the same chapter protocol (one
Groq pass per chapter, finale with choice endings); neither touches anyone
else's database rows.

## 1. In-app Epic generation

Chat Stories > Generate > **Epic (1000+)**. The app writes ~10 chapters plus
a finale with per-chapter progress. Takes several minutes; any failed pass
stops early and the saga still ends with template branches. Needs the
server-side `GROQ_API_KEY` (Render env, never chat).

## 2. Completing an existing story (offline script)

Existing stories — curated, generated, or imported — are completed on your
own machine and re-uploaded as a new story (originals are never modified):

```bash
# Room 4B to ~1000 messages:
GROQ_API_KEY=... npm run saga:complete -- --room4b --target 1000 --out room4b-1k.json

# Any exported story to ~2000 messages:
GROQ_API_KEY=... npm run saga:complete -- --in story.json --target 2000 --out story-2k.json
```

Then Chat Stories > **Upload story** and pick the file (flat story JSON is
accepted). How it works: new chapters are inserted before the existing
finale, the choice point moves to the new tail, and every `goto_idx` lane is
preserved. Stories without endings get a generated finale. A failed pass
saves `.partial.json` so a re-run continues instead of restarting. Each pass
costs Groq tokens — ~10 passes for 1000 lines — so watch usage; the key stays
in the environment and is never written to output files.

Limits: `--target` is capped at 2000, `--chapter-lines` at 200, passes at 20.
Supabase saves in 300-row batches and the reader pages 1000 rows at a time,
so completed sagas store and read fine.
