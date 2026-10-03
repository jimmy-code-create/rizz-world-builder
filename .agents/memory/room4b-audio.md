---
name: Room 4B narration
description: The user's voice-quality requirement and direction for the Room 4B story.
---

The user says the Room 4B narration is too fast and the characters do not sound different; they requested OpenAI.fm.

**Why:** Device-native browser speech has inconsistent voice availability, and pitch/rate tweaks did not meet the user's expectation for distinct characters.

**How to apply:** Use separate OpenAI Speech API voice identities for the narrator, player, Asha, Kabir, and the Echo, with deliberately slower pacing. OpenAI.fm is a demo of that API, not an embeddable app service. Keep API credentials out of frontend code.