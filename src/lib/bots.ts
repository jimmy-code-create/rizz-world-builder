import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RealmSlashCommand, SlashCommandOption } from "@/lib/bot-commands";

/**
 * Bots: realm-only. Every function here talks to a SECURITY DEFINER RPC that
 * re-checks membership, the install flag and the caller's permission, so this
 * module is the UI's convenience layer and not the security boundary.
 *
 * Bot tokens are generated in the browser and only their sha256 hash is ever
 * sent to the database, so a leaked row cannot be replayed as a token.
 */

export type BotDelivery = "webhook" | "gateway";

export type DirectoryBot = {
  bot_id: string;
  name: string;
  description: string;
  avatar_url: string | null;
  is_builtin: boolean;
  owner_id: string | null;
  installs: number;
  commands: { name: string; description: string }[];
};

export type OwnedBotCommand = {
  id: string;
  name: string;
  description: string;
  options: SlashCommandOption[];
  enabled_globally: boolean;
};

export type OwnedBot = {
  bot_id: string;
  name: string;
  description: string;
  avatar_url: string | null;
  token_prefix: string;
  token_rotated_at: string;
  delivery: BotDelivery;
  webhook_url: string | null;
  scopes: string[];
  is_public: boolean;
  installs: number;
  commands: OwnedBotCommand[];
};

export type RealmBotSummary = {
  bot_id: string;
  name: string;
  description: string;
  avatar_url: string | null;
  is_builtin: boolean;
  enabled: boolean;
  commands: { id: string; name: string; description: string }[];
};

export type RealmBotsPayload = {
  can_manage: boolean;
  allow_member_bots: boolean;
  bots: RealmBotSummary[];
  channel_settings: { command_id: string; realm_room_id: string | null; enabled: boolean }[];
};

// --------------------------------------------------------------- tokens
const TOKEN_BYTES = 24;

/** A fresh bot token. Shown to its owner exactly once. */
export function generateBotToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `rbot_${hex}`;
}

/** sha256 hex of a bot token — the only form that is ever stored. */
export async function hashBotToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function tokenPrefix(token: string): string {
  return `${token.slice(0, 9)}…${token.slice(-4)}`;
}

function rpcError(error: { message?: string } | null, fallback: string): never | void {
  if (error) throw new Error(error.message || fallback);
}

/** The RPCs answer `{ ok, error }` so failures read as sentences, not codes. */
function unwrap(data: unknown, fallback: string): Record<string, unknown> {
  const payload = (data ?? {}) as Record<string, unknown>;
  if (payload.ok === false) {
    throw new Error(typeof payload.error === "string" ? payload.error : fallback);
  }
  return payload;
}

// ------------------------------------------------------- authoring (my bots)
export async function fetchMyBots(): Promise<OwnedBot[]> {
  const { data, error } = await (supabase.rpc as any)("my_bots");
  rpcError(error, "Couldn't load your bots");
  return (data ?? []) as OwnedBot[];
}

export async function createCustomBot(input: {
  name: string;
  description: string;
  avatarUrl?: string | null;
  delivery: BotDelivery;
  webhookUrl?: string | null;
}): Promise<{ botId: string; token: string }> {
  const token = generateBotToken();
  const tokenHash = await hashBotToken(token);
  const { data, error } = await (supabase.rpc as any)("create_bot", {
    _name: input.name.trim(),
    _description: input.description.trim(),
    _avatar_url: input.avatarUrl ?? null,
    _delivery: input.delivery,
    _webhook_url: input.webhookUrl ?? null,
    _scopes: ["messages.write", "reactions.write"],
    _token_hash: tokenHash,
    _token_prefix: tokenPrefix(token),
  });
  rpcError(error, "Couldn't create that bot");
  const payload = unwrap(data, "Couldn't create that bot");
  return { botId: String(payload.bot_id), token };
}

export async function updateCustomBot(input: {
  botId: string;
  name: string;
  description: string;
  avatarUrl?: string | null;
  delivery: BotDelivery;
  webhookUrl?: string | null;
}): Promise<void> {
  const { data, error } = await (supabase.rpc as any)("update_bot", {
    _bot_id: input.botId,
    _name: input.name.trim(),
    _description: input.description.trim(),
    _avatar_url: input.avatarUrl ?? null,
    _delivery: input.delivery,
    _webhook_url: input.webhookUrl ?? null,
  });
  rpcError(error, "Couldn't save that bot");
  unwrap(data, "Couldn't save that bot");
}

