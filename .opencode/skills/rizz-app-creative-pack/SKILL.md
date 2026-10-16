---
name: rizz-app-creative-pack
description: Coordinate RIZZ's app-building, creative UI, story, and audio skills for end-to-end creative feature work.
compatibility: opencode
---

# RIZZ App Creative Pack

Use this skill when a request spans multiple parts of creative app building. It coordinates the focused RIZZ skills in this pack rather than duplicating their full guidance.

## Pick the relevant skills

- Start with `rizz-app-builder` for repository orientation, active constraints, architecture, and checks.
- Add `rizz-creative-ui` for new or redesigned visual surfaces and interactions.
- Add `rizz-story-worldbuilder` for narrative content, authoring, branching, or chat-story playback.
- Add `rizz-audio-experience` for TTS, voice, sound, or microphone work.

## End-to-end workflow

1. Read `AGENTS.md` and the applicable `.agents/memory/` notes. Resolve scope and deployment assumptions before coding.
2. Inspect the current route, shared component, data contract, and related feature implementation. Identify what should remain unchanged.
3. Describe the user outcome and a compact implementation plan. Keep creative choices aligned with the live RIZZ design tokens and any explicit content direction.
4. Implement in small steps, preserving existing accessibility, language handling, permissions, data contracts, and fallbacks.
5. Validate affected paths at mobile and desktop sizes where applicable. Run formatting, lint, type checks, and production build as relevant.
6. Report what changed, how it was verified, and any unresolved limits or setup needed. Never claim an external model/API is free or working without verifying it.

If focused skills cannot be loaded automatically, read their `SKILL.md` files from `.opencode/skills/` before making changes.
