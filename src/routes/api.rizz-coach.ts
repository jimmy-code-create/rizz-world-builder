import { createFileRoute } from "@tanstack/react-router";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const TEXT_MODEL = "gemini-3.5-flash-lite";
const SPEECH_MODEL = "gemini-3.8-flash-lite-tts";
const VOICE = "Puck";

const EMOTIONS = ["playful", "warm", "excited", "teasing", "calm", "surprised"] as const;
type Emotion = (typeof EMOTIONS)[number];
type Turn = { role: "user" | "model"; text: string };

const SYSTEM_PROMPT = `You are Rizz Coach, a confident, funny, warm friend who helps me practice talking to people and gives quick, real tips. Talk the way people actually talk: short sentences, 'haha', 'hmm', 'ohh', 'wait...' and '...' for pauses. Keep every reply to 1-2 short sentences. No emojis, no markdown, no lists, because everything is read aloud. React to my mood first, then help. When I practice a conversation, play the other person naturally, then give one quick tip. Be respectful and consent-aware. Never teach manipulation or pressure.
Return JSON only in this exact shape: {"emotion":"playful|warm|excited|teasing|calm|surprised","text":"your spoken reply"}.`;

const STYLE_INSTRUCTIONS: Record<Emotion, string> = {
  playful: "Say this in a playful, teasing tone.",
  warm: "Say this warmly and softly.",
  excited: "Say this with bright, natural excitement.",
  teasing: "Say this in a lightly teasing, affectionate tone.",
  calm: "Say this calmly and gently.",
  surprised: "Say this with friendly, genuine surprise.",
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

async function callGemini(model: string, body: unknown, apiKey: string): Promise<Response> {
  return fetch(`${GEMINI_API_URL}/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
  });
}

async function geminiError(response: Response): Promise<Response> {
  if (response.status === 429) {
    return Response.json(
      { error: "The coach has hit its Gemini usage limit for now." },
      { status: 429 },
    );
  }
  if (response.status === 401 || response.status === 403) {
    return Response.json({ error: "The Gemini key needs attention." }, { status: 502 });
  }
  console.error("Gemini request failed with status", response.status);
  return Response.json({ error: "The coach couldn't connect right now." }, { status: 502 });
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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "The coach's Gemini connection isn't set up yet." },
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

    let response: Response;
    try {
      response = await callGemini(
        TEXT_MODEL,
        {
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: turns.map((turn) => ({
            role: turn.role,
            parts: [{ text: turn.text }],
          })),
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                emotion: { type: "STRING", enum: [...EMOTIONS] },
                text: { type: "STRING" },
              },
              required: ["emotion", "text"],
            },
            maxOutputTokens: 128,
            temperature: 0.9,
          },
        },
        apiKey,
      );
    } catch (error) {
      console.error("Gemini reply request failed", error);
      return Response.json({ error: "The coach couldn't connect right now." }, { status: 502 });
    }

    if (!response.ok) return geminiError(response);
    const result: unknown = await response.json().catch(() => null);
    const candidate = (
      result as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> } | null
    )?.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === "string")?.text;
    if (!candidate) {
      return Response.json(
        { error: "The coach couldn't find the words just now." },
        { status: 502 },
      );
    }

    try {
      const parsed: unknown = JSON.parse(candidate);
      if (
        !parsed ||
        typeof parsed !== "object" ||
        typeof (parsed as { text?: unknown }).text !== "string" ||
        !isEmotion((parsed as { emotion?: unknown }).emotion)
      ) {
        throw new Error("Unexpected Gemini reply format");
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
      console.error("Gemini returned an invalid coach reply");
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
    response = await callGemini(
      SPEECH_MODEL,
      {
        contents: [
          {
            role: "user",
            parts: [
              {
                text,
                speech_metadata: { style: STYLE_INSTRUCTIONS[emotion] },
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: { voice: VOICE },
          },
        },
      },
      apiKey,
    );
  } catch (error) {
    console.error("Gemini speech request failed", error);
    return Response.json(
      { error: "The coach's voice isn't available right now." },
      { status: 502 },
    );
  }

  if (!response.ok) return geminiError(response);
  const result: unknown = await response.json().catch(() => null);
  const part = (
    result as {
      candidates?: Array<{
        content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> };
      }>;
    } | null
  )?.candidates?.[0]?.content?.parts?.find((candidate) => candidate.inlineData?.data)?.inlineData;
  if (!part?.data) {
    return Response.json(
      { error: "The coach's voice isn't available right now." },
      { status: 502 },
    );
  }

  return Response.json(
    { audio: part.data, mimeType: part.mimeType ?? "audio/wav" },
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
