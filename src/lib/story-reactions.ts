/**
 * Story Reactions System
 *
 * Handles real-time reactions to stories (Instagram-style).
 * Supports: ❤️ 😂 😮 😢 🔥 👏
 *
 * DB shape (see 20260810023549 migration): `public.story_reactions` has NO
 * `id` column — its primary key is (story_id, user_id, emoji), so one user
 * can leave several different emoji on the same story. The viewer keeps
 * that multi-emoji model (`myReactions: string[]`).
 */

import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export const STORY_REACTIONS = ["❤️", "😂", "😮", "😢", "🔥", "👏"] as const;
export type StoryReactionEmoji = (typeof STORY_REACTIONS)[number];

export type StoryReaction = {
  story_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

export type StoryReactionCount = {
  emoji: string;
  count: number;
  users: string[]; // user IDs
};

/**
 * Get reactions for a story.
 *
 * Deliberately selects no profile join: the RLS policy lets a viewer read
 * only their own rows plus (for the author) the story's rows, and the UI
 * only needs counts. A join would fail closed for non-authors.
 */
export async function fetchStoryReactions(storyId: string): Promise<StoryReaction[]> {
  const { data, error } = await supabase
    .from("story_reactions")
    .select("story_id, user_id, emoji, created_at")
    .eq("story_id", storyId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Add a reaction to a story.
 *
 * A (story_id, user_id, emoji) duplicate just means "already reacted" —
 * treat it as success so optimistic UI never rolls back on a double tap.
 */
export async function addStoryReaction(
  storyId: string,
  userId: string,
  emoji: StoryReactionEmoji,
): Promise<void> {
  const { error } = await supabase
    .from("story_reactions")
    .insert({ story_id: storyId, user_id: userId, emoji });

  if (error) {
    if (error.code === "23505") return;
    throw error;
  }

  // Notify story creator (best-effort; never blocks the reaction).
  await notifyStoryCreator(storyId, userId, emoji);
}

/**
 * Remove reaction(s) from a story. With an emoji, only that row goes;
 * without one, all of the user's rows go (back-compat for single-reaction UI).
 */
export async function removeStoryReaction(
  storyId: string,
  userId: string,
  emoji?: StoryReactionEmoji | string,
): Promise<void> {
  let query = supabase
    .from("story_reactions")
    .delete()
    .eq("story_id", storyId)
    .eq("user_id", userId);
  if (emoji) query = query.eq("emoji", emoji);

  const { error } = await query;
  if (error) throw error;
}

/**
 * Get reaction counts grouped by emoji.
 */
export function aggregateReactions(reactions: StoryReaction[]): StoryReactionCount[] {
  const grouped = reactions.reduce(
    (acc, reaction) => {
      const emoji = reaction.emoji;
      if (!acc[emoji]) {
        acc[emoji] = { emoji, count: 0, users: [] };
      }
      acc[emoji].count++;
      acc[emoji].users.push(reaction.user_id);
      return acc;
    },
    {} as Record<string, StoryReactionCount>,
  );

  return Object.values(grouped).sort((a, b) => b.count - a.count);
}

/**
 * All emoji the user left on a story (multi-emoji model).
 */
export function getUserReactions(reactions: StoryReaction[], userId: string): string[] {
  return reactions.filter((r) => r.user_id === userId).map((r) => r.emoji);
}

/**
 * Check if user has reacted to a story (single-reaction back-compat).
 */
export function getUserReaction(
  reactions: StoryReaction[],
  userId: string,
): StoryReactionEmoji | null {
  const userReaction = reactions.find((r) => r.user_id === userId);
  return (userReaction?.emoji as StoryReactionEmoji | undefined) ?? null;
}

/**
 * Notify story creator of new reaction (best-effort).
 */
async function notifyStoryCreator(
  storyId: string,
  reactorId: string,
  emoji: string,
): Promise<void> {
  // Stories carry `author_id` (not `user_id`).
  const { data: story } = await supabase
    .from("stories")
    .select("author_id")
    .eq("id", storyId)
    .single();

  if (!story || story.author_id === reactorId) return; // Don't notify self

  try {
    await supabase.from("notifications").insert({
      user_id: story.author_id,
      actor_id: reactorId,
      type: "story_reaction",
      title: "New story reaction",
      body: `${emoji}`,
      data: { story_id: storyId, reactor_id: reactorId, emoji },
    });
  } catch {
    // Notifications are best-effort
  }
}

/**
 * React hook for story reactions, with realtime live-updates.
 */
export function useStoryReactions(storyId: string, userId?: string) {
  const qc = useQueryClient();
  const queryKey = ["story-reactions", storyId];

  const query = useQuery({
    queryKey,
    queryFn: () => fetchStoryReactions(storyId),
    enabled: !!storyId,
  });

  useEffect(() => {
    if (!storyId) return;
    const channel = supabase
      .channel(`story-reactions:${storyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "story_reactions",
          filter: `story_id=eq.${storyId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // queryKey is stable per storyId; qc is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyId]);

  const addMutation = useMutation({
    mutationFn: (emoji: StoryReactionEmoji) => addStoryReaction(storyId, userId!, emoji),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (emoji?: StoryReactionEmoji | string) =>
      removeStoryReaction(storyId, userId!, emoji),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
    },
  });

  const reactions = query.data ?? [];
  const counts = aggregateReactions(reactions);
  const myReactions = userId ? getUserReactions(reactions, userId) : [];
  const myReaction = userId ? getUserReaction(reactions, userId) : null;
  const totalCount = reactions.length;

  return {
    reactions,
    counts,
    myReactions,
    myReaction,
    totalCount,
    isLoading: query.isLoading,
    addReaction: addMutation.mutate,
    removeReaction: removeMutation.mutate,
    isAdding: addMutation.isPending || removeMutation.isPending,
  };
}

/**
 * Subscribe to real-time reaction updates.
 */
export function subscribeToStoryReactions(storyId: string, onUpdate: () => void) {
  const channel = supabase
    .channel(`story-reactions:${storyId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "story_reactions",
        filter: `story_id=eq.${storyId}`,
      },
      onUpdate,
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
