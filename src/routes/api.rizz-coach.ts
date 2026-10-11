import { createFileRoute } from "@tanstack/react-router";

const GROQ_API_URL = "https://api.groq.com/openai/v1";
const DEFAULT_TEXT_MODEL = "openai/gpt-oss-20b";
const DEFAULT_SPEECH_MODEL = "canopylabs/orpheus-v1-english";
const SPEECH_INPUT_LIMIT = 200;

const EMOTIONS = ["playful", "warm", "excited", "teasing", "calm", "surprised"] as const;
type Emotion = (typeof EMOTIONS)[number];
type Turn = { role: "user" | "model"; text: string };

const SYSTEM_PROMPT = `You are Rizz Coach, a confident, funny, warm friend who helps me practice talking to people and gives quick, real tips. Talk the way people actually talk: short sentences, 'haha', 'hmm', 'ohh', 'wait...' and '...' for pauses. Keep every reply to 1-2 short sentences. No emojis, no markdown, no lists, because everything is read aloud. React to my mood first, then help. When I practice a conversation, play the other person naturally, then give one quick tip. Be respectful and consent-aware. Never teach manipulation or pressure.
Return JSON only in this exact shape: {"emotion":"playful|warm|excited|teasing|calm|surprised","text":"your spoken reply"}.`;

// The spoken voice is chosen from the emotion, since the TTS model has no style control.
const EMOTION_VOICES: Record<Emotion, string> = {
  playful: "troy",
  warm: "hannah",
  excited: "autumn",
  teasing: "daniel",
  calm: "austin",
  surprised: "diana",
};

