---
name: rizz-story-worldbuilder
description: Create and improve RIZZ chat stories, branching dialogue, bilingual story content, and in-player narrative experiences.
compatibility: opencode
---

# RIZZ Story Worldbuilder

Use this skill for chat-story writing, authoring tools, narrative systems, branching choices, and story-player UX.

## Know the story pipeline

- `src/routes/_app/chat-stories.tsx` owns the chat-stories library, generation/import flows, and data queries.
- `src/components/chatstory/ChatStoryPlayer.tsx` renders and plays the interactive story, branching choices, narration, and language selection.
- `src/lib/story-generation.ts` contains story-generation and persistence helpers.
- `src/lib/chat-story-import.ts` validates and converts author-imported story files.
- `src/components/chatstory/room4b-story.ts` and `src/data/room4b.json` contain Room 4B story content/assets; inspect which source is authoritative before editing.
- Stories use line/choice records and existing Supabase contracts. Do not change database schema or RLS as part of ordinary narrative work.

## Narrative quality

- Start with a strong hook, a distinct voice, and an immediate situation. Keep each chat bubble readable and conversational; use varied message lengths, interruptions, timing, and reveals rather than long exposition.
- Make character voices distinguishable through word choice, rhythm, certainty, humor, and how they react—not just name labels or emoji.
- Treat choices as meaningful: each option should sound like something a real player might choose, reflect different attitudes, and lead to a coherent payoff. Preserve valid `idx`, `next_idx`, `at_idx`, and `goto_idx` relationships when editing branch data.
- Match genre and tone requested by the user. Do not add graphic, sexual, hateful, or otherwise unsafe material that the task does not call for.

## Hindi and English

- Preserve the existing `hi` / `en` language model. For bilingual lines, keep Hindi in `body` and a natural, meaning-aligned English translation in `body_en`; choices follow the corresponding Hindi and English label/reply fields.
- Hindi should sound idiomatic, not mechanically translated. Use Devanagari for Hindi unless the user explicitly requests Roman Hindi/Hinglish. Keep English slang and names natural in both versions.
- Check the player’s `storyText()`/language-selection behavior before changing content fields. Do not accidentally narrate the wrong language or display mismatched choice text.
- For dialogue with intentional sounds such as “hmm” or “हम्म,” preserve them as spoken content; do not assume unsupported TTS tags will work.

## Safe authoring and validation

- Treat imported JSON and generated content as untrusted input. Preserve validation and length/type checks in `parseAuthorStoryFile` and generation paths.
- Use existing story types and helpers; avoid inventing a parallel format.
- When adding example content, ensure branches terminate or continue intentionally and all referenced indexes exist.
- Run focused checks on changed files, TypeScript, and the production build as appropriate. If adding a validator or fixture, test malformed as well as valid input.
