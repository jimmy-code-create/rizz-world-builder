import { supabase } from "@/integrations/supabase/client";

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

export async function fetchReactorProfiles(userIds: string[]) {
  if (!userIds.length) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", userIds);
  if (error) throw error;
  return data ?? [];
}
