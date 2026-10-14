import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { PostComposer } from "@/components/PostComposer";
import { PostCard } from "@/components/PostCard";
import { StoriesStrip } from "@/components/StoriesStrip";
import { fetchFeed, fetchMyLikes } from "@/lib/posts";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Compass, Film, Flame, Loader2, Plus, RefreshCw } from "lucide-react";
import { TrendingTagsRail } from "@/components/TrendingTagsRail";
import { FollowSuggestions } from "@/components/FollowSuggestions";
import { RizzCat } from "@/components/RizzCat";
import { formatNumber } from "@/lib/formatters";

export const Route = createFileRoute("/_app/feed")({
  head: () => ({ meta: [{ title: "Feed · RIZZ" }] }),
  component: FeedPage,
});

// The feed paginates instead of mounting every post at once; each PostCard is a
// heavy tree, so we render a page of them and grow the window on demand.
const FEED_PAGE_SIZE = 6;

/** "Good evening" and friends, from the device clock. */
function greetingFor(hour: number) {
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function FeedPage() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [visible, setVisible] = useState(FEED_PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const feed = useQuery({
    queryKey: ["feed"],
    queryFn: () => fetchFeed(50),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const likes = useQuery({
    queryKey: ["my-likes", user?.id, feed.data?.map((p) => p.id).join(",")],
    queryFn: async () => {
      if (!user || !feed.data) return new Set<string>();
      return fetchMyLikes(user.id, feed.data.map((p) => p.id));
    },
    enabled: !!user && !!feed.data && feed.data.length > 0,
    staleTime: 60_000,
  });

  // Grow the visible slice as the user approaches the bottom of the feed
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        setVisible((v) => v + FEED_PAGE_SIZE);
      }
    }, { rootMargin: "400px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [feed.data]);

  // Realtime updates: newly posted drops pop straight in
  useEffect(() => {
    const channel = supabase
      .channel("feed-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        () => { qc.invalidateQueries({ queryKey: ["feed"] }); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const posts = feed.data ?? [];
  const shown = useMemo(() => posts.slice(0, visible), [posts, visible]);
  const remaining = posts.length - visible;

  // Count how many posts have dropped so far today
  const todayCount = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const cut = startOfDay.getTime();
    return posts.filter((p) => new Date(p.created_at).getTime() >= cut).length;
  }, [posts]);

  const name = profile?.display_name || profile?.username || "there";

  const focusComposer = () => {
    const el = document.getElementById("feed-composer");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    const area = el?.querySelector("textarea");
    area?.focus();
  };

  return (
    <div className="space-y-6">
      {/* Greeting card - clean flat surface */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 sm:p-5"
      >
        <div className="relative">
          <div className="flex items-center gap-3">
            <UserAvatar
              src={profile?.avatar_url}
              fallback={profile?.display_name || profile?.username}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {greetingFor(new Date().getHours())}
              </p>
              <p className="truncate font-display text-base font-bold text-foreground">{name}</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              live
            </span>
          </div>

          <h1 className="mt-3.5 font-display text-[26px] font-bold leading-none tracking-tight sm:text-3xl text-foreground">
            Your Feed
          </h1>
          <p className="mt-1.5 text-xs text-muted-foreground">
            What&apos;s vibing right now
          </p>

          <div className="mt-3.5 flex items-center gap-2">
            <Button
              type="button"
              onClick={focusComposer}
              className="h-11 min-w-0 flex-1 gap-2 bg-primary text-primary-foreground sm:flex-none sm:px-6 font-semibold"
            >
              <Plus className="h-4 w-4" />
              <span className="truncate">Share something</span>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-11 gap-2 border-border bg-surface-2 text-foreground hover:bg-surface-3"
            >
              <Link to="/reels">
                <Film className="h-4 w-4" />
                Reels
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0 border-border bg-surface-2 p-0 text-foreground hover:bg-surface-3"
            >
              <Link
                to="/explore"
                aria-label="Explore RIZZ"
                className="grid h-full w-full place-items-center"
              >
                <Compass className="block h-4 w-4 shrink-0" />
              </Link>
            </Button>
          </div>

          <div className="no-scrollbar -mx-4 mt-3 flex items-center gap-2 overflow-x-auto px-4 text-[11px] sm:mx-0 sm:px-0">
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1 font-semibold text-muted-foreground">
              <Flame className="h-3 w-3 text-primary" />
              {todayCount === 0
                ? "Nothing yet today"
                : `${formatNumber(todayCount)} new drop${todayCount === 1 ? "" : "s"} today`}
            </span>
          </div>
        </div>
      </motion.div>

      <SectionHeading title="Stories" hint="Fresh in the last 24 hours" />
      <StoriesStrip />

      <div id="feed-composer" className="scroll-mt-24">
        <PostComposer />
      </div>

      <TrendingTagsRail />

      <SectionHeading title="Latest drops" hint="Newest first, from everyone you follow" />

      {feed.isLoading && (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}
        </div>
      )}

      {!feed.isLoading && posts.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <RizzCat mood="box" size={124} className="mx-auto" />
          <h2 className="mt-4 font-display text-xl font-bold">Nothing here yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Be the first to drop something hot — your post lands right here.
          </p>
          <Button
            type="button"
            onClick={focusComposer}
            className="mt-5 h-11 gap-2 bg-primary text-primary-foreground font-semibold"
          >
            <Plus className="h-4 w-4" />
            Start the vibe
          </Button>
        </div>
      )}

      <div className="space-y-4">
        {shown.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.04, 0.24), duration: 0.3, ease: "easeOut" }}
          >
            <PostCard post={p} liked={likes.data?.has(p.id)} />
            {i === 2 && <FollowSuggestions />}
          </motion.div>
        ))}
      </div>

      {remaining > 0 && (
        <div ref={sentinelRef} className="py-8 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/60" />
        </div>
      )}

      {!feed.isLoading && posts.length > 0 && remaining <= 0 && (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center">
          <p className="font-display text-base font-bold">You&apos;re all caught up</p>
          <p className="text-xs text-muted-foreground">
            New posts show up here the moment they land.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={feed.isFetching}
            onClick={() => void feed.refetch()}
            className="h-11 gap-2 border-border bg-surface-2 hover:bg-surface-3"
          >
            <RefreshCw className={`h-4 w-4 ${feed.isFetching ? "animate-spin" : ""}`} />
            {feed.isFetching ? "Checking…" : "Check for new posts"}
          </Button>
        </div>
      )}
    </div>
  );
}

/** A quiet section divider: a label, a hint, and a hairline that runs to the edge. */
function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-3 mt-6 flex items-baseline gap-3">
      <h2 className="shrink-0 font-display text-sm font-bold uppercase tracking-[0.14em] text-foreground">
        {title}
      </h2>
      {hint && <p className="min-w-0 truncate text-[11px] text-muted-foreground">{hint}</p>}
      <span aria-hidden className="ml-1 h-px flex-1 bg-border" />
    </div>
  );
}
