import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type LilRizzTurn = {
  role: "user" | "model";
  text: string;
};

const requestSchema = z.object({
  message: z.string().trim().min(1).max(400),
  history: z.array(
    z.object({
      role: z.enum(["user", "model"]),
      text: z.string().trim().min(1).max(400),
    }),
  ).max(6),
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
  .inputValidator((input: { message: string; history: LilRizzTurn[] }) => requestSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Lil Rizz’s Gemini brain is not configured on the server.");
    }

    const contents = [
      ...data.history.map((turn) => ({
        role: turn.role,
        parts: [{ text: turn.text }],
      })),
      { role: "user", parts: [{ text: data.message }] },
    ];

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          generationConfig: { maxOutputTokens: 60, temperature: 0.85 },
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (!response.ok) {
      console.error("[Lil Rizz] Gemini request failed with status", response.status);
      throw new Error("Lil Rizz’s reply service is temporarily unavailable.");
    }

    const payload = (await response.json()) as GeminiResponse;
    const reply = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();

    if (!reply) throw new Error("Lil Rizz’s reply service returned an empty response.");
    return { reply: reply.slice(0, 800) };
  });

export function generateLilRizzReply(input: { message: string; history: LilRizzTurn[] }) {
  return generateLilRizzReplyServer({ data: input });
}
