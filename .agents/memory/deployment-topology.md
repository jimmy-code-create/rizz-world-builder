---
name: Deployment topology
description: User-stated hosting split for the RIZZ project.
---

The user says this project's backend is connected to Lovable Cloud and its frontend is hosted on Render.

**Why:** Changes and deployments need to target the correct service; the user offered backend credentials, but story improvements can be made without them.

**How to apply:** Keep frontend changes in the Render-bound app. Treat Supabase/Lovable Cloud schema, data, and secrets as separate backend work; never ask the user to paste credentials into chat.