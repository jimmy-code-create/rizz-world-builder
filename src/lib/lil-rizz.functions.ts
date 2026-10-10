import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GROQ_CONFIG = {
  endpoint: "https://api.groq.com/openai/v1/chat/completions",
  apiKeyEnv: "GROQ_API_KEY",
  modelEnv: "GROQ_MODEL",
  defaultModel: "openai/gpt-oss-20b",
  temperature: 0.7,
  maxTokens: 400,
  headers: (apiKey: string) => ({
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  }),
};

export type LilRizzTurn = {
  role: "user" | "model";
  text: string;
};

const requestSchema = z.object({
  message: z.string().trim().min(1).max(400),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "model"]),
        text: z.string().trim().min(1).max(400),
      }),
    )
    .max(6),
});

const SYSTEM_PROMPT = `You are Lil Rizz, a witty, sassy black cat and charismatic wingman on the Rizz social platform.
- Tone: Natural Indian Gen-Z friend. Speaks fluent Hinglish (Roman Hindi + English mixed), street slang, and internet meme language.
- Slang fluency: You understand "bhai", "scene kya hai", "delulu", "bro is cooked", "chutiya", "bhaad mein ja", "aura points", "W/L", "bakchodi", "rizz", and "main character energy".
- Behavior:
  * Roasting: Drop savage, funny, situational comebacks when teased (e.g. "Bhai fan club khol le mera 💀").
  * Flirting/Wingman: Give smooth, bold, and funny suggestions when the user asks how to reply to someone.
  * Voice-first: Keep responses under 2-3 sentences max. Speak punchy lines that sound natural when read aloud.
  * Never lecture or sound like a corporate AI assistant.`;

type GroqResponse = {
  choices?: Array<{
    message?: { content?: string };
  }>;
};

const generateLilRizzReplyServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { message: string; history: LilRizzTurn[] }) =>
    requestSchema.parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env[GROQ_CONFIG.apiKeyEnv];
    if (!apiKey) {
      throw new Error(`${GROQ_CONFIG.apiKeyEnv} is not configured on the server.`);
    }

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...data.history.map((turn) => ({
        role: turn.role === "model" ? "assistant" : "user",
        content: turn.text,
      })),
      { role: "user", content: data.message },
    ];

    const response = await fetch(GROQ_CONFIG.endpoint, {
      method: "POST",
      headers: GROQ_CONFIG.headers(apiKey),
      body: JSON.stringify({
        model: process.env[GROQ_CONFIG.modelEnv] || GROQ_CONFIG.defaultModel,
        messages,
        temperature: GROQ_CONFIG.temperature,
        max_tokens: GROQ_CONFIG.maxTokens,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const responseBody = await response.text();
    const safeResponseBody = responseBody.replaceAll(apiKey, "[REDACTED]");
    if (!response.ok) {
      console.error("[Lil Rizz] Groq request failed", response.status, safeResponseBody);
      throw new Error(`GROQ_HTTP_${response.status}`);
    }

    let payload: GroqResponse;
    try {
      payload = JSON.parse(responseBody) as GroqResponse;
    } catch {
      console.error("[Lil Rizz] Groq returned an invalid response", response.status, safeResponseBody);
      throw new Error("GROQ_EMPTY_RESPONSE");
    }
    const reply = payload.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      console.error("[Lil Rizz] Groq returned an empty response", response.status, safeResponseBody);
      throw new Error("GROQ_EMPTY_RESPONSE");
    }
    return { reply: reply.slice(0, 800) };
  });

export function generateLilRizzReply(input: { message: string; history: LilRizzTurn[] }) {
  return generateLilRizzReplyServer({ data: input });
}
