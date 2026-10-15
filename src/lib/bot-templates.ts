import { supabase } from "@/integrations/supabase/client";
import { sanitizeEmbed, type EmbedData } from "@/lib/embeds";

/**
 * Per-bot embed templates (public.bot_templates).
 *
 * A built-in bot's next message in a realm renders its template with variables
 * substituted server-side. Without a row the bot keeps posting plain text —
 * except WELCOME, which falls back to the built-in welcome card. The editor in
 * Realm settings → Bots uses the helpers here for fetch/save/reset/test and
 * the exact same substitution the server does, so the preview never lies.
 */

export type BotEmbedTemplate = {
  bot_id: string;
  realm_id: string;
  embed: EmbedData;
  updated_at: string;
};

export const botTemplatesKey = (realmId: string) => ["bot-embed-templates", realmId] as const;

/** null = the templates migration isn't applied yet (the section says so). */
export async function fetchBotTemplates(realmId: string): Promise<BotEmbedTemplate[] | null> {
  try {
    // bot_templates lives behind a pending migration, so the generated client
    // types don't know it yet and the query goes through `any`.
    const { data, error } = await (supabase as any)
      .from("bot_templates")
      .select("bot_id, realm_id, embed, updated_at")
      .eq("realm_id", realmId);
    if (error) throw error;
    return (data ?? []) as BotEmbedTemplate[];
  } catch {
    return null;
  }
}

/** The bot's built-in default card (WELCOME), or null when it has none. */
export async function fetchBotDefaultEmbed(botId: string): Promise<EmbedData | null> {
  try {
    const { data, error } = await (supabase.rpc as any)("bot_default_embed", { _bot_id: botId });
    if (error) return null;
    return (data ?? null) as EmbedData | null;
  } catch {
    return null;
  }
}

export async function saveBotEmbedTemplate(botId: string, realmId: string, embed: EmbedData): Promise<void> {
  const clean = sanitizeEmbed(embed, { allowButton: true });
  if (clean.error || !clean.embed) throw new Error(clean.error ?? "That embed isn't valid");
  const { error } = await (supabase.rpc as any)("set_bot_embed_template", {
    _bot_id: botId,
    _realm_id: realmId,
    _embed: clean.embed,
  });
  if (error) throw new Error(error.message || "Couldn't save this embed");
}

/** Deletes the realm's template; returns the bot's default card when it has one. */
export async function resetBotEmbedTemplate(botId: string, realmId: string): Promise<EmbedData | null> {
  const { data, error } = await (supabase.rpc as any)("reset_bot_embed_template", {
    _bot_id: botId,
    _realm_id: realmId,
  });
  if (error) throw new Error(error.message || "Couldn't reset this embed");
  return ((data as { default?: EmbedData } | null)?.default ?? null) as EmbedData | null;
}

export async function sendBotEmbedTest(botId: string, realmId: string, roomId: string): Promise<void> {
  const { error } = await (supabase.rpc as any)("send_bot_embed_test", {
    _bot_id: botId,
    _realm_id: realmId,
    _realm_room_id: roomId,
  });
  if (error) throw new Error(error.message || "Couldn't send the test message");
}

/** Which variables actually fill in when this bot posts. */
export function templateVarsFor(botName: string): readonly string[] {
  return botName.trim().toUpperCase() === "WELCOME"
    ? ["{user}", "{username}", "{userAvatar}", "{realm}", "{memberCount}", "{date}", "{channel}"]
    : ["{realm}", "{memberCount}", "{date}", "{channel}"];
}

export type TemplatePreviewVars = {
  user: string;
  username: string;
  userAvatar: string;
  realm: string;
  memberCount: string;
  date: string;
  channel: string;
};

function substitute(text: string, vars: TemplatePreviewVars): string {
  return text.replace(/\{(user|username|userAvatar|realm|memberCount|date|channel)\}/g, (token, key: keyof TemplatePreviewVars) => {
    const value = vars[key];
    return value ? value : token;
  });
}

function swapStrings<T>(value: T, vars: TemplatePreviewVars): T {
  if (typeof value === "string") return substitute(value, vars) as unknown as T;
  if (Array.isArray(value)) return value.map((entry) => swapStrings(entry, vars)) as unknown as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, swapStrings(entry, vars)]),
    ) as T;
  }
  return value;
}

/** Mirrors the server's render cleanup: urls that stayed empty or unresolved go. */
function dropPlaceholderUrls(embed: EmbedData): EmbedData {
  const next: EmbedData = { ...embed };
  if (!next.url || next.url.includes("{")) delete next.url;
  if (!next.thumbnail?.url || next.thumbnail.url.includes("{")) delete next.thumbnail;
  if (!next.image?.url || next.image.url.includes("{")) delete next.image;
  if (!next.author?.icon_url || next.author.icon_url.includes("{")) {
    next.author = next.author ? { ...next.author, icon_url: undefined } : undefined;
  }
  if (!next.footer?.icon_url || next.footer.icon_url.includes("{")) {
    next.footer = next.footer ? { ...next.footer, icon_url: undefined } : undefined;
  }
  if (next.button?.user_id?.includes("{")) next.button = { ...next.button, user_id: undefined };
  return next;
}

/**
 * The same substitution the server does, for the live preview. Returns null
 * when the embed would not render (empty or broken) so the editor can say so
 * instead of showing a misleading card.
 */
export function renderEmbedPreview(embed: EmbedData, vars: TemplatePreviewVars): EmbedData | null {
  const substituted = dropPlaceholderUrls(swapStrings(embed, vars));
  const clean = sanitizeEmbed(substituted, { allowButton: true });
  return clean.embed ?? null;
}
