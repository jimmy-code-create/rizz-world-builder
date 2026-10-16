# Per-scene videos for chat stories (offline authoring)

**Status: wiring only — no AI clips have been generated or reviewed.** The
player supports per-scene clips, but every scene currently falls back to its
poster until an author renders and commits clips (see `public/videos/`).

## Why offline

There is no zero-cost way to generate video inside this deployment. The
open-weight options were verified against their live model cards:

- **Wan2.1-T2V-1.3B** (Apache-2.0): needs **8.19 GB VRAM**, ~4 min per 5 s
  480P clip on an RTX 4090, ~10 GB weights. Hosted inference (`fal`) is
  billable per second. 480P only in practice.
- **LTX-Video 2B distilled** (custom LTX Open-Weights License — accept its
  terms; not OSI-approved): ~8 GB+ CUDA GPU plus T5-XXL encoder, English
  prompts only. No hosted HF inference; ltx.studio/fal/Replicate are billable.

Render-free (512 MB, no GPU), Cloudflare Workers, and browsers cannot run
either model — there is no browser/ONNX port for these diffusion pipelines.
"Free weights" do not mean free compute: rendering is free only on a GPU you
already own. Nothing here calls a paid API, trial credit, or `localhost`.

## Workflow (works for every story, not just Room 4B)

1. **Export the story.** Room 4B: `node scripts/scene-briefs.mjs --room4b`.
   Any other story: export its `chat_story_lines` rows as JSON
   (`[{speaker, body, body_en?, chapter?}]`), then run
   `node scripts/scene-briefs.mjs --lines export.json --slug my-story-slug`.
2. **Review/edit the shot-list.** Check faces, clothing, and setting match
   across scenes; dialogue stays in the app UI and must never appear in a
   brief's visuals. Re-run after changing scene text (stable scene IDs reuse
   clips — never regenerate on read).
3. **Render ONE scene first** with the pasted Wan or LTX command. Watch it:
   coherent characters, no captions/logos/watermarks, loops cleanly at 6 s.
4. **Render the rest**, normalize each clip, and commit:
   `ffmpeg -i raw.mp4 -t 6 -r 24 -s 1280x720 -c:v libx264 -pix_fmt yuv420p -movflags +faststart public/videos/<slug>/<scene>.mp4`
5. **Poster for slow connections:** `ffmpeg -y -i public/videos/<slug>/<scene>.mp4 -vframes 1 poster.jpg`
   (Room 4B already ships JPG posters; DB stories fall back to their gradient.)

Limits: **≤12 scenes, ≤6 s, 1280×720, 24 fps** per story (`SCENE_VIDEO_LIMITS`
in `src/lib/scene-video.ts`). The player plays the active scene muted/inline,
warms the next scene's metadata, pauses when hidden, shows posters on error,
slow connections, and `prefers-reduced-motion`, and keeps the chat vignette
for contrast.

## What needs approval later (not in this change)

- In-app brief review/editing and clip uploads need Supabase schema + storage
  changes (a scene→clip map and a video bucket) — backend work, ask first.
- Private story text must never leave the author's machine; briefs are built
  locally by `src/lib/scene-video.ts` for exactly this reason.
