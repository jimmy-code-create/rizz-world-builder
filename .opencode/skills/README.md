# RIZZ OpenCode Skill Pack

A small repo-local skill pack for creative feature work in the RIZZ World Builder app. OpenCode discovers skills from `.opencode/skills/<skill-name>/SKILL.md`.

## Included skills

- **`rizz-app-builder`** — repo architecture, constraints, implementation workflow, and verification.
- **`rizz-creative-ui`** — brand-aware visual design, responsive interaction, accessibility, and motion.
- **`rizz-story-worldbuilder`** — chat-story craft, branching logic, Hindi/English content, and import safety.
- **`rizz-audio-experience`** — narration, browser TTS, Kokoro worker, voice UX, privacy, and cost guardrails.

OpenCode can load these when the task matches their descriptions. You can also ask it directly to use a skill by name, for example: “Use `rizz-story-worldbuilder` to design a short branching Hindi/English story, then use `rizz-creative-ui` to polish the reader.”

The skills are guidance, not a replacement for inspecting current code. Always read the root `AGENTS.md` and relevant `.agents/memory/` notes because they may contain user-specific scope or deployment decisions.
