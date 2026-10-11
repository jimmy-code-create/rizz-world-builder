import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GEMINI_CONFIG = {
  endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
  apiKeyEnv: "GEMINI_API_KEY",
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

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
};

const generateLilRizzReplyServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { message: string; history: LilRizzTurn[] }) =>
    requestSchema.parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env[GEMINI_CONFIG.apiKeyEnv];
    if (!apiKey) {
      throw new Error(`${GEMINI_CONFIG.apiKeyEnv} is not configured on the server.`);
    }

    const contents = [
      ...data.history.map((turn) => ({
        role: turn.role,
        parts: [{ text: turn.text }],
      })),
      { role: "user", parts: [{ text: data.message }] },
    ];

    const response = await fetch(GEMINI_CONFIG.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: {
          temperature: GEMINI_CONFIG.temperature,
          maxOutputTokens: GEMINI_CONFIG.maxOutputTokens,
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const responseBody = await response.text();
    if (!response.ok) {
      console.error("[Lil Rizz] Gemini request failed", response.status);
      throw new Error(`GEMINI_HTTP_${response.status}`);
    }

    let payload: GeminiResponse;
    try {
      payload = JSON.parse(responseBody) as GeminiResponse;
    } catch {
      console.error("[Lil Rizz] Gemini returned an invalid response", response.status);
      throw new Error("GEMINI_EMPTY_RESPONSE");
    }
    const reply = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();

    if (!reply) {
      console.error("[Lil Rizz] Gemini returned an empty response", response.status);
      throw new Error("GEMINI_EMPTY_RESPONSE");
    }
    return { reply: reply.slice(0, 800) };
  });

export function generateLilRizzReply(input: { message: string; history: LilRizzTurn[] }) {
  return generateLilRizzReplyServer({ data: input });
}
