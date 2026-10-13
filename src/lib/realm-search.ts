import { realmRpc } from "@/lib/realm-rpc";

/**
 * Message search runs entirely inside `search_realm_messages`: the function is
 * SECURITY DEFINER but re-checks realm access and hides private channels the
 * caller cannot see, so the browser only ever receives rows it may read.
 */

export type SearchResult = {
  id: string;
  realm_room_id: string | null;
  room_name: string | null;
  body: string;
  card: { type?: string; question?: string; title?: string } | null;
  thread_root: string | null;
  reply_count: number;
  created_at: string;
  sender_id: string | null;
  author_name: string | null;
  bot_name: string | null;
};

export async function searchRealmMessages(input: {
  realmId: string;
  query: string;
  roomId?: string | null;
  limit?: number;
}): Promise<SearchResult[]> {
  const term = input.query.trim();
  if (term.length < 2) return [];
  const data = await realmRpc<SearchResult[]>("search_realm_messages", {
    _realm_id: input.realmId,
    _query: term,
    _realm_room_id: input.roomId ?? null,
    _limit: input.limit ?? 30,
  });
  return Array.isArray(data) ? data : [];
}

/** `True` while the search box is worth querying. */
export function searchReady(query: string): boolean {
  return query.trim().length >= 2;
}
