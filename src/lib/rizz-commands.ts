import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Central voice-command router for Rizz.
 *
 * To add a command: append one entry to VOICE_COMMANDS. No other code changes
 * needed — matching, speak-back and execution all derive from this table.
 */

export type RizzCommandId =
  | "open:feed"
  | "open:reels"
  | "open:explore"
  | "open:groups"
  | "open:realms"
  | "open:drops"
  | "open:dms"
  | "open:stories"
  | "open:bookmarks"
  | "open:effects"
  | "open:badges"
  | "open:leaderboard"
  | "open:notifications"
  | "open:settings"
  | "open:voice"
  | "open:profile"
  | "action:back"
  | "action:close"
  | "action:create-story"
  | "action:handsfree-on"
  | "action:handsfree-off";

export type VoiceCommand = {
  id: RizzCommandId;
  /** Route to navigate to (null = pure action). */
  path: string | null;
  /** Params for TanStack router (e.g. profile needs username). */
  params?: Record<string, string>;
  /** Keywords in Hindi (Devanagari), English and Hinglish (Roman). */
  keywords: string[];
  /** Short spoken confirmation, Hinglish to match the app vibe. */
  speak: string;
};

export const VOICE_COMMANDS: VoiceCommand[] = [
  { id: "open:feed", path: "/feed", keywords: ["feed", "home", "ghar", "home page", "timeline"], speak: "Feed khol raha hu" },
  { id: "open:reels", path: "/reels", keywords: ["reel", "reels", "reel section", "videos", "reels section"], speak: "Reels khol raha hu" },
  { id: "open:explore", path: "/explore", keywords: ["explore", "discover", "dhundo", "explore section"], speak: "Explore khol raha hu" },
  { id: "open:groups", path: "/groups", keywords: ["group", "groups", "group section", "groups section"], speak: "Groups khol raha hu" },
  { id: "open:realms", path: "/realms", keywords: ["realm", "realms", "community", "channels", "voice", "voice channel", "voice channels", "awaz"], speak: "Realms khol raha hu" },
  { id: "open:drops", path: "/drops", keywords: ["drop", "drops", "giveaway", "giveaways"], speak: "Drops khol raha hu" },
  { id: "open:dms", path: "/dms", keywords: ["dm", "dms", "chat", "chats", "message", "messages", "inbox"], speak: "Chat khol raha hu" },
  { id: "open:stories", path: "/chat-stories", keywords: ["story", "stories", "chat story", "chat stories", "story section"], speak: "Stories khol raha hu" },
  { id: "open:bookmarks", path: "/bookmarks", keywords: ["bookmark", "bookmarks", "saved", "save kia hua"], speak: "Saved posts khol raha hu" },
  { id: "open:effects", path: "/effects", keywords: ["effect", "effects", "effects section"], speak: "Effects khol raha hu" },
  { id: "open:badges", path: "/badges", keywords: ["badge", "badges", "badges section"], speak: "Badges khol raha hu" },
  { id: "open:leaderboard", path: "/leaderboard", keywords: ["leaderboard", "top", "ranking", "rank"], speak: "Leaderboard khol raha hu" },
  { id: "open:notifications", path: "/notifications", keywords: ["notification", "notifications", "bell", "alerts"], speak: "Notifications khol raha hu" },
  { id: "open:settings", path: "/settings", keywords: ["setting", "settings", "preferences"], speak: "Settings khol raha hu" },
  { id: "open:profile", path: "/u/$username", params: { username: "" }, keywords: ["profile", "mera profile", "my profile"], speak: "Profile khol raha hu" },
  { id: "action:back", path: null, keywords: ["wapas jao", "peeche jao", "go back", "back", "return", "wapas"], speak: "Theek hai, peeche ja raha hu" },
  { id: "action:close", path: null, keywords: ["band karo", "close", "quit", "close rizz", "stop listening", "band"], speak: "Theek hai, milte hai!" },
  { id: "action:create-story", path: "/chat-stories", keywords: ["story bana do", "ek story banao", "story banao", "create story", "make a story", "make story", "new story", "story start"], speak: "Story bana rahe hai, chalo shuru karte hai" },
  { id: "action:handsfree-on", path: null, keywords: ["hands free mode", "hands-free", "bina dekhe baat karo", "hands free on", "always listen"], speak: "Hands free mode on, main sun raha hu" },
  { id: "action:handsfree-off", path: null, keywords: ["hands free off", "hands free band", "normal mode"], speak: "Hands free mode off" },
];

