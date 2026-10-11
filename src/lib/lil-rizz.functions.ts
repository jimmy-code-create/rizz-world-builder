import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GROQ_CONFIG = {
  endpoint: "https://api.groq.com/openai/v1/chat/completions",
  apiKeyEnv: "GROQ_API_KEY",
  defaultModel: "openai/gpt-oss-20b",
  temperature: 0.7,
  maxOutputTokens: 400,
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

type GroqChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
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

    const model = process.env.GROQ_MODEL?.trim() || GROQ_CONFIG.defaultModel;
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...data.history.map((turn) => ({
        role: turn.role === "user" ? "user" : "assistant",
        content: turn.text,
      })),
      { role: "user", content: data.message },
    ];

    const payload: Record<string, unknown> = {
      model,
      messages,
      temperature: GROQ_CONFIG.temperature,
      max_completion_tokens: GROQ_CONFIG.maxOutputTokens,
    };
    // The default brain is gpt-oss; skipping its reasoning pass keeps replies snappy.
    if (model.includes("gpt-oss")) payload.reasoning_effort = "low";

    const response = await fetch(GROQ_CONFIG.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });

    const responseBody = await response.text();
    if (!response.ok) {
      console.error("[Lil Rizz] Groq request failed", response.status);
      throw new Error(`GROQ_HTTP_${response.status}`);
    }

    let chat: GroqChatResponse;
    try {
      chat = JSON.parse(responseBody) as GroqChatResponse;
    } catch {
      console.error("[Lil Rizz] Groq returned an invalid response", response.status);
      throw new Error("GROQ_EMPTY_RESPONSE");
    }
    const reply = chat.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      console.error("[Lil Rizz] Groq returned an empty response", response.status);
      throw new Error("GROQ_EMPTY_RESPONSE");
    }
    return { reply: reply.slice(0, 800) };
  });

export function generateLilRizzReply(input: { message: string; history: LilRizzTurn[] }) {
  return generateLilRizzReplyServer({ data: input });
}
