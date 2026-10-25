import { supabase } from "@/integrations/supabase/client";
import { fetchBlocked } from "@/lib/social";

/**
 * Chat reactions for DMs, realm chat and group chat.
 *
 * All three go through SECURITY DEFINER RPCs so membership is enforced in the
 * database — see supabase/migrations/20261013000000_fix_chat_reaction_rpcs.sql
 * and 20261022000000_fix_realm_reaction_toggle.sql (the partial-index repair).
 *  * DMs use `dm_reactions` + toggle_dm_reaction(_message_id uuid, _emoji text)
 *  * Realm and group messages share `message_reactions` with a message_type of
 *    'realm' / 'group' + toggle_message_reaction(_message_id, _emoji, _message_type)
 */
export type ReactionScope = "dm" | "realm" | "group";

export type ReactionRow = { message_id: string; user_id: string; emoji: string };

export type ReactionGroup = { emoji: string; count: number; mine: boolean };

/** Long-press bar: six quick emojis plus a "+" that opens the wider grid. */
export const QUICK_REACTIONS = ["❤️", "🔥", "😂", "😮", "😢", "👏"] as const;

export const MORE_REACTIONS = [
  "😍", "🙌", "💯", "🥹", "🎉", "🤔", "😭", "😅", "🤣", "😎",
  "🥰", "😳", "🙈", "💀", "👀", "✨", "💖", "🤝", "👑", "🫶",
  "🤯", "😴", "🤢", "🖤",
] as const;

/** Double tapping a message reacts with this. */
export const DOUBLE_TAP_REACTION = "❤️";

/** Never surface the raw database error to the user. */
export const REACTION_FAILED_MESSAGE = "Couldn't react";

function rpcName(scope: ReactionScope) {
  return scope === "dm" ? "toggle_dm_reaction" : "toggle_message_reaction";
}

function tableName(scope: ReactionScope) {
  return scope === "dm" ? "dm_reactions" : "message_reactions";
}

export function reactionsQueryKey(scope: ReactionScope, messageIds: string[]) {
  return ["chat-reactions", scope, [...messageIds].sort().join(",")] as const;
}

export function reactorsQueryKey(scope: ReactionScope, messageId: string, emoji: string) {
  return ["chat-reactors", scope, messageId, emoji] as const;
}

/**
 * One row per (message, user, emoji).
 *
 * The optimistic update and the realtime echo of the same reaction arrive
 * separately, so both paths run through this: the chip never doubles up and the
 * chat never flickers between two states.
 */
