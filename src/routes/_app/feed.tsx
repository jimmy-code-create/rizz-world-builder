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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Compass, Film, Flame, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { TrendingTagsRail } from "@/components/TrendingTagsRail";
import { FollowSuggestions } from "@/components/FollowSuggestions";
import { RizzCat } from "@/components/RizzCat";

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
    queryFn: () => fetchMyLikes(user!.id, feed.data!.map((p) => p.id)),
    enabled: !!user && !!feed.data && feed.data.length > 0,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
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

  const posts = feed.data ?? [];
  // Everything here is real data from the posts already loaded: how much landed
  // since midnight, and how much is in the window at all.
  const todayCount = useMemo(() => {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    return posts.filter((post) => new Date(post.created_at).getTime() >= midnight.getTime()).length;
  }, [posts]);

  const name = profile?.display_name || profile?.username || "there";
  const initial = name.charAt(0).toUpperCase();
  const shown = posts.slice(0, visible);
  const remaining = posts.length - visible;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || remaining <= 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible((v) => v + FEED_PAGE_SIZE);
        }
      },
      { rootMargin: "400px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [remaining]);

  const focusComposer = () => {
    const el = document.getElementById("feed-composer");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      (el?.querySelector("textarea, input") as HTMLElement | null)?.focus();
    }, 320);
  };

  return (
    <div className="pb-2">
      {/* Hero: who you are, what is happening, and the two things worth doing. */}
      <motion.section
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[26px] border border-white/10 glass-strong p-4 sm:p-5"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-[var(--rizz-pink)]/25 blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-28 -left-12 h-56 w-56 rounded-full bg-[var(--rizz-violet)]/20 blur-3xl"
        />

        <div className="relative">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 ring-2 ring-[var(--rizz-pink)]/40">
              <AvatarImage src={profile?.avatar_url ?? undefined} alt="" />
              <AvatarFallback className="bg-gradient-primary font-bold">{initial}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {greetingFor(new Date().getHours())}
              </p>
              <p className="truncate font-display text-base font-bold">{name}</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              live
            </span>
          </div>

          <h1 className="mt-3.5 font-display text-[26px] font-bold leading-none tracking-tight sm:text-3xl">
            Your Feed
          </h1>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-[var(--rizz-pink)]" />
            What&apos;s vibing right now
          </p>

          <div className="mt-3.5 flex items-center gap-2">
            <Button
              type="button"
              onClick={focusComposer}
              className="h-11 min-w-0 flex-1 gap-2 border-0 bg-gradient-primary text-primary-foreground shadow-glow sm:flex-none sm:px-6"
            >
              <Sparkles className="h-4 w-4" />
              <span className="truncate">Share something</span>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-11 gap-2 border-white/10 bg-white/5 text-foreground hover:bg-white/10"
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
              className="h-11 w-11 shrink-0 border-border bg-card p-0 text-foreground hover:bg-[var(--brand-ink-3)]"
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
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-semibold text-muted-foreground">
              <Flame className="h-3 w-3 text-[var(--rizz-pink)]" />
              {todayCount === 0
                ? "Nothing yet today"
                : `${todayCount} new drop${todayCount === 1 ? "" : "s"} today`}
            </span>
            {posts.length > 0 && (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-semibold text-muted-foreground">
                {posts.length} post{posts.length === 1 ? "" : "s"} in your feed
              </span>
            )}
          </div>
        </div>
      </motion.section>

      <SectionHeading title="Stories" hint="Fresh in the last 24 hours" />
      <StoriesStrip />

      <div id="feed-composer" className="scroll-mt-24">
        <PostComposer />
      </div>

      <TrendingTagsRail />

      <SectionHeading title="Latest drops" hint="Newest first, from everyone you follow" />

      {feed.isLoading && (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-72 rounded-3xl" />)}
        </div>
      )}

      {!feed.isLoading && posts.length === 0 && (
        <div className="glass rounded-3xl border border-white/5 p-8 text-center">
          <RizzCat mood="box" size={124} className="mx-auto" />
          <h2 className="mt-4 font-display text-xl font-bold">Nothing here yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Be the first to drop something hot — your post lands right here.
          </p>
          <Button
            type="button"
            onClick={focusComposer}
            className="mt-5 h-11 gap-2 border-0 bg-gradient-primary text-primary-foreground"
          >
            <Sparkles className="h-4 w-4" />
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
        <div className="mt-6 flex flex-col items-center gap-3 rounded-3xl border border-white/10 glass p-6 text-center">
          <p className="font-display text-base font-bold">You&apos;re all caught up ✨</p>
          <p className="text-xs text-muted-foreground">
            New posts show up here the moment they land.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={feed.isFetching}
            onClick={() => void feed.refetch()}
            className="h-11 gap-2 border-white/10 bg-white/5"
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
      <span aria-hidden className="ml-1 h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
    </div>
  );
}
