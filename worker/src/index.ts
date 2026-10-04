import {
  buildPushPayload,
  type PushMessage,
  type PushSubscription,
  type VapidKeys,
} from "@block65/webcrypto-web-push";

type PushNotice = {
  type?: "message" | "group_mention" | "call" | "call_cancel" | "test";
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
  icon?: string;
  image?: string;
  call_id?: string;
  requireInteraction?: boolean;
};

type SpeechTurn = {
  speaker: string;
  text: string;
  voice?: string;
  style?: string;
};

type TtsRequest = {
  story_id?: string;
  scene_id?: string;
  turns: SpeechTurn[];
};

const MAX_PUSH_SUBSCRIPTIONS = 100;
const MAX_TTS_REQUEST_CHARS = 20_000;
const MAX_MODEL_CHUNK_CHARS = 3_000;
const AUDIO_SAMPLE_RATE = 24_000;
const VAPID_TTL_SECONDS = 60 * 60 * 12;

function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

function configured(value: string | undefined) {
  return Boolean(value && !value.startsWith("REPLACE_"));
}

function corsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get("origin");
  if (!origin || !configured(env.ALLOWED_ORIGIN) || origin !== env.ALLOWED_ORIGIN) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-max-age": "86400",
    "access-control-expose-headers": "x-tts-remaining",
    vary: "Origin",
  };
}

function isAllowedPushEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return host === "fcm.googleapis.com"
      || host === "updates.push.services.mozilla.com"
      || host.endsWith(".push.services.mozilla.com")
      || host === "web.push.apple.com"
      || host.endsWith(".notify.windows.com");
  } catch {
    return false;
  }
}

function safeNotice(input: PushNotice): PushNotice {
  const url = input.url?.startsWith("/") && !input.url.startsWith("//")
    ? input.url
    : "/";
  return {
    type: input.type,
    title: (input.title || "RIZZ").slice(0, 80),
    body: (input.body || "You have a new notification.").slice(0, 180),
    url,
    tag: (input.tag || "rizz-notification").slice(0, 64),
    icon: "/rizz-pwa.svg",
    call_id: input.call_id?.slice(0, 64),
    requireInteraction: Boolean(input.requireInteraction),
  };
}

