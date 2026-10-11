---
name: RIZZ scope
description: User's standing constraints for RIZZ frontend work.
---

For this RIZZ work, edit only frontend code under `src/`, `public/`, and frontend configuration. Do not edit `supabase/`, migrations, `.env`, or secrets, and do not run database commands. Keep costs and credits low.

Lil Rizz's intended production setup is a current stable Gemini Flash model for replies through the existing Render server and browser-native speech for voice. Gemini 1.5 Flash has been retired; use a currently supported replacement. Do not ask the user to copy production API keys into Replit.

**Why:** The user clarified that the production server is on Render and voice uses the browser. The retired Gemini 1.5 Flash endpoint caused Lil Rizz's reply request to fail.

**How to apply:** Keep frontend work frontend-only and low-cost. Keep the Gemini key in Render, verify model IDs against Google's current supported-model list, and use built-in browser speech rather than a separate TTS API.

For Rizz Coach, the user explicitly authorized Gemini for short spoken coaching replies. Keep the Gemini key server-side, use TTS only for replies of two sentences or fewer, and do not persist session conversations.

**Why:** The user asked for expressive Gemini speech while limiting credit use and starting every session fresh.

**How to apply:** This exception is limited to Rizz Coach; do not generalize Gemini or other paid AI services to unrelated RIZZ features.