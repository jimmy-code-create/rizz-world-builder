import { supabase } from "@/integrations/supabase/client";
import { generateBotToken, hashBotToken } from "@/lib/bots";
import type { EmbedData } from "@/lib/embeds";
import { untypedFrom } from "@/lib/untyped-db";

export type WebhookBot = {
  id: string;
  realm_id: string;
  name: string;
  avatar_url: string | null;
  created_by: string;
  default_room_id: string | null;
  revoked: boolean;
  created_at: string;
};

export const webhookBotsKey = (realmId: string) => ["realm-webhook-bots", realmId] as const;

/** Webhook bots live behind a pending migration; missing table => empty list. */
export async function fetchWebhookBots(realmId: string): Promise<WebhookBot[]> {
  try {
    const { data, error } = await untypedFrom(supabase)("realm_bots")
      .select("id, realm_id, name, avatar_url, created_by, default_room_id, revoked, created_at")
      .eq("realm_id", realmId)
      .eq("revoked", false)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as WebhookBot[];
  } catch {
    return [];
  }
}

export function webhookUrlFor(botId: string, secret: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/api/bot-webhook/${botId}/${secret}`;
}

/** Create a bot. Returns the bot + the ONE-TIME secret for the webhook URL. */
export async function createWebhookBot(input: {
  realmId: string;
  name: string;
  avatarUrl?: string | null;
}): Promise<{ bot: WebhookBot; secret: string }> {
  const name = input.name.trim().slice(0, 32);
  if (name.length < 2) throw new Error("Give the bot a name (2–32 characters)");
  const secret = generateBotToken().replace(/^rbot_/, "rwh_");
  const tokenHash = await hashBotToken(secret);
  const { data, error } = await untypedFrom(supabase)("realm_bots")
    .insert({
      realm_id: input.realmId,
      name,
      avatar_url: input.avatarUrl?.trim() || null,
      token_hash: tokenHash,
      created_by: (await supabase.auth.getUser()).data.user?.id,
    })
    .select("id, realm_id, name, avatar_url, created_by, default_room_id, revoked, created_at")
    .maybeSingle();
  if (error) throw new Error(mapBotError(error.message));
  return { bot: data as WebhookBot, secret };
}

export async function regenerateWebhookSecret(botId: string): Promise<string> {
  const secret = generateBotToken().replace(/^rbot_/, "rwh_");
  const tokenHash = await hashBotToken(secret);
  const { error } = await untypedFrom(supabase)("realm_bots")
    .update({ token_hash: tokenHash })
    .eq("id", botId);
  if (error) throw new Error(mapBotError(error.message));
  return secret;
}

export async function revokeWebhookBot(botId: string): Promise<void> {
  const { error } = await untypedFrom(supabase)("realm_bots")
    .update({ revoked: true })
    .eq("id", botId);
  if (error) throw new Error(mapBotError(error.message));
}

export async function setWebhookBotChannel(botId: string, roomId: string | null): Promise<void> {
  const { error } = await untypedFrom(supabase)("realm_bots")
    .update({ default_room_id: roomId })
    .eq("id", botId);
  if (error) throw new Error(mapBotError(error.message));
}

/** Send a test message through the webhook (used by the embed builder). */
export async function sendWebhookTest(input: {
  webhookUrl: string;
  content: string;
  embeds: EmbedData[];
  roomId?: string | null;
}): Promise<void> {
  const response = await fetch(input.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(input.content.trim() ? { content: input.content.trim() } : {}),
      ...(input.embeds.length > 0 ? { embeds: input.embeds } : {}),
      ...(input.roomId ? { room_id: input.roomId } : {}),
    }),
  });
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) throw new Error(payload?.error ?? "The test message didn't go through");
}

function mapBotError(message: string): string {
  if (/realm_bots|does not exist|relation/i.test(message)) {
    return "Webhook bots need the latest backend update — apply the pending migration first.";
  }
  if (/row-level|policy|permission|not authorized/i.test(message)) {
    return "Only realm owners and admins can manage bots.";
  }
  return message || "Couldn't save that bot";
}