async function deleteExpiredSubscription(endpoint: string, env: Env) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY || !env.SUPABASE_URL) return;
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/push_subscriptions`);
  url.searchParams.set("endpoint", `eq.${endpoint}`);
  try {
    await fetch(url, {
      method: "DELETE",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        prefer: "return=minimal",
      },
    });
  } catch (error) {
    console.error("Could not remove expired push endpoint", error);
  }
}

async function handlePush(request: Request, env: Env) {
  if (!env.PUSH_SHARED_SECRET) return json({ error: "Push delivery is not configured" }, 503);
  if (!constantTimeEqual(request.headers.get("x-push-secret") ?? "", env.PUSH_SHARED_SECRET)) {
    return json({ error: "Unauthorized" }, 401);
  }
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    return json({ error: "VAPID keys are not configured" }, 503);
  }

  const length = Number(request.headers.get("content-length") || 0);
  if (length > 128_000) return json({ error: "Request is too large" }, 413);

  let input: { subscriptions?: PushSubscription[]; payload?: PushNotice };
  try {
    input = await request.json();
  } catch {
    return json({ error: "Expected a JSON request body" }, 400);
  }

  const subscriptions = Array.isArray(input.subscriptions)
    ? input.subscriptions.slice(0, MAX_PUSH_SUBSCRIPTIONS)
    : [];
  if (subscriptions.length === 0) return json({ sent: 0, expired: 0 });

  const notice = safeNotice(input.payload ?? {});
  const vapid: VapidKeys = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };
  const message: PushMessage = {
    data: JSON.stringify(notice),
    options: {
      ttl: notice.type === "call" ? 90 : 60 * 60 * 12,
      urgency: notice.type === "call" ? "high" : "normal",
      topic: (notice.tag || "rizz").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) || "rizz",
    },
  };

  let sent = 0;
  let expired = 0;
  const results = await Promise.all(subscriptions.map(async (subscription) => {
    if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth
        || !isAllowedPushEndpoint(subscription.endpoint)) {
      return "invalid" as const;
    }
    try {
      const init = await buildPushPayload(message, subscription, vapid);
      const response = await fetch(subscription.endpoint, init);
      if (response.status === 404 || response.status === 410) {
        await deleteExpiredSubscription(subscription.endpoint, env);
        return "expired" as const;
      }
      if (!response.ok) {
        console.warn("Push provider rejected delivery", response.status);
        return "failed" as const;
      }
      return "sent" as const;
    } catch (error) {
      console.error("Push delivery failed", error);
      return "failed" as const;
    }
  }));
  for (const result of results) {
    if (result === "sent") sent += 1;
    if (result === "expired") expired += 1;
  }
  return json({ sent, expired });
}

function constantTimeEqual(left: string, right: string) {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) difference |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return difference === 0;
}

function splitTurns(turns: SpeechTurn[]) {
  const chunks: SpeechTurn[][] = [];
  let current: SpeechTurn[] = [];
  let currentLength = 0;
  for (const turn of turns) {
    let remaining = turn.text.trim();
    while (remaining) {
      const room = MAX_MODEL_CHUNK_CHARS - currentLength;
      if (room <= 0) {
        chunks.push(current);
        current = [];
        currentLength = 0;
        continue;
      }
      const piece = remaining.slice(0, room);
      const lastBoundary = Math.max(piece.lastIndexOf(". "), piece.lastIndexOf("! "), piece.lastIndexOf("? "), piece.lastIndexOf("\n"));
      const take = remaining.length > room && lastBoundary > room * 0.55 ? lastBoundary + 1 : piece.length;
      const text = remaining.slice(0, take).trim();
      if (text) {
        current.push({ ...turn, text });
        currentLength += text.length + 1;
      }
      remaining = remaining.slice(take).trim();
      if (remaining && currentLength >= MAX_MODEL_CHUNK_CHARS - 1) {
        chunks.push(current);
        current = [];
        currentLength = 0;
      }
    }
  }
  if (current.length) chunks.push(current);
  return chunks;
}

function speakerName(value: string, index: number) {
  const cleaned = value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24);
  return cleaned || `Speaker${index + 1}`;
}

async function requestGeminiAudio(turns: SpeechTurn[], env: Env) {
  const rawSpeakers = [...new Set(turns.map((turn) => turn.speaker))];
  const speakers = rawSpeakers.map((speaker, index) => speakerName(speaker, index));
  const speakerVoiceConfigs = speakers.map((speaker, index) => {
    const turn = turns.find((entry) => entry.speaker === rawSpeakers[index]);
    return {
      speaker,
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: (turn?.voice || "Kore").slice(0, 40),
        },
      },
    };
  });
  const transcript = turns.map((turn, index) => {
    const speaker = speakerName(turn.speaker, rawSpeakers.indexOf(turn.speaker));
    const style = turn.style?.trim().slice(0, 200);
    return `${speakers.length > 1 ? `${speaker}: ` : ""}${style ? `[${style}] ` : ""}${turn.text}`;
  }).join("\n");
  const model = env.GEMINI_TTS_MODEL || "gemini-3.8-flash-tts";
  const speechConfig = speakers.length > 1
    ? { multiSpeakerVoiceConfig: { speakerVoiceConfigs } }
    : { voiceConfig: speakerVoiceConfigs[0]?.voiceConfig };
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: transcript }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig,
        },
      }),
    },
  );
  if (!response.ok) {
    const retryAfter = response.headers.get("retry-after");
    const details = await response.text();
    throw new GeminiError(response.status, details.slice(0, 500), retryAfter);
  }
  const result = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string } }> } }>;
  };
  const data = result.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData?.data;
  if (!data) throw new Error("Gemini returned no audio data");
  return Uint8Array.from(atob(data), (character) => character.charCodeAt(0));
}

class GeminiError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfter: string | null,
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

function joinBytes(chunks: Uint8Array[]) {
  const output = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function toWav(pcm: Uint8Array, sampleRate: number) {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const write = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + pcm.length, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, pcm.length, true);
  return joinBytes([new Uint8Array(header), pcm]);
}

async function authenticateUser(request: Request, env: Env) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, authorization },
  });
  return response.ok;
}

async function consumeTtsQuota(request: Request, env: Env, chars: number) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/tts_consume`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      authorization: request.headers.get("authorization") ?? "",
      "content-type": "application/json",
    },
    body: JSON.stringify({ _chars: chars }),
  });
  if (response.status === 429) {
    throw new GeminiError(429, "Daily voice-generation limit reached", null);
  }
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body.slice(0, 300) || "Could not reserve TTS quota");
  }
  const remaining = await response.json() as number;
  return Number.isFinite(remaining) ? remaining : 0;
}

