---
name: RIZZ scope
description: User's standing constraints for RIZZ frontend work.
---

For this RIZZ work, edit only frontend code under `src/`, `public/`, and frontend configuration. Do not edit `supabase/`, migrations, `.env`, or secrets, and do not run database commands. Keep costs and credits low.

Lil Rizz's intended production setup is Gemini 1.5 Flash for replies through the existing Render server and browser-native speech for voice. Do not ask the user to copy production API keys into Replit; do not change the backend/provider unless explicitly requested.

**Why:** The user clarified that the production server is already on Render, Gemini 1.5 Flash is the companion's brain, and voice uses the browser. They corrected an earlier mistaken assumption that a Replit Groq key was needed.

**How to apply:** Keep frontend work frontend-only and low-cost. For Lil Rizz issues, compare this checkout with the stated Render configuration before diagnosing; use built-in browser speech rather than a separate TTS API.

For Rizz Coach, the user explicitly authorized Gemini for short spoken coaching replies. Keep the Gemini key server-side, use TTS only for replies of two sentences or fewer, and do not persist session conversations.

**Why:** The user asked for expressive Gemini speech while limiting credit use and starting every session fresh.

**How to apply:** This exception is limited to Rizz Coach; do not generalize Gemini or other paid AI services to unrelated RIZZ features.