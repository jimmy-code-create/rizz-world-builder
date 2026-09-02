import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { motion } from "framer-motion";
import { Heart, MessageSquareText, Play } from "lucide-react";
import { toast } from "sonner";
import { ChatStoryPlayer, type ChatStory, type StoryLine, type StoryChoice } from "@/components/chatstory/ChatStoryPlayer";

export const Route = createFileRoute("/_app/chat-stories")({
  head: () => ({
    meta: [
      { title: "Chat Stories · RIZZ" },
      { name: "description", content: "Bite-size funny, chaotic and spooky stories told as text conversations. Tap through them like you're reading someone's chat." },
      { property: "og:title", content: "Chat Stories · RIZZ" },
      { property: "og:description", content: "Tap-to-read chat stories: wrong numbers, haunted fridges and gym crush disasters." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Chat Stories · RIZZ" },
      { name: "twitter:description", content: "Tap-to-read chat stories on RIZZ." },
    ],
  }),
  component: ChatStoriesPage,
});

const CATEGORIES = ["all", "funny", "chaos", "horror", "cringe"] as const;

function ChatStoriesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const stories = useQuery({
    queryKey: ["chat-stories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("chat_stories").select("*").order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as (ChatStory & { likes_count: number })[];
    },
  });

  const likes = useQuery({
    queryKey: ["chat-story-likes", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("chat_story_likes").select("story_id").eq("user_id", user!.id);
      return new Set((data ?? []).map((r: { story_id: string }) => r.story_id));
    },
    enabled: !!user,
  });

  const lines = useQuery({
    queryKey: ["chat-story-lines", openId],
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_story_lines")
        .select("idx,speaker,body,next_idx,chapter")
        .eq("story_id", openId!)
        .order("idx");
      return (data ?? []) as unknown as StoryLine[];
    },
    enabled: !!openId,
  });

  const choices = useQuery({
    queryKey: ["chat-story-choices", openId],
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_story_choices")
        .select("at_idx,position,label,reply_body,goto_idx")
        .eq("story_id", openId!)
        .order("position");
      return (data ?? []) as unknown as StoryChoice[];
    },
    enabled: !!openId,
  });

  const toggleLike = async (storyId: string) => {
    if (!user) return toast.info("Sign in to like stories");
    const isLiked = likes.data?.has(storyId);
    if (isLiked) await supabase.from("chat_story_likes").delete().eq("story_id", storyId).eq("user_id", user.id);
    else await supabase.from("chat_story_likes").insert({ story_id: storyId, user_id: user.id });
    qc.invalidateQueries({ queryKey: ["chat-story-likes", user.id] });
  };

  const list = (stories.data ?? []).filter((s) => cat === "all" || s.category === cat);
  const open = list.find((s) => s.id === openId) ?? (stories.data ?? []).find((s) => s.id === openId);

  return (
    <div className="max-w-2xl mx-auto">
      <header className="mb-5">
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <MessageSquareText className="h-6 w-6 text-[var(--rizz-pink)]" /> Chat Stories
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Short stories told as texts. Tap through them one message at a time.
        </p>
      </header>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 mb-4">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`shrink-0 px-4 h-9 rounded-full text-sm font-semibold capitalize ${
              cat === c ? "bg-gradient-primary" : "glass"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {stories.isLoading && <p className="text-sm text-muted-foreground">Loading stories…</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((s, i) => (
          <motion.button
            key={s.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            onClick={() => setOpenId(s.id)}
            className="relative text-left rounded-2xl overflow-hidden p-4 min-h-[132px] flex flex-col justify-between"
            style={{ background: s.gradient }}
          >
            <div className="absolute inset-0 bg-black/25" />
            <div className="relative">
              <div className="flex items-start gap-2">
                <span className="text-2xl">{s.emoji}</span>
                <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-white/20">
                  {s.category}
                </span>
              </div>
              <h2 className="mt-2 font-extrabold leading-tight">{s.title}</h2>
              <p className="text-xs opacity-85 mt-1 line-clamp-2">{s.hook}</p>
            </div>
            <div className="relative mt-3 flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1 font-semibold">
                <Play className="h-3.5 w-3.5" /> Read
              </span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); toggleLike(s.id); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); toggleLike(s.id); } }}
                className="inline-flex items-center gap-1"
              >
                <Heart className={`h-3.5 w-3.5 ${likes.data?.has(s.id) ? "fill-current" : ""}`} />
                {likes.data?.has(s.id) ? "Liked" : "Like"}
              </span>
            </div>
          </motion.button>
        ))}
      </div>

      {open && lines.data && (
        <ChatStoryPlayer
          story={open}
          lines={lines.data}
          liked={!!likes.data?.has(open.id)}
          onLike={() => toggleLike(open.id)}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}