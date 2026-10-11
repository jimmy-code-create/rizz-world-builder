---
name: RIZZ scope
description: User's standing constraints for RIZZ frontend work.
---

For this RIZZ work, edit only frontend code under `src/`, `public/`, and frontend configuration. Do not edit `supabase/`, migrations, `.env`, or secrets, and do not run database commands. Use no paid services or AI/API calls. Keep costs and credits low.

Exception for Lil Rizz: the user explicitly wants Grok to generate assistant text through the existing server-side function with their own `XAI_API_KEY`. Keep speech output on the browser's built-in voice so it does not make separate TTS API calls. This exception does not authorize other AI APIs or backend/schema work.

**Why:** The user stated these boundaries to keep this work frontend-only and low-cost.

**How to apply:** Leave backend-dependent behavior as explicit requirements in `BACKEND_REQUIREMENTS.md`; never apply that SQL or read/change `.env`.

**Why:** The user later made a feature-specific exception for Lil Rizz's conversation brain while still asking to minimize usage cost.

**How to apply:** Use the user's key only through the existing server-side Lil Rizz function; keep the key in Replit Secrets and browser speech synthesis free and local.

For Rizz Coach, the user explicitly authorized Gemini for short spoken coaching replies. Keep the Gemini key server-side, use TTS only for replies of two sentences or fewer, and do not persist session conversations.

**Why:** The user asked for expressive Gemini speech while limiting credit use and starting every session fresh.

**How to apply:** This exception is limited to Rizz Coach; do not generalize Gemini or other paid AI services to unrelated RIZZ features.