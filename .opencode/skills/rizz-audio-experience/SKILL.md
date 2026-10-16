---
name: rizz-audio-experience
description: Extend RIZZ narration, sound, speech recognition, and voice companion experiences without breaking existing playback or privacy rules.
compatibility: opencode
---

# RIZZ Audio Experience

Use this skill for TTS, voice commands, sound effects, narration, audio controls, and voice companion work.

## Existing audio surfaces

- `src/components/chatstory/ChatStoryPlayer.tsx` currently uses the browser `speechSynthesis` API for chat-story narration and selects voices by story language and speaker.
- `src/hooks/useKokoroTTS.ts` plus `src/workers/tts.worker.ts` provide a separate Kokoro worker-based TTS path; `src/components/voice-companion/` consumes it. Inspect current call sites before changing anything.
- `src/hooks/useSpeechToText.ts` handles browser speech recognition. `src/lib/sound-settings.ts` centralizes persisted volume/mute settings. `src/lib/rizz-sounds.ts` and `src/lib/notification-sound.ts` handle sound playback.
- Project memory currently says production Lil Rizz uses browser-native speech and ordinary RIZZ work should avoid new paid AI APIs, backend work, and secrets. Read `.agents/memory/rizz-scope.md` and `.agents/memory/deployment-topology.md` before changing model or service behavior.

## Reliability, privacy, and cost

- Prefer the existing browser/local implementation unless the user explicitly authorizes a new external provider or backend integration.
- Never put provider tokens in browser code, `VITE_` variables, local storage, source control, or logs. Never request secrets in chat. Do not imply that a Hugging Face token makes every model hosted, unlimited, or free.
- Before selecting any model, verify current language support, license, actual inference availability, response format, hardware needs, and recurring costs. Distinguish free model weights from free hosting/inference.
- Preserve mute/master/channel volume behavior and user activation requirements. Resume audio contexts only through a user gesture where required by the browser.
- Handle missing voices, unsupported languages, worker failure, timeouts, autoplay restrictions, and cancellation. Provide graceful fallback and stop/cleanup behavior.
- Keep model loading out of the main UI thread. Do not download large models on initial app load without explicit user intent and a clear progress/size experience.
- Keep conversation/session text ephemeral unless the user explicitly approves persistence. Do not log private spoken content.

## Voice and sound design

- Use actual dialogue text for interjections and pauses (`“hmm…”`, `“हम्म…”`, punctuation). Model-specific emotional tags or SSML are only valid when the selected engine explicitly supports them.
- Keep character voice choices stable and language-aware; do not rely on pitch shifts alone to create dramatically different identities.
- Ensure narration controls work with keyboard and screen readers, indicate speaking/loading/error states, and honor reduced-motion preferences for audio visualizers.
- Validate with short Hindi, English, and mixed-language samples when the model supports them. Do not claim speech quality was verified without listening to generated audio.