export function dedupeReactionRows(rows: ReactionRow[]): ReactionRow[] {
  const seen = new Set<string>();
  const result: ReactionRow[] = [];
  for (const row of rows) {
    if (!row?.message_id || !row.user_id || !row.emoji) continue;
    const key = `${row.message_id}|${row.user_id}|${row.emoji}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }
  return result;
}

/** Every reaction for the messages currently on screen, in one request. */
export async function fetchReactionRows(scope: ReactionScope, messageIds: string[]): Promise<ReactionRow[]> {
  if (!messageIds.length) return [];
  let query = (supabase.from as any)(tableName(scope))
    .select("message_id, user_id, emoji")
    .in("message_id", messageIds);
  if (scope !== "dm") query = query.eq("message_type", scope);
  const { data, error } = await query;
  if (error) throw error;
  return dedupeReactionRows((data ?? []) as ReactionRow[]);
}

export async function toggleReaction(scope: ReactionScope, messageId: string, emoji: string): Promise<void> {
  const args =
    scope === "dm"
      ? { _message_id: messageId, _emoji: emoji }
      : { _message_id: messageId, _emoji: emoji, _message_type: scope };

  const call = async () => {
    const { error } = await (supabase.rpc as any)(rpcName(scope), args);
    if (error) throw error;
  };

  try {
    await call();
  } catch (firstError) {
    // One automatic retry before the chip rolls back: a dropped connection or a
    // just-reloaded PostgREST schema cache both clear on the second attempt.
    console.warn(`[reactions] ${rpcName(scope)} failed, retrying once`, firstError);
    await new Promise((resolve) => setTimeout(resolve, 350));
    try {
      await call();
    } catch (error) {
      // The RPC's own error text is for developers, not users.
      console.error(`[reactions] ${rpcName(scope)} failed`, error);
      throw new Error(REACTION_FAILED_MESSAGE);
    }
  }
}

export function groupReactionRows(rows: ReactionRow[], messageId: string, userId?: string): ReactionGroup[] {
  const grouped = new Map<string, ReactionGroup>();
  for (const row of rows) {
    if (row.message_id !== messageId) continue;
    const entry = grouped.get(row.emoji) ?? { emoji: row.emoji, count: 0, mine: false };
    entry.count += 1;
    if (userId && row.user_id === userId) entry.mine = true;
    grouped.set(row.emoji, entry);
  }
  return [...grouped.values()].sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
}

/** Every surface that can show reactions, keyed the same way everywhere. */
export type ReactionItemSource =
  | { kind: "post"; id: string }
  | { kind: "comment"; id: string }
  | { kind: "message"; id: string; scope: ReactionScope };

export type ReactorPerson = {
  userId: string;
  emoji: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  createdAt: string | null;
};

export function reactionSourceKey(source: ReactionItemSource): string {
  return source.kind === "message"
    ? `message:${source.scope}:${source.id}`
    : `${source.kind}:${source.id}`;
}

export function reactionSourceTable(source: ReactionItemSource) {
  if (source.kind === "post") return { table: "post_reactions", column: "post_id", type: null };
  if (source.kind === "comment") return { table: "comment_reactions", column: "comment_id", type: null };
  return {
    table: source.scope === "dm" ? "dm_reactions" : "message_reactions",
    column: "message_id",
    type: source.scope === "dm" ? null : source.scope,
  };
}

/**
 * Everyone who reacted to one item, with profiles already resolved.
 *
 * One request per open sheet/tooltip: the blocking filter and the profile join
 * happen here instead of once per row, so nothing is fetched in a loop.
 */
export async function fetchItemReactors(
  source: ReactionItemSource,
  options: { emoji?: string | null; viewerId?: string | null; limit?: number } = {},
): Promise<ReactorPerson[]> {
  const { table, column, type } = reactionSourceTable(source);
  let query = (supabase.from as any)(table)
    .select("emoji, user_id, created_at")
    .eq(column, source.id)
    .order("created_at", { ascending: true })
    .limit(options.limit ?? 300);
  if (type) query = query.eq("message_type", type);
  if (options.emoji) query = query.eq("emoji", options.emoji);

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as { emoji: string; user_id: string; created_at: string | null }[];
  if (!rows.length) return [];

  const blocked = options.viewerId ? await fetchBlocked(options.viewerId) : [];
  const blockedIds = new Set(blocked.map((row: { blocked_id: string }) => row.blocked_id));
  const visible = rows.filter((row) => row.user_id && !blockedIds.has(row.user_id));
  if (!visible.length) return [];

  const ids = [...new Set(visible.map((row) => row.user_id))];
  const { data: people, error: peopleError } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", ids);
  if (peopleError) throw peopleError;

  const byId = new Map(
    (
      (people ?? []) as {
        id: string;
        username: string | null;
        display_name: string | null;
        avatar_url: string | null;
      }[]
    ).map((person) => [person.id, person]),
  );

  // Me first, then the order people reacted in.
  return visible
    .map((row) => {
      const person = byId.get(row.user_id);
      return {
        userId: row.user_id,
        emoji: row.emoji,
        name: person?.display_name || person?.username || "Someone",
        username: person?.username ?? null,
        avatarUrl: person?.avatar_url ?? null,
        createdAt: row.created_at,
      };
    })
    .sort((a, b) => {
      if (options.viewerId) {
        if (a.userId === options.viewerId) return -1;
        if (b.userId === options.viewerId) return 1;
      }
      return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
    });
}

export { describeReactors, sortReactionGroups } from "@/lib/reaction-text";

export async function fetchReactorProfiles(userIds: string[]) {
  if (!userIds.length) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", userIds);
  if (error) throw error;
  return data ?? [];
}
