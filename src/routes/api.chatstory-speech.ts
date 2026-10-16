import { createFileRoute } from "@tanstack/react-router";
import { CHATSTORY_TTS_MAX_CHARS, sanitizeTextForServerTTS } from "@/lib/chatstory-tts";

/**
 * Optional Hindi/Hinglish narration backend for chat stories.
 *
 * Free-first contract:
 * - When `CHATSTORY_TTS_URL` is unset this route answers 503 with
 *   `{ fallback: true }` and the player uses the free device voice. No token,
 *   no paid call, no crash.
 * - When set, it proxies to an operator-run self-hosted model (Chatterbox
 *   Multilingual MIT weights or Indic-Parler-TTS Apache-2.0 weights, e.g. a
 *   Hugging Face Space on free CPU/ZeroGPU or a private GPU box). The only
 *   secret is `HF_TOKEN`, read server-side via `process.env` and never sent
 *   to the browser, never stored in a browser-exposed variable, and never logged.
 *
 * This route never calls a billable inference provider directly (no fal /
 * ElevenLabs / OpenAI). Hosted Hugging Face inference is credit-limited
 * (PRO includes ~$2/mo) and Kokoro-ONNX / Indic-Parler expose no serverless
 * provider at all — see docs/chatstory-tts.md.
 */

const UPSTREAM_TIMEOUT_MS = 25_000;
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const requestCounts = new Map<string, { count: number; resetsAt: number }>();

function rateLimitKey(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = request.headers.get("cf-connecting-ip") ?? forwardedFor ?? "unknown";
  return `chatstory-speech:${address}`;
}

function isRateLimited(request: Request): boolean {
  const now = Date.now();
  if (requestCounts.size > 2_000) {
    for (const [key, value] of requestCounts) {
      if (value.resetsAt <= now) requestCounts.delete(key);
    }
  }
  const key = rateLimitKey(request);
  const current = requestCounts.get(key);
  if (!current || current.resetsAt <= now) {
    requestCounts.set(key, { count: 1, resetsAt: now + RATE_WINDOW_MS });
    return false;
  }
  if (current.count >= RATE_LIMIT) return true;
  current.count += 1;
  return false;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function safeUpstreamError(status: number): Response {
  if (status === 429) {
    return Response.json(
      { error: "The Hindi voice is busy right now.", fallback: true },
      { status: 429 },
    );
  }
  if (status === 401 || status === 403) {
    console.error("Chat-story voice backend rejected the request (auth).");
    return Response.json(
      { error: "The Hindi voice backend needs attention.", fallback: true },
      { status: 502 },
    );
  }
  console.error("Chat-story voice backend failed with status", status);
  return Response.json(
    { error: "The Hindi voice isn't available right now.", fallback: true },
    { status: 502 },
  );
}

async function handleSpeechRequest(request: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return Response.json({ error: "Invalid request." }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const language = body.language === "hi" ? "hi" : body.language === "en" ? "en" : null;
  const rawText = typeof body.text === "string" ? body.text : "";
  const speaker = typeof body.speaker === "string" ? body.speaker.slice(0, 80) : "narrator";
  const voiceId = typeof body.voiceId === "string" ? body.voiceId.slice(0, 80) : "Rohit";
  const speed =
    typeof body.speed === "number" && Number.isFinite(body.speed)
      ? Math.min(1.5, Math.max(0.6, body.speed))
      : 1;

  if (!language) return Response.json({ error: "Invalid request." }, { status: 400 });
  const text = sanitizeTextForServerTTS(rawText);
  if (!text || text.length > CHATSTORY_TTS_MAX_CHARS) {
    return Response.json({ error: "Only short story lines can be voiced." }, { status: 400 });
  }

  if (isRateLimited(request)) {
    return Response.json(
      { error: "Take a breather — the story voice is cooling down.", fallback: true },
      { status: 429 },
    );
  }

  const upstreamUrl = (process.env.CHATSTORY_TTS_URL ?? "").trim();
  if (!upstreamUrl) {
    return Response.json(
      { error: "The Hindi HD voice isn't set up yet.", fallback: true },
      { status: 503 },
    );
  }
  let upstream: URL;
  try {
    upstream = new URL(upstreamUrl);
    if (upstream.protocol !== "https:" && upstream.protocol !== "http:") throw new Error("bad");
  } catch {
    console.error("CHATSTORY_TTS_URL is not a valid http(s) URL.");
    return Response.json(
      { error: "The Hindi voice isn't available right now.", fallback: true },
      { status: 503 },
    );
  }

  // Server-side secret only. Never echoed to the client, logs, or errors.
  const hfToken = (process.env.HF_TOKEN ?? "").trim();
  const model = (process.env.CHATSTORY_TTS_MODEL ?? "ResembleAI/chatterbox").trim().slice(0, 120);

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstream, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(hfToken ? { Authorization: `Bearer ${hfToken}` } : {}),
      },
      body: JSON.stringify({ text, language, speaker, voiceId, speed, model }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (error) {
    console.error("Chat-story voice upstream request failed", {
      language,
      chars: text.length,
      timedOut: error instanceof DOMException && error.name === "TimeoutError",
    });
    return Response.json(
      { error: "The Hindi voice isn't available right now.", fallback: true },
      { status: 502 },
    );
  }

  if (!upstreamResponse.ok) return safeUpstreamError(upstreamResponse.status);

  const contentType = upstreamResponse.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("audio/")) {
      const bytes = new Uint8Array(await upstreamResponse.arrayBuffer());
      if (!bytes.byteLength || bytes.byteLength > 5_000_000) {
        return Response.json(
          { error: "The Hindi voice isn't available right now.", fallback: true },
          { status: 502 },
        );
      }
      return Response.json(
        { audio: toBase64(bytes), mimeType: contentType.split(";")[0], model, language },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const payload: unknown = await upstreamResponse.json();
    const record = payload as { audio?: unknown; mimeType?: unknown };
    if (typeof record.audio !== "string" || record.audio.length < 16) {
      return Response.json(
        { error: "The Hindi voice isn't available right now.", fallback: true },
        { status: 502 },
      );
    }
    const mimeType =
      typeof record.mimeType === "string" && record.mimeType.startsWith("audio/")
        ? record.mimeType
        : "audio/wav";
    return Response.json(
      { audio: record.audio, mimeType, model, language },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "The Hindi voice isn't available right now.", fallback: true },
      { status: 502 },
    );
  }
}

export const Route = createFileRoute("/api/chatstory-speech")({
  server: {
    handlers: {
      POST: async ({ request }) => handleSpeechRequest(request),
    },
  },
});
