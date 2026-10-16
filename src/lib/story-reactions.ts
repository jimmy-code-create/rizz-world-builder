/**
 * Story Reactions System
 * 
 * Handles real-time reactions to stories (Instagram-style)
 * Supports: ❤️ 😂 😮 😢 🔥 👏
 */

import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export const STORY_REACTIONS = ["❤️", "😂", "😮", "😢", "🔥", "👏"] as const;
export type StoryReactionEmoji = typeof STORY_REACTIONS[number];

export type StoryReaction = {
  id: string;
  story_id: string;
  user_id: string;
  emoji: StoryReactionEmoji;
  created_at: string;
  user?: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
};

export type StoryReactionCount = {
  emoji: StoryReactionEmoji;
  count: number;
  users: string[]; // user IDs
};

/**
 * Get reactions for a story
 */
export async function fetchStoryReactions(storyId: string): Promise<StoryReaction[]> {
  const { data, error } = await supabase
    .from("story_reactions")
    .select(`
      id,
      story_id,
      user_id,
      emoji,
      created_at,
      user:profiles(username, display_name, avatar_url)
    `)
    .eq("story_id", storyId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Add a reaction to a story
 */
export async function addStoryReaction(storyId: string, userId: string, emoji: StoryReactionEmoji): Promise<void> {
  const { error } = await supabase
    .from("story_reactions")
    .insert({ story_id: storyId, user_id: userId, emoji });

  if (error) {
    // If duplicate, update to new emoji
    if (error.code === "23505") {
      const { error: updateError } = await supabase
        .from("story_reactions")
        .update({ emoji, created_at: new Date().toISOString() })
        .eq("story_id", storyId)
        .eq("user_id", userId);
      
      if (updateError) throw updateError;
      return;
    }
    throw error;
  }

  // Notify story creator (in production, this would trigger a notification)
  await notifyStoryCreator(storyId, userId, emoji);
}

/**
 * Remove a reaction from a story
 */
export async function removeStoryReaction(storyId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("story_reactions")
    .delete()
    .eq("story_id", storyId)
    .eq("user_id", userId);

  if (error) throw error;
}

/**
 * Get reaction counts grouped by emoji
 */
export function aggregateReactions(reactions: StoryReaction[]): StoryReactionCount[] {
  const grouped = reactions.reduce((acc, reaction) => {
    const emoji = reaction.emoji;
    if (!acc[emoji]) {
      acc[emoji] = { emoji, count: 0, users: [] };
    }
    acc[emoji].count++;
    acc[emoji].users.push(reaction.user_id);
    return acc;
  }, {} as Record<string, StoryReactionCount>);

  return Object.values(grouped).sort((a, b) => b.count - a.count);
}

/**
 * Check if user has reacted to a story
 */
export function getUserReaction(reactions: StoryReaction[], userId: string): StoryReactionEmoji | null {
  const userReaction = reactions.find(r => r.user_id === userId);
  return userReaction?.emoji ?? null;
}

/**
 * Notify story creator of new reaction
 */
async function notifyStoryCreator(storyId: string, reactorId: string, emoji: string): Promise<void> {
  // Get story creator
  const { data: story } = await supabase
    .from("stories")
    .select("user_id")
    .eq("id", storyId)
    .single();

  if (!story || story.user_id === reactorId) return; // Don't notify self

  // In production, create notification record
  try {
    await supabase.from("notifications").insert({
      user_id: story.user_id,
      type: "story_reaction",
      data: { story_id: storyId, reactor_id: reactorId, emoji },
    });
  } catch {
    // Notifications are best-effort
  }
}

/**
 * React hook for story reactions
 */
export function useStoryReactions(storyId: string, userId?: string) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["story-reactions", storyId],
    queryFn: () => fetchStoryReactions(storyId),
    enabled: !!storyId,
  });

  const addMutation = useMutation({
    mutationFn: (emoji: StoryReactionEmoji) => addStoryReaction(storyId, userId!, emoji),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["story-reactions", storyId] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: () => removeStoryReaction(storyId, userId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["story-reactions", storyId] });
    },
  });

  const reactions = query.data ?? [];
  const counts = aggregateReactions(reactions);
  const myReaction = userId ? getUserReaction(reactions, userId) : null;
  const totalCount = reactions.length;

  return {
    reactions,
    counts,
    myReaction,
    totalCount,
    isLoading: query.isLoading,
    addReaction: addMutation.mutate,
    removeReaction: removeMutation.mutate,
    isAdding: addMutation.isPending,
  };
}

/**
 * Subscribe to real-time reaction updates
 */
export function subscribeToStoryReactions(
  storyId: string,
  onUpdate: () => void
) {
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
      onUpdate
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