export async function regenerateBotToken(botId: string): Promise<string> {
  const token = generateBotToken();
  const tokenHash = await hashBotToken(token);
  const { data, error } = await (supabase.rpc as any)("regenerate_bot_token", {
    _bot_id: botId,
    _token_hash: tokenHash,
    _token_prefix: tokenPrefix(token),
  });
  rpcError(error, "Couldn't regenerate that token");
  unwrap(data, "Couldn't regenerate that token");
  return token;
}

export async function setBotPublic(botId: string, isPublic: boolean): Promise<void> {
  const { data, error } = await (supabase.rpc as any)("set_bot_public", {
    _bot_id: botId,
    _public: isPublic,
  });
  rpcError(error, "Couldn't update that bot");
  unwrap(data, "Couldn't update that bot");
}

export async function deleteCustomBot(botId: string): Promise<void> {
  const { data, error } = await (supabase.rpc as any)("delete_bot", { _bot_id: botId });
  rpcError(error, "Couldn't delete that bot");
  unwrap(data, "Couldn't delete that bot");
}

export async function registerBotCommand(input: {
  botId: string;
  name: string;
  description: string;
  options?: SlashCommandOption[];
}): Promise<void> {
  const { data, error } = await (supabase.rpc as any)("register_bot_command", {
    _bot_id: input.botId,
    _name: input.name.trim().toLowerCase(),
    _description: input.description.trim(),
    _options: input.options ?? [],
  });
  rpcError(error, "Couldn't register that command");
  unwrap(data, "Couldn't register that command");
}

export async function deleteBotCommand(botId: string, commandId: string): Promise<void> {
  const { data, error } = await (supabase.rpc as any)("delete_bot_command", {
    _bot_id: botId,
    _command_id: commandId,
  });
  rpcError(error, "Couldn't remove that command");
  unwrap(data, "Couldn't remove that command");
}

// ------------------------------------------------------------- the directory
export async function fetchBotDirectory(search = ""): Promise<DirectoryBot[]> {
  const { data, error } = await (supabase.rpc as any)("bot_directory", {
    _search: search.trim() || null,
  });
  rpcError(error, "Couldn't load the bot directory");
  return (data ?? []) as DirectoryBot[];
}

export const botDirectoryKey = (search: string) => ["bot-directory", search.trim()] as const;
export const myBotsKey = ["my-bots"] as const;
export const realmBotsKey = (realmId: string | null | undefined) => ["realm-bots", realmId ?? ""] as const;
export const realmSlashCommandsKey = (realmId: string | null | undefined, roomId: string | null | undefined) =>
  ["realm-slash-commands", realmId ?? "", roomId ?? ""] as const;

// ------------------------------------------------------------ realm installs
export async function fetchRealmBots(realmId: string): Promise<RealmBotsPayload> {
  const { data, error } = await (supabase.rpc as any)("realm_bots", { _realm_id: realmId });
  rpcError(error, "Couldn't load this realm's bots");
  const payload = (data ?? null) as RealmBotsPayload | null;
  return {
    can_manage: payload?.can_manage ?? false,
    allow_member_bots: payload?.allow_member_bots ?? false,
    bots: payload?.bots ?? [],
    channel_settings: payload?.channel_settings ?? [],
  };
}

export async function installRealmBot(realmId: string, botId: string): Promise<void> {
  const { data, error } = await (supabase.rpc as any)("install_realm_bot", {
    _realm_id: realmId,
    _bot_id: botId,
  });
  rpcError(error, "Couldn't add that bot");
  unwrap(data, "Couldn't add that bot");
}

export async function uninstallRealmBot(realmId: string, botId: string): Promise<void> {
  const { data, error } = await (supabase.rpc as any)("uninstall_realm_bot", {
    _realm_id: realmId,
    _bot_id: botId,
  });
  rpcError(error, "Couldn't remove that bot");
  unwrap(data, "Couldn't remove that bot");
}

