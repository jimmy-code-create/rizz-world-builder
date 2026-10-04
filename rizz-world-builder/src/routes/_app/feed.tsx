import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { PostComposer } from "@/components/PostComposer";
import { PostCard } from "@/components/PostCard";
import { StoriesStrip } from "@/components/StoriesStrip";
import { fetchFeed, fetchMyLikes } from "@/lib/posts";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles } from "lucide-react";
import { TrendingTagsRail } from "@/components/TrendingTagsRail";
import { FollowSuggestions } from "@/components/FollowSuggestions";

export const Route = createFileRoute("/_app/feed")({
  head: () => ({ meta: [{ title: "Feed · RIZZ" }] }),
  component: FeedPage,
});

function FeedPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const feed = useQuery({
    queryKey: ["feed"],
    queryFn: () => fetchFeed(50),
  });

  const likes = useQuery({
    queryKey: ["my-likes", user?.id, feed.data?.map((p) => p.id).join(",")],
    queryFn: () => fetchMyLikes(user!.id, feed.data!.map((p) => p.id)),
    enabled: !!user && !!feed.data && feed.data.length > 0,
  });

  useEffect(() => {
    const ch = supabase
      .channel("feed-posts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, () => {
        qc.invalidateQueries({ queryKey: ["feed"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Your Feed</h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-[var(--rizz-pink)]" />
            What's vibing right now
          </p>
        </div>
      </motion.div>

      <StoriesStrip />

      <PostComposer />

      <TrendingTagsRail />

      {feed.isLoading && (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-72 rounded-3xl" />)}
        </div>
      )}

      {feed.data?.length === 0 && (
        <div className="glass rounded-3xl p-10 text-center">
          <div className="text-5xl mb-4">✨</div>
          <h2 className="font-display text-xl font-bold">Nothing here yet</h2>
          <p className="text-sm text-muted-foreground mt-1">Be the first to drop something hot.</p>
        </div>
      )}

      {feed.data?.map((p, i) => (
        <motion.div
          key={p.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.35, ease: "easeOut" }}
        >
          <PostCard post={p} liked={likes.data?.has(p.id)} />
          {i === 2 && <FollowSuggestions />}
        </motion.div>
      ))}
    </div>
  );
}