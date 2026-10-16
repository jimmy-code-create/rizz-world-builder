# Chat-story narration (Hindi / English / Hinglish)

Realistic-first, free-first. Chat stories keep the companion's Kokoro TTS
untouched; only chat-story narration changes.

## What speaks what

| Text | Model | Where it runs | Cost |
| --- | --- | --- | --- |
| English | `onnx-community/Kokoro-82M-v1.0-ONNX` (Apache-2.0, 82M params, q8 ~92 MB) via `src/workers/tts.worker.ts` + `src/hooks/useKokoroTTS.ts` | Browser (WebGPU, WASM fallback), cached | Free: weights free, compute is the user's device, no token |
| Hindi / Hinglish (Devanagari or Latin Hinglish in a Hindi story) | Optional self-hosted **Chatterbox Multilingual** (MIT, 0.5B, Hindi finetune `ResembleAI/Chatterbox-Multilingual-hi`) behind `/api/chatstory-speech` | Your own server / Space; browser falls back to device Hindi voice when unset | Weights free; compute is **not** free on this deployment (see below) |
| Anything, when HD is off or backends fail | `speechSynthesis` device voices via `src/lib/voice-selection.ts` | Browser | Free |

Routing lives in `src/lib/chatstory-tts.ts` (`resolveChatStoryTTSLanguage`):
any Devanagari → `hi`, Latin Hinglish inside a Hindi story → `hi`, else the
story's selected language. Character voices stay consistent: Kokoro seats
(`bm_george` / `am_michael` / `af_bella`) for English, `Rohit` / `Aman` /
`Divya` (+ gendered pools) for the Hindi server voice, device-voice seeds for
fallback. Story language selection and all story controls are unchanged.

## Voice cast (narrator is a man)

`src/lib/voice-cast.ts` is the single definition of the speaking cast, shared
by the player, the Hindi server router, the AI story prompts, and tests:

| Cast | Device voice | Kokoro HD | Hindi server id |
| --- | --- | --- | --- |
| Narrator (man) | low pitch 0.72, male-first prefs | `bm_george` | `Rohit` |
| Child | bright pitch 1.55, faster | `am_puck` | `Rani` |
| Old man | deep pitch 0.58, slow 0.82x | `am_onyx` | `Rohit` |
| Old woman | warm pitch 1.12, slow 0.84x | `af_sky` | `Divya` |
| Young husband | pitch 0.88 | `am_adam` | `Aman` |
| Young wife | pitch 1.30 | `af_nicole` | `Rani` |
| Adult man | pitch 0.80 | `bm_daniel` | `Rohit` |
| Adult woman | pitch 1.22 | `bf_emma` | `Divya` |

Detection is keyword-based in English + Hindi (`Dada`, `दादी`, `छोटू`,
`दूल्हा`, `दुल्हन`…), so generated, uploaded, and Room-4B-style stories all
get distinct voices per character. Every AI story is prompted to speak with at
least narrator, me, them, one child, one elder, and the young married couple.
Only four Hindi server voices exist, so elders share the family voice id;
operators can bind distinct reference audio per id for fully distinct
Chatterbox cloning (see the `tts_server.py` sketch below).

## Long stories (200–2000 messages)

Short stories generate in one Groq pass (~15–30 messages). Long (~200–350)
and epic (1000–2000) sagas are written chapter by chapter — one 8192-token
pass per chapter (~50–200 messages each) plus a finale pass — and stitched in
`src/lib/story-length.ts` with global index offsets. A failed pass stops the
loop early and the saga still ends with template branches, so long stories
are always readable. The generator dialog shows per-chapter progress; epics
take several minutes. Supabase saves in 300-row batches and the reader pages
1000 rows at a time, so 1k+ sagas store and read fine.

## Why Chatterbox Multilingual (and not hosted HF inference)

Evaluated 2026-10-16 from live model cards / pricing:

- **Chatterbox (`ResembleAI/chatterbox`)**: MIT, 23 languages including `hi`
  + `en`, 0.5B Llama backbone, voice cloning via audio prompt,
  `exaggeration` / `cfg_weight` knobs (not inline emotion tags). ~1.6M
  downloads/mo. Weights: ~2.1 GB (T3) + ~1 GB (S3Gen). `device="cuda"`
  recommended; CPU works but is ~10–30 s/line. Hosted inference exists via the
  `fal` provider — **billable** (PRO includes only ~$2/mo credits).
- **Indic-Parler-TTS (`ai4bharat/indic-parler-tts`)**: Apache-2.0, 21
  languages including Hindi + Indian English, 0.9B F32 (~3.7 GB), recommended
  Hindi voices Rohit/Divya. Gated (contact share). `inference: false` — **no
  hosted inference at all**; must self-host. Good alternative if you prefer
  named Hindi speakers over voice cloning.
