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
