import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { FeedSideDiscussion } from "@/components/FeedSideDiscussion";
import { RizzCat } from "@/components/RizzCat";
import { formatNumber } from "@/lib/formatters";
import { useI18n } from "@/lib/i18n";
import type { FeedPost } from "@/lib/posts";

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
  const { t } = useI18n();
  const qc = useQueryClient();
  const [visible, setVisible] = useState(FEED_PAGE_SIZE);
  const [activeSidePost, setActiveSidePost] = useState<FeedPost | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const greeting = (hour: number) => {
    if (hour < 5) return t("good_evening");
    if (hour < 12) return t("good_morning");
    if (hour < 18) return t("good_afternoon");
    return t("good_evening");
  };

  // Listen for side discussion triggers from post cards
  useEffect(() => {
    const handleSideOpen = (event: CustomEvent<{ post: FeedPost }>) => {
      if (event.detail?.post) {
        setActiveSidePost(event.detail.post);
      }
    };
    window.addEventListener("rizz:open-side-discussion", handleSideOpen as EventListener);
    return () => window.removeEventListener("rizz:open-side-discussion", handleSideOpen as EventListener);
  }, []);

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
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start w-full">
      <div className="xl:col-span-8 min-w-0 space-y-5">
        {/* Compact greeting bar */}
        <div className="flex items-center justify-between pt-1 pb-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <UserAvatar
              src={profile?.avatar_url}
              fallback={profile?.display_name || profile?.username}
              size="sm"
            />
            <p className="text-sm text-muted-foreground truncate leading-tight">
              {greeting(new Date().getHours())},{" "}
              <span className="font-semibold text-foreground">{name}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {todayCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                <Flame className="h-3 w-3 text-primary" />
                {formatNumber(todayCount)} new
              </span>
            )}
          </div>
        </div>

        <SectionHeading title={t("stories")} tooltip={t("fresh_stories")} />
        <StoriesStrip />

        <div id="feed-composer" className="scroll-mt-24">
          <PostComposer />
        </div>

        <TrendingTagsRail />

        <SectionHeading title={t("latest_drops")} tooltip={t("drops_subtitle")} />

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
            <div key={p.id}>
              <PostCard post={p} liked={likes.data?.has(p.id)} />
              {i === 2 && <div className="xl:hidden"><FollowSuggestions /></div>}
            </div>
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

      {/* Desktop Discussion and Community Rail */}
      <aside className="hidden xl:block xl:col-span-4 min-w-0 sticky top-6">
        <FeedSideDiscussion
          activePost={activeSidePost}
          onClose={() => setActiveSidePost(null)}
        />
      </aside>
    </div>
  );
}

/** A quiet section divider: a label, a tooltip, and a hairline that runs to the edge (12px above and below). */
function SectionHeading({ title, tooltip }: { title: string; tooltip?: string }) {
  return (
    <div className="my-3 flex items-center gap-2" title={tooltip}>
      <h2 className="shrink-0 font-display text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </h2>
      <span aria-hidden className="h-px flex-1 bg-border/60" />
    </div>
  );
}
