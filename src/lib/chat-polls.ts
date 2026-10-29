import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Polls in DMs and groups.
 *
 * The shape is deliberately the same as the realm poll (`realm_polls`): the
 * message carries a `card` payload so the poll renders instantly, tallies come
 * from a votes table and stream over Realtime, and every write goes through an
 * RPC that re-checks membership, blocks and the closing time.
 */
export type ChatPollCardPayload = {
  type: "poll";
  pollId: string;
  question: string;
  options: string[];
  multi: boolean;
  closesAt: string | null;
};

export type ChatPollTallies = {
  /** Votes per option index, in `options` order. */
  counts: number[];
  total: number;
  /** Option indexes I have voted for. */
  mine: number[];
  closed: boolean;
};

export type ChatPollVoter = {
  user_id: string;
  option_index: number;
  user: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

/** A message's `card` column, narrowed to a poll (null for anything else). */
export function asChatPollCard(card: unknown): ChatPollCardPayload | null {
  if (!card || typeof card !== "object") return null;
  const value = card as Partial<ChatPollCardPayload>;
  if (value.type !== "poll") return null;
  if (typeof value.pollId !== "string" || !value.pollId) return null;
  if (!Array.isArray(value.options) || value.options.length < 2) return null;
  return {
    type: "poll",
    pollId: value.pollId,
    question: typeof value.question === "string" ? value.question : "Poll",
    options: value.options.filter((option): option is string => typeof option === "string"),
    multi: value.multi === true,
    closesAt: typeof value.closesAt === "string" ? value.closesAt : null,
  };
}

/** Live tallies plus my own votes, refreshed whenever the vote table changes. */
export function useChatPollTallies(pollId: string | null | undefined, enabled = true) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["chat-poll-tallies", pollId ?? ""],
    enabled: enabled && !!pollId,
    staleTime: 5_000,
    queryFn: async (): Promise<ChatPollTallies> => {
      const [poll, votes, me] = await Promise.all([
        supabase.from("chat_polls" as any).select("options, closes_at").eq("id", pollId!).maybeSingle(),
        supabase.from("chat_poll_votes" as any).select("user_id, option_index").eq("poll_id", pollId!),
        supabase.auth.getUser(),
      ]);
      if (poll.error) throw poll.error;
      if (votes.error) throw votes.error;
      const options = ((poll.data as { options?: string[] } | null)?.options ?? []) as string[];
      const rows = (votes.data ?? []) as unknown as { user_id: string; option_index: number }[];
      const counts = new Array(options.length).fill(0) as number[];
      for (const row of rows) {
        if (row.option_index >= 0 && row.option_index < counts.length) counts[row.option_index] += 1;
      }
      const uid = me.data.user?.id;
      const closesAt = (poll.data as { closes_at?: string | null } | null)?.closes_at ?? null;
      return {
        counts,
        total: counts.reduce((sum, count) => sum + count, 0),
        mine: uid ? rows.filter((row) => row.user_id === uid).map((row) => row.option_index) : [],
        closed: !!closesAt && new Date(closesAt).getTime() <= Date.now(),
      };
    },
  });

  useEffect(() => {
    if (!pollId) return;
    const channel = supabase
      .channel(`chat-poll-${pollId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_poll_votes", filter: `poll_id=eq.${pollId}` },
        () => void qc.invalidateQueries({ queryKey: ["chat-poll-tallies", pollId] }),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_polls", filter: `id=eq.${pollId}` },
        () => void qc.invalidateQueries({ queryKey: ["chat-poll-tallies", pollId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [pollId, qc]);

  return query;
}

type RpcEnvelope = { ok?: boolean; error?: string; poll_id?: string; message_id?: string };

/** Creates the poll and its message; the RPC owns both rows. */
export async function createChatPoll(input: {
  kind: "dm" | "group";
  groupId?: string;
  otherUserId?: string;
  question: string;
  options: string[];
  multi?: boolean;
  minutes?: number;
}): Promise<{ pollId: string; messageId: string }> {
  const { data, error } = await supabase.rpc("create_chat_poll" as any, {
    _kind: input.kind,
    _group_id: input.kind === "group" ? input.groupId ?? null : null,
    _other_user: input.kind === "dm" ? input.otherUserId ?? null : null,
    _question: input.question,
    _options: input.options,
    _multi: input.multi ?? false,
    _minutes: input.minutes ?? 0,
  } as any);
  const result = (data ?? {}) as RpcEnvelope;
  if (error) throw new Error(error.message || "Couldn't start that poll");
  if (result.ok === false) throw new Error(result.error || "Couldn't start that poll");
  return {
    pollId: String(result.poll_id ?? ""),
    messageId: String(result.message_id ?? ""),
  };
}

export async function voteChatPoll(pollId: string, option: number): Promise<void> {
  const { data, error } = await supabase.rpc("vote_chat_poll" as any, {
    _poll_id: pollId,
    _option: option,
  } as any);
  const result = (data ?? {}) as RpcEnvelope;
  if (error) throw new Error(error.message || "Couldn't record that vote");
  if (result.ok === false) throw new Error(result.error || "Couldn't record that vote");
}

/** Everyone who voted, grouped in the UI by `option_index`. */
export async function fetchChatPollVoters(pollId: string): Promise<ChatPollVoter[]> {
  const { data: rawVotes, error } = await supabase
    .from("chat_poll_votes" as any)
    .select("user_id, option_index")
    .eq("poll_id", pollId);
  if (error) throw error;
  if (!rawVotes || rawVotes.length === 0) return [];
  const rows = rawVotes as unknown as { user_id: string; option_index: number }[];
  const userIds = [...new Set(rows.map((vote) => vote.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", userIds);
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  return rows.map((vote) => ({
    user_id: vote.user_id,
    option_index: vote.option_index,
    user: profileMap.get(vote.user_id) ?? null,
  }));
}