/** Text normalization shared by local matching. */
export function normalizeCommandText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s\u0900-\u097F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cheap edit distance (≤ max) for fuzzy keyword matching. */
function editDistanceWithin(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min((prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
      rowMin = Math.min(rowMin, cur[j] ?? 0);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length] ?? max + 1;
}

/** Score one keyword against the user's words. 1 = exact, ≥0.65 = fuzzy hit. */
function scoreKeyword(keyword: string, words: string[]): number {
  const kw = keyword.split(" ");
  if (kw.length > 1) {
    // Multi-word phrase: match as a contiguous sequence.
    const phrase = kw.join(" ");
    for (let i = 0; i + kw.length <= words.length; i += 1) {
      if (words.slice(i, i + kw.length).join(" ") === phrase) return 1;
    }
    return 0;
  }
  let best = 0;
  for (const word of words) {
    if (word === keyword) return 1;
    if (keyword.length >= 4 && editDistanceWithin(keyword, word, 1) === 1) best = Math.max(best, 0.8);
    else if (keyword.length >= 4 && word.startsWith(keyword)) best = Math.max(best, 0.7);
  }
  return best;
}

export type CommandMatch = { command: VoiceCommand; score: number };

/** Local keyword + fuzzy match. Returns the best command above threshold, or null. */
export function matchVoiceCommand(text: string): CommandMatch | null {
  const normalized = normalizeCommandText(text);
  if (!normalized) return null;
  const words = normalized.split(" ");
  let best: CommandMatch | null = null;
  for (const command of VOICE_COMMANDS) {
    for (const keyword of command.keywords) {
      const score = scoreKeyword(keyword, words);
      if (score >= 0.65 && (!best || score > best.score)) {
        best = { command, score };
      }
    }
  }
  // Prefer a specific action over a plain section-open when scores tie.
  if (best && best.score < 1) {
    const exact = VOICE_COMMANDS.find(
      (c) => c.id.startsWith("action:") && c.keywords.some((k) => scoreKeyword(k, words) === 1),
    );
    if (exact) return { command: exact, score: 1 };
  }
  return best;
}

// ---------------------------------------------------------------------------
// AI fallback: only consulted when the local router is unsure. The model maps
// free-form Hinglish/English to a known command id or returns null.
// ---------------------------------------------------------------------------

const aiRequestSchema = z.object({ text: z.string().trim().min(1).max(200) });

const interpretVoiceCommandServer = createServerFn({ method: "POST" })
  .inputValidator((input: { text: string }) => aiRequestSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return { commandId: null as RizzCommandId | null };
    const model = process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-20b";
    const commandIds = VOICE_COMMANDS.map((c) => c.id).join(", ");
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: `You map a voice command (Hindi, English or Hinglish) to exactly one app command id. Reply with ONLY the id or NONE.\nValid ids: ${commandIds}\nExamples: "reel section kholo" -> open:reels; "ek story bana do" -> action:create-story; "band karo" -> action:close; "kya haal hai" -> NONE.`,
            },
            { role: "user", content: data.text },
          ],
          temperature: 0,
          max_completion_tokens: 40,
        }),
        signal: AbortSignal.timeout(6_000),
      });
      if (!response.ok) return { commandId: null as RizzCommandId | null };
      const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const raw = (body.choices?.[0]?.message?.content ?? "").trim().replace(/["'.]/g, "");
      const found = VOICE_COMMANDS.find((c) => c.id === raw);
      return { commandId: found?.id ?? null };
    } catch {
      return { commandId: null as RizzCommandId | null };
    }
  });

/** Resolve a transcript to a command: local router first, AI fallback if unsure. */
export async function resolveVoiceCommand(text: string): Promise<CommandMatch | null> {
  const local = matchVoiceCommand(text);
  if (local && local.score >= 0.8) return local;
  try {
    const { commandId } = await interpretVoiceCommandServer({ data: { text } });
    if (commandId) {
      const command = VOICE_COMMANDS.find((c) => c.id === commandId);
      if (command) return { command, score: 1 };
    }
  } catch {
    // AI fallback unavailable — fall through to whatever local match we had.
  }
  return local;
}
