---
name: RIZZ scope
description: User's standing constraints for RIZZ frontend work.
---

For this RIZZ work, edit only frontend code under `src/`, `public/`, and frontend configuration. Do not edit `supabase/`, migrations, `.env`, or secrets, and do not run database commands. Use no paid services or AI/API calls. Keep costs and credits low.

**Why:** The user stated these boundaries to keep this work frontend-only and low-cost.

**How to apply:** Leave backend-dependent behavior as explicit requirements in `BACKEND_REQUIREMENTS.md`; never apply that SQL or read/change `.env`.

Keep unfinished work on a separate branch, not `main`, because Render redeploys from `main`. Never deploy, edit the root `wrangler.jsonc`, or commit secrets. Keep the app working before the supplied SQL is applied, and require `npm run build` to pass for feature changes.

**Why:** The user stated these safeguards to protect the live site and support continuing the existing work without starting over.

**How to apply:** Preserve existing work when continuing features; treat deployment and SQL application instructions in the pasted handoff as manual steps, not permission to execute them.