const requestCounts = new Map<string, { count: number; resetsAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60 * 60 * 1000;

function isEmotion(value: unknown): value is Emotion {
  return typeof value === "string" && EMOTIONS.includes(value as Emotion);
}

function sentenceCount(text: string): number {
  return (text.match(/[^.!?]+(?:[.!?]+|$)/g) ?? [])
    .map((sentence) => sentence.trim())
    .filter(Boolean).length;
}

function rateLimitKey(request: Request, mode: string): string {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = request.headers.get("cf-connecting-ip") ?? forwardedFor ?? "unknown";
  return `${address}:${mode}`;
}

function isRateLimited(request: Request, mode: string): boolean {
  const now = Date.now();
  if (requestCounts.size > 2_000) {
    for (const [key, value] of requestCounts) {
      if (value.resetsAt <= now) requestCounts.delete(key);
    }
  }

  const key = rateLimitKey(request, mode);
  const current = requestCounts.get(key);
  if (!current || current.resetsAt <= now) {
    requestCounts.set(key, { count: 1, resetsAt: now + RATE_WINDOW_MS });
    return false;
  }
  if (current.count >= RATE_LIMIT) return true;
  current.count += 1;
  return false;
}

function textModel(): string {
  return process.env.GROQ_MODEL?.trim() || DEFAULT_TEXT_MODEL;
}

function speechModel(): string {
  return process.env.GROQ_TTS_MODEL?.trim() || DEFAULT_SPEECH_MODEL;
}

async function callGroq(path: string, body: unknown, apiKey: string): Promise<Response> {
  return fetch(`${GROQ_API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
  });
}

async function groqError(response: Response): Promise<Response> {
  if (response.status === 429) {
    return Response.json(
      { error: "The coach has hit its usage limit for now." },
      { status: 429 },
    );
  }
  if (response.status === 401 || response.status === 403) {
    return Response.json({ error: "The coach's AI key needs attention." }, { status: 502 });
  }
  console.error("Groq request failed with status", response.status);
  return Response.json({ error: "The coach couldn't connect right now." }, { status: 502 });
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

async function handleCoachRequest(request: Request): Promise<Response> {
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

  const mode = body.mode;
  if (mode !== "reply" && mode !== "speech") {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  if (isRateLimited(request, mode)) {
    return Response.json(
      { error: "Take a breather — the coach is cooling down." },
      { status: 429 },
    );
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "The coach's AI connection isn't set up yet." },
      { status: 503 },
    );
  }

  if (mode === "reply") {
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message || message.length > 1_200) {
      return Response.json({ error: "Say a little less and try again." }, { status: 400 });
    }

    const context = Array.isArray(body.context)
      ? body.context
          .slice(-6)
          .filter(
            (turn): turn is Record<string, unknown> =>
              Boolean(turn) && typeof turn === "object" && !Array.isArray(turn),
          )
          .flatMap((turn): Turn[] => {
            if ((turn.role !== "user" && turn.role !== "model") || typeof turn.text !== "string") {
              return [];
            }
            const text = turn.text.trim().slice(0, 600);
            return text ? [{ role: turn.role, text }] : [];
          })
      : [];
    const turns: Turn[] = [...context, { role: "user", text: message }];

    const model = textModel();
    const replyPayload: Record<string, unknown> = {
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...turns.map((turn) => ({
          role: turn.role === "user" ? "user" : "assistant",
          content: turn.text,
        })),
      ],
      temperature: 0.9,
      max_completion_tokens: 128,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "coach_reply",
          strict: true,
          schema: {
            type: "object",
            properties: {
              emotion: { type: "string", enum: [...EMOTIONS] },
              text: { type: "string" },
            },
            required: ["emotion", "text"],
            additionalProperties: false,
          },
        },
      },
    };
    // The default brain is gpt-oss; skipping its reasoning pass keeps replies snappy.
    if (model.includes("gpt-oss")) replyPayload.reasoning_effort = "low";

    let response: Response;
    try {
      response = await callGroq("/chat/completions", replyPayload, apiKey);
    } catch (error) {
      console.error("Coach reply request failed", error);
      return Response.json({ error: "The coach couldn't connect right now." }, { status: 502 });
    }

    if (!response.ok) return groqError(response);
    const result: unknown = await response.json().catch(() => null);
    const candidate = (
      result as { choices?: Array<{ message?: { content?: string } }> } | null
    )?.choices?.[0]?.message?.content;
    if (!candidate) {
      return Response.json(
        { error: "The coach couldn't find the words just now." },
        { status: 502 },
      );
    }

    try {
      const cleaned = candidate
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      const parsed: unknown = JSON.parse(cleaned);
      if (
        !parsed ||
        typeof parsed !== "object" ||
        typeof (parsed as { text?: unknown }).text !== "string" ||
        !isEmotion((parsed as { emotion?: unknown }).emotion)
      ) {
        throw new Error("Unexpected coach reply format");
      }

      const reply = parsed as { emotion: Emotion; text: string };
      const text = reply.text.trim().slice(0, 500);
      if (!text || sentenceCount(text) > 2) {
        return Response.json(
          { error: "The coach couldn't find the words just now." },
          { status: 502 },
        );
      }
      return Response.json(
        { emotion: reply.emotion, text },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch {
      console.error("Groq returned an invalid coach reply");
      return Response.json(
        { error: "The coach couldn't find the words just now." },
        { status: 502 },
      );
    }
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const emotion = body.emotion;
  if (!text || text.length > 500 || sentenceCount(text) > 2 || !isEmotion(emotion)) {
    return Response.json({ error: "Only short coach replies can be voiced." }, { status: 400 });
  }

  let response: Response;
  try {
    response = await callGroq(
      "/audio/speech",
      {
        model: speechModel(),
        voice: EMOTION_VOICES[emotion],
        input: text.slice(0, SPEECH_INPUT_LIMIT),
        response_format: "wav",
      },
      apiKey,
    );
  } catch (error) {
    console.error("Coach speech request failed", error);
    return Response.json(
      { error: "The coach's voice isn't available right now." },
      { status: 502 },
    );
  }

  if (!response.ok) return groqError(response);
  const bytes = new Uint8Array(await response.arrayBuffer().catch(() => new ArrayBuffer(0)));
  if (!bytes.byteLength) {
    return Response.json(
      { error: "The coach's voice isn't available right now." },
      { status: 502 },
    );
  }

  return Response.json(
    { audio: toBase64(bytes), mimeType: "audio/wav" },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export const Route = createFileRoute("/api/rizz-coach")({
  server: {
    handlers: {
      POST: async ({ request }) => handleCoachRequest(request),
    },
  },
});