export async function setRealmBotEnabled(realmId: string, botId: string, enabled: boolean): Promise<void> {
  const { data, error } = await (supabase.rpc as any)("set_realm_bot_enabled", {
    _realm_id: realmId,
    _bot_id: botId,
    _enabled: enabled,
  });
  rpcError(error, "Couldn't change that bot");
  unwrap(data, "Couldn't change that bot");
}

export async function setRealmAllowMemberBots(realmId: string, allow: boolean): Promise<void> {
  const { data, error } = await (supabase.rpc as any)("set_realm_allow_member_bots", {
    _realm_id: realmId,
    _allow: allow,
  });
  rpcError(error, "Couldn't change that setting");
  unwrap(data, "Couldn't change that setting");
}

export async function setRealmMemberManageBots(
  realmId: string,
  userId: string,
  allowed: boolean,
): Promise<void> {
  const { data, error } = await (supabase.rpc as any)("set_realm_member_manage_bots", {
    _realm_id: realmId,
    _user_id: userId,
    _allowed: allowed,
  });
  rpcError(error, "Couldn't change that permission");
  unwrap(data, "Couldn't change that permission");
}

export async function setBotCommandChannelEnabled(input: {
  realmId: string;
  roomId: string | null;
  commandId: string;
  enabled: boolean;
}): Promise<void> {
  const { data, error } = await (supabase.rpc as any)("set_bot_command_channel_enabled", {
    _realm_id: input.realmId,
    _realm_room_id: input.roomId,
    _command_id: input.commandId,
    _enabled: input.enabled,
  });
  rpcError(error, "Couldn't change that command");
  unwrap(data, "Couldn't change that command");
}

// --------------------------------------------------------------- commands
/**
 * The commands the composer offers in one channel.
 *
 * Kept live over realtime so installing a bot or switching a command off lands
 * everywhere without a refresh.
 */
export function useRealmSlashCommands(realmId: string | null | undefined, roomId: string | null | undefined) {
  const qc = useQueryClient();
  const enabled = !!realmId;

  const query = useQuery({
    queryKey: realmSlashCommandsKey(realmId, roomId),
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<RealmSlashCommand[]> => {
      const { data, error } = await (supabase.rpc as any)("realm_slash_commands", {
        _realm_id: realmId,
        _realm_room_id: roomId ?? null,
      });
      if (error) throw error;
      return (data ?? []) as RealmSlashCommand[];
    },
  });

  useEffect(() => {
    if (!realmId) return;
    const channel = supabase
      .channel(`realm-bot-commands-${realmId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "realm_bot_installs", filter: `realm_id=eq.${realmId}` },
        () => {
          void qc.invalidateQueries({ queryKey: ["realm-slash-commands", realmId] });
          void qc.invalidateQueries({ queryKey: realmBotsKey(realmId) });
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "bot_commands" }, () => {
        void qc.invalidateQueries({ queryKey: ["realm-slash-commands", realmId] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [realmId, qc]);

  return {
    commands: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export const realmBotsQueryKey = realmBotsKey;

// -------------------------------------------------------------- execution
async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export type BotCommandResult = { ok: boolean; error?: string; message_id?: string; body?: string };

/**
 * Runs a slash command.
 *
 * The realm id is required by the request itself, so a DM or a group can never
 * reach a bot even if a caller crafts the request by hand.
 */
export async function runBotCommand(input: {
  command: string;
  args: string;
  realmId: string;
  roomId: string | null;
}): Promise<BotCommandResult> {
  const response = await fetch("/api/bot/command", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({
      command: input.command,
      args: input.args,
      realmId: input.realmId,
      roomId: input.roomId,
    }),
  });

  const payload = (await response.json().catch(() => null)) as BotCommandResult | null;
  if (!response.ok) {
    return { ok: false, error: payload?.error ?? "That command didn't work" };
  }
  return payload ?? { ok: false, error: "That command didn't work" };
}

/** Settles expired rizzbattles. Safe to call often; it is a no-op when idle. */
export async function settleRealmBotBattles(realmId: string): Promise<void> {
  await (supabase.rpc as any)("rizz_bot_settle_realm", { _realm_id: realmId });
}
