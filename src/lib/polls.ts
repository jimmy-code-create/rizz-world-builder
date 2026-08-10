import { supabase } from "@/integrations/supabase/client";

export type PollOption = { id: string; label: string; position: number; vote_count: number };
export type Poll = {
  id: string;
  post_id: string;
  question: string;
  closes_at: string | null;
  total_votes: number;
  options: PollOption[];
  my_option_id: string | null;
};

export async function createPoll(postId: string, question: string, labels: string[], hours: number) {
  const clean = labels.map((l) => l.trim().slice(0, 80)).filter(Boolean).slice(0, 4);
  if (clean.length < 2) throw new Error("A poll needs at least 2 options");
  const closes_at = new Date(Date.now() + Math.max(1, Math.min(168, hours)) * 3600_000).toISOString();
  const { data: poll, error } = await supabase
    .from("post_polls")
    .insert({ post_id: postId, question: question.trim().slice(0, 200) || "Poll", closes_at })
    .select("id")
    .single();
  if (error) throw error;
  const { error: oErr } = await supabase
    .from("post_poll_options")
    .insert(clean.map((label, i) => ({ poll_id: poll.id, label, position: i })));
  if (oErr) throw oErr;
  return poll.id;
}

export async function fetchPoll(postId: string, userId?: string | null): Promise<Poll | null> {
  const { data: poll } = await supabase
    .from("post_polls")
    .select("id, post_id, question, closes_at, total_votes")
    .eq("post_id", postId)
    .maybeSingle();
  if (!poll) return null;
  const { data: options } = await supabase
    .from("post_poll_options")
    .select("id, label, position, vote_count")
    .eq("poll_id", poll.id)
    .order("position", { ascending: true });
  let my_option_id: string | null = null;
  if (userId) {
    const { data: vote } = await supabase
      .from("post_poll_votes")
      .select("option_id")
      .eq("poll_id", poll.id)
      .eq("user_id", userId)
      .maybeSingle();
    my_option_id = vote?.option_id ?? null;
  }
  return { ...poll, options: (options ?? []) as PollOption[], my_option_id };
}

export async function votePoll(pollId: string, optionId: string, userId: string) {
  const { error } = await supabase
    .from("post_poll_votes")
    .insert({ poll_id: pollId, option_id: optionId, user_id: userId });
  if (error) {
    if (/duplicate/i.test(error.message)) throw new Error("You already voted in this poll");
    throw error;
  }
}