async function handleTts(request: Request, env: Env) {
  const cors = corsHeaders(request, env);
  if (!configured(env.SUPABASE_URL) || !configured(env.SUPABASE_ANON_KEY)) {
    return json({ error: "Supabase Worker variables are not configured" }, 503, cors);
  }
  if (!env.GEMINI_API_KEY) return json({ error: "Gemini TTS is not configured" }, 503, cors);
  if (!request.headers.get("origin") || request.headers.get("origin") !== env.ALLOWED_ORIGIN) {
    return json({ error: "Origin is not allowed" }, 403, cors);
  }
  if (!await authenticateUser(request, env)) return json({ error: "Sign in to generate audio" }, 401, cors);

  const length = Number(request.headers.get("content-length") || 0);
  if (length > 100_000) return json({ error: "Request is too large" }, 413, cors);
  let input: TtsRequest;
  try {
    input = await request.json();
  } catch {
    return json({ error: "Expected a JSON request body" }, 400, cors);
  }
  if (!input || !Array.isArray(input.turns) || input.turns.length === 0 || input.turns.length > 500) {
    return json({ error: "Provide between 1 and 500 speech turns" }, 400, cors);
  }
  const turns: SpeechTurn[] = input.turns.map((turn) => ({
    speaker: typeof turn?.speaker === "string" ? turn.speaker.slice(0, 24) : "",
    text: typeof turn?.text === "string" ? turn.text.trim() : "",
    voice: typeof turn?.voice === "string" ? turn.voice.slice(0, 40) : "Kore",
    style: typeof turn?.style === "string" ? turn.style.slice(0, 200) : "",
  })).filter((turn) => turn.speaker && turn.text);
  const speakers = new Set(turns.map((turn) => turn.speaker));
  const charCount = turns.reduce((total, turn) => total + turn.text.length, 0);
  if (!turns.length || speakers.size > 2) {
    return json({ error: "Each request can use at most two speakers. Split this scene into speaker pairs." }, 400, cors);
  }
  if (charCount > MAX_TTS_REQUEST_CHARS) {
    return json({ error: `A request can contain at most ${MAX_TTS_REQUEST_CHARS} characters` }, 413, cors);
  }

  try {
    const remaining = await consumeTtsQuota(request, env, charCount);
    const pcmChunks: Uint8Array[] = [];
    for (const chunk of splitTurns(turns)) {
      pcmChunks.push(await requestGeminiAudio(chunk, env));
    }
    const audio = toWav(joinBytes(pcmChunks), AUDIO_SAMPLE_RATE);
    return new Response(audio, {
      headers: {
        ...cors,
        "content-type": "audio/wav",
        "cache-control": "no-store",
        "x-tts-remaining": String(remaining),
        "access-control-expose-headers": "x-tts-remaining",
      },
    });
  } catch (error) {
    if (error instanceof GeminiError) {
      const retry = error.retryAfter ? { "retry-after": error.retryAfter } : {};
      return json(
        { error: error.status === 429 ? "Gemini is rate-limiting requests. Try again shortly." : "Gemini could not generate this audio." },
        error.status === 429 ? 429 : error.status >= 500 ? 502 : 400,
        { ...cors, ...retry },
      );
    }
    console.error("TTS request failed", error);
    return json({ error: error instanceof Error ? error.message : "Audio generation failed" }, 502, cors);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }
    if (url.pathname === "/health" && request.method === "GET") {
      return json({ ok: true, service: "rizz-push-tts" });
    }
    if (url.pathname === "/push" && request.method === "POST") {
      return handlePush(request, env);
    }
    if (url.pathname === "/tts" && request.method === "POST") {
      return handleTts(request, env);
    }
    return json({ error: "Not found" }, 404);
  },
};