- **Kokoro-82M-ONNX**: Apache-2.0, **English-only** (US + GB voice list), no
  Inference Provider. Browser-local is its only free path.
- **Hugging Face pricing**: PRO $9/mo includes $2 inference credits; Spaces
  CPU Basic (2 vCPU/16 GB) and ZeroGPU are free with quotas/queues; CPU
  Upgrade $0.03/hr, T4 $0.40–0.60/hr, Inference Endpoints CPU from $0.03/hr.
  A token does **not** make hosted inference free.

Conclusion: there is **no unlimited-free hosted** realistic Hindi TTS for the
current Render-free / Cloudflare deployment (512 MB, no GPU). The default
stays genuinely free (Kokoro EN + device HI); the Hindi HD voice is an
explicit opt-in self-host with honest costs.

## Emotion / effect tags

`[pause]`, `[whisper]…[/whisper]`, `[sigh]`, `[laughs]`, `[gasp]`, `[exhale]`
and typed hesitations (`hmm…`, `हम्म…`) are parsed by
`src/lib/chat-story-effects.ts`. Only the **spoken** segment text is sent to
the server (`sanitizeTextForServerTTS` strips `[…]` tokens); pauses and
whisper volume are rendered client-side. Neither Chatterbox nor Indic-Parler
accepts inline tags (`supportsInlineEmotionTags() === false`), so tags are
never forwarded. `hmm…` / `हम्म…` are preserved byte-for-byte.

## Local setup

```bash
cp .env.example .env
# Hindi HD is optional. Without these two, Hindi uses device voices (free).
# CHATSTORY_TTS_URL=https://<your-space-or-box>/generate
# CHATSTORY_TTS_MODEL=ResembleAI/chatterbox
# HF_TOKEN=  # only if the backend is private; server-side, never VITE_, never chat
npm install
npm run dev
```

### Self-host option A — Hugging Face Space (cheapest)

1. Create a Space from `ResembleAI/Chatterbox-Multilingual-TTS-hi` (or the
   V3 Space) with a tiny Gradio `generate(text, language_id="hi",
   exaggeration=0.5, cfg_weight=0.5)` wrapper that returns WAV bytes/JSON.
2. CPU Basic / ZeroGPU are free (queued); CPU Upgrade or T4 removes the queue
   ($0.03–0.60/hr). Note the free-queue limits in your Space settings.
3. Set `CHATSTORY_TTS_URL` to its endpoint on Render (Dashboard → Environment,
   `sync: false`). Add `HF_TOKEN` only for a private Space.

### Self-host option B — your own GPU/CPU box

```bash
pip install chatterbox-tts torchaudio soundfile fastapi uvicorn
# needs ~8 GB RAM, ~4 GB VRAM for CUDA (CPU: 10–30 s per line)
# weights download ~3.2 GB on first run (t3_mtl23ls + s3gen + ve)
uvicorn tts_server:app --host 0.0.0.0 --port 8000
```

Minimal `tts_server.py` shape (Hindi):

```python
from fastapi import FastAPI
from fastapi.responses import Response
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
import io, soundfile as sf
app = FastAPI()
model = ChatterboxMultilingualTTS.from_pretrained(device="cuda", t3_model="v3")
VOICES = {"Rohit": None, "Aman": None, "Divya": None}  # + audio_prompt_path per id
@app.post("/generate")
def generate(req: dict):
    wav = model.generate(req["text"][:500], language_id="hi")
    buf = io.BytesIO(); sf.write(buf, wav.numpy(), model.sr, format="WAV")
    return Response(buf.getvalue(), media_type="audio/wav")
```

Map `voiceId` → `audio_prompt_path` operator-side for distinct characters.

## Hardware / limits

- English Kokoro: downloads once (~92 MB q8), WebGPU preferred, WASM
  fallback; 180 s worker timeout, per-sentence chunking at 220 chars.
- Hindi server: 15 s client timeout + 25 s server→upstream timeout, 500-char
  cap, 60 req/hr/IP, 5 MB audio cap, per-line in-memory cache (60 entries).
  Every failure → silent fallback to Kokoro/device speech; the only visible
  sign is the HD spinner. No token, URL, or text is logged (only language +
  char count on upstream failure).

## If you are asked for a key

Only `HF_TOKEN` (server secret for a **private** backend) is ever needed —
tell the operator to paste it into Render → Environment as `HF_TOKEN`
(`sync: false`), never into chat, never as `VITE_*`, never localStorage.
Public Spaces / boxes need no key at all.
