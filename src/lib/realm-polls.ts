import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { realmRpc, unwrapRpc, type RpcOutcome } from "@/lib/realm-rpc";

/**
 * Realm polls. The poll lives in `realm_polls`, its votes in
 * `realm_poll_votes`, and the chat renders it from the message's `card`
 * payload — so a poll message reads correctly even before this module loads.
 */

export type PollCard = {
  type: "poll";
  pollId: string;
  question: string;
  options: string[];
  multi: boolean;
  closesAt: string | null;
};

export type RealmPoll = {
  id: string;
  realm_id: string;
  realm_room_id: string | null;
  message_id: string | null;
  question: string;
  options: string[];
  multi: boolean;
  closes_at: string | null;
};

export type PollTallies = {
  /** Votes per option index, in `options` order. */
  counts: number[];
  total: number;
  /** Option indexes I have voted for. */
  mine: number[];
  closed: boolean;
};

export const realmPollsKey = (realmId: string | null | undefined, roomId: string | null | undefined) =>
  ["realm-polls", realmId ?? "", roomId ?? ""] as const;

/** Reads a poll straight off its chat message (used by the poll card). */
export async function fetchPoll(pollId: string): Promise<RealmPoll | null> {
  const { data, error } = await supabase
    .from("realm_polls" as any)
    .select("*")
    .eq("id", pollId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as RealmPoll | null;
}

/** Live tallies plus my own votes, refreshed whenever the poll table changes. */
export function usePollTallies(pollId: string | null | undefined, enabled = true) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["realm-poll-tallies", pollId ?? ""],
    enabled: enabled && !!pollId,
    staleTime: 5_000,
    queryFn: async (): Promise<PollTallies> => {
      const [poll, votes, mine] = await Promise.all([
        supabase.from("realm_polls" as any).select("options, closes_at").eq("id", pollId!).maybeSingle(),
        supabase.from("realm_poll_votes" as any).select("option_index").eq("poll_id", pollId!),
        supabase.auth.getUser(),
      ]);
      if (poll.error) throw poll.error;
      if (votes.error) throw votes.error;
      const options = ((poll.data as { options?: string[] } | null)?.options ?? []) as string[];
      const counts = new Array(options.length).fill(0) as number[];
      for (const row of (votes.data ?? []) as unknown as { option_index: number }[]) {
        if (row.option_index >= 0 && row.option_index < counts.length) counts[row.option_index] += 1;
      }
      const uid = mine.data.user?.id;
      const myVotes = uid
        ? ((votes.data ?? []) as unknown as { option_index: number }[]).map((row) => row.option_index)
        : [];
      const closesAt = (poll.data as { closes_at?: string | null } | null)?.closes_at ?? null;
      return {
        counts,
        total: counts.reduce((sum, count) => sum + count, 0),
        mine: myVotes,
        closed: !!closesAt && new Date(closesAt).getTime() <= Date.now(),
      };
    },
  });

  useEffect(() => {
    if (!pollId) return;
    const channel = supabase
      .channel(`realm-poll-${pollId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "realm_poll_votes", filter: `poll_id=eq.${pollId}` },
        () => void qc.invalidateQueries({ queryKey: ["realm-poll-tallies", pollId] }),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "realm_polls", filter: `id=eq.${pollId}` },
        () => void qc.invalidateQueries({ queryKey: ["realm-poll-tallies", pollId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [pollId, qc]);

  return query;
}

export async function createRealmPoll(input: {
  realmId: string;
  roomId: string | null;
  question: string;
  options: string[];
  multi?: boolean;
  minutes?: number;
}): Promise<{ pollId: string; messageId: string }> {
  const result = unwrapRpc(
    await realmRpc<RpcOutcome & { poll_id?: string; message_id?: string }>("create_realm_poll", {
      _realm_id: input.realmId,
      _realm_room_id: input.roomId,
      _question: input.question,
      _options: input.options,
      _multi: input.multi ?? false,
      _minutes: input.minutes ?? 0,
    }),
    "Couldn't start that poll",
  );
  return { pollId: String(result.poll_id ?? ""), messageId: String(result.message_id ?? "") };
}

export async function voteRealmPoll(pollId: string, option: number): Promise<void> {
  unwrapRpc(
    await realmRpc<RpcOutcome>("vote_realm_poll", { _poll_id: pollId, _option: option }),
    "Couldn't record that vote",
  );
}

/** Parses `/poll Pizza? | Yes | No` into the RPC's question + options. */
export function parsePollDraft(text: string): { question: string; options: string[] } | null {
  const parts = text.split("|").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 3) return null;
  const [question, ...options] = parts;
  if (!question || options.length < 2) return null;
  return { question, options };
}

export type RealmPollVoter = {
  user_id: string;
  option_index: number;
  user: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

export async function fetchRealmPollVoters(pollId: string): Promise<RealmPollVoter[]> {
  const { data: rawVotes } = await supabase
    .from("realm_poll_votes" as any)
    .select("user_id, option_index")
    .eq("poll_id", pollId);
  if (!rawVotes || rawVotes.length === 0) return [];
  const userIds = [...new Set(rawVotes.map((v: any) => v.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", userIds);
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  return rawVotes.map((v: any) => ({
    user_id: v.user_id,
    option_index: v.option_index,
    user: profileMap.get(v.user_id) ?? null,
  }));
}
