import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type TouchEvent as ReactTouchEvent } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Info, RefreshCw, Trophy } from "lucide-react";
import { UserAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { CloseButton } from "@/components/ui/close-button";
import { ProfileCardDialog } from "@/components/profile/ProfileCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatNumber } from "@/lib/formatters";
import { defaultAvatarFor } from "@/lib/default-avatars";
import {
  BOARD_PAGE_SIZE,
  fetchBoardPage,
  pointsToPass,
  type BoardPeriod,
  type BoardRow,
} from "@/lib/leaderboard";

export const Route = createFileRoute("/_app/leaderboard")({
  validateSearch: (search: Record<string, unknown>): { earn?: boolean } => ({
    ...(search.earn === "1" || search.earn === 1 || search.earn === true ? { earn: true } : {}),
  }),
  head: () => ({ meta: [{ title: "Leaderboard · RIZZ" }] }),
  component: LeaderboardPage,
});

const PERIODS: Array<{ value: BoardPeriod; label: string }> = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "all", label: "All time" },
];

const EARN_ROWS: Array<{ action: string; points: string }> = [
  { action: "Create a post", points: "+5" },
  { action: "Like received", points: "+2" },
  { action: "Comment received", points: "+3" },
  { action: "Reaction received", points: "+1" },
  { action: "Earn a badge", points: "+25" },
];

function RankDelta({ rank, prevRank }: { rank: number; prevRank: number | null }) {
  if (prevRank == null || prevRank === rank) return null;
  const up = prevRank > rank;
  const n = Math.abs(prevRank - rank);
  return (
    <span
      aria-label={up ? `Up ${n} since last period` : `Down ${n} since last period`}
      title={up ? `Up ${n}` : `Down ${n}`}
      className={`flex shrink-0 items-center gap-0.5 text-[11px] font-bold tabular-nums ${
        up ? "text-[#c8ff3d]" : "text-[#ff6a55]"
      }`}
    >
      <span aria-hidden>{up ? "▲" : "▼"}</span>
      {n}
    </span>
  );
}

function LeaderboardPage() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [period, setPeriod] = useState<BoardPeriod>("all");
  const [followingOnly, setFollowingOnly] = useState(false);
  const [cardUserId, setCardUserId] = useState<string | null>(null);
  // Deep link (e.g. from Bounties): /leaderboard?earn=1 opens the earn guide.
  const [earnOpen, setEarnOpen] = useState(search.earn ?? false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const pullStartY = useRef<number | null>(null);
  const [pulling, setPulling] = useState(false);

  useEffect(() => {
    if (!search.earn) return;
    setEarnOpen(true);
    void navigate({ to: "/leaderboard", search: {}, replace: true });
  }, [navigate, search.earn]);

  const board = useInfiniteQuery({
    queryKey: ["board", period, followingOnly, user?.id ?? "anon"],
    queryFn: ({ pageParam }) => fetchBoardPage(period, user?.id ?? null, followingOnly, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.rows.length === BOARD_PAGE_SIZE ? pages.length : undefined,
    staleTime: 30_000,
  });

  const pages = board.data?.pages ?? [];
  const rows: BoardRow[] = useMemo(() => pages.flatMap((p) => p.rows), [pages]);
  const tracked = pages.length === 0 || pages[0]?.periodsTracked !== false;
  const hasMore = !!board.hasNextPage;

  // Realtime: any profile score movement refreshes the board (top 10 live).
  useEffect(() => {
    const ch = supabase
      .channel("board-live")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => {
        void qc.invalidateQueries({ queryKey: ["board"] });
      });
    ch.subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [qc]);

  // A score awarded in this browser (the client fallback) does not need the
  // realtime publication to be live, so the app is told directly.
  useEffect(() => {
    const onAwarded = () => {
      void qc.invalidateQueries({ queryKey: ["board"] });
    };
    window.addEventListener("rizz:awarded", onAwarded);
    return () => window.removeEventListener("rizz:awarded", onAwarded);
  }, [qc]);

  // Infinite scroll: 50 per page.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !board.isFetchingNextPage) void board.fetchNextPage();
      },
      { rootMargin: "400px" },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [hasMore, board.isFetchingNextPage]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = () => {
    rowRefs.current.clear();
    void board.refetch();
  };

  // Pull to refresh (touch): drag down at the very top.
  const onTouchStart = (e: ReactTouchEvent) => {
    const el = scrollerRef.current;
    if (el && el.scrollTop <= 0) pullStartY.current = e.touches[0]?.clientY ?? null;
  };
  const onTouchMove = (e: ReactTouchEvent) => {
    if (pullStartY.current === null) return;
    const dy = (e.touches[0]?.clientY ?? 0) - pullStartY.current;
    setPulling(dy > 70);
  };
  const onTouchEnd = (e: ReactTouchEvent) => {
    if (pullStartY.current === null) return;
    const dy = (e.changedTouches[0]?.clientY ?? 0) - pullStartY.current;
    pullStartY.current = null;
    setPulling(false);
    if (dy > 90 && !board.isFetching) refresh();
  };

  const me = pointsToPass(rows, user?.id ?? null);
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const showPodium = board.data !== undefined && podium.length > 0;
  const showEmpty = !board.isLoading && !board.isError && tracked && rows.length < 3;

  const scrollToMe = () => {
    if (!user) return;
    rowRefs.current.get(user.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-1 flex items-center gap-2">
        <Trophy className="h-7 w-7 text-primary" />
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Top Rizz</h1>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={refresh}
          disabled={board.isFetching}
          aria-label="Refresh leaderboard"
          className="ml-auto h-11 w-11"
        >
          <RefreshCw className={`h-4 w-4 ${board.isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Period tabs */}
      <div className="mb-2 flex gap-1.5" role="tablist" aria-label="Leaderboard period">
        {PERIODS.map((p) => {
          const selected = period === p.value;
          return (
            <button
              key={p.value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setPeriod(p.value)}
              className={`flex min-h-[44px] flex-1 items-center justify-center rounded-xl border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d] ${
                selected
                  ? "border-[#c8ff3d] bg-[#c8ff3d]/15 text-[#c8ff3d]"
                  : "border-[#2a2a2e] text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      {/* Scope filter */}
      <div className="mb-4 flex gap-1.5" role="radiogroup" aria-label="Who to rank">
        {(
          [
            { value: false, label: "Everyone" },
            { value: true, label: "Following" },
          ] as const
        ).map((o) => {
          const selected = followingOnly === o.value;
          return (
            <button
              key={o.label}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setFollowingOnly(o.value)}
              className={`flex min-h-[44px] flex-1 items-center justify-center rounded-full border text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d] ${
                selected
                  ? "border-[#c8ff3d]/60 bg-white/5 text-foreground"
                  : "border-[#2a2a2e] text-muted-foreground"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      <div
        ref={scrollerRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="min-h-0 flex-1 overflow-y-auto pb-24"
      >
        {(pulling || (board.isFetching && !board.isFetchingNextPage)) && (
          <p className="py-1 text-center text-xs text-muted-foreground" role="status">
            Refreshing…
          </p>
        )}

        {board.isLoading && <BoardSkeleton />}

        {board.isError && (
          <div className="rounded-2xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">Couldn&apos;t load the leaderboard.</p>
            <Button type="button" variant="outline" onClick={refresh} className="mt-3 h-11">
              Try again
            </Button>
          </div>
        )}

        {!board.isLoading && !board.isError && !tracked && (
          <div className="rounded-2xl border border-border bg-card p-6 text-center">
            <p className="text-sm font-semibold text-foreground">
              Daily boards aren&apos;t tracked yet
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Today / This week light up once the scoring update lands. All time works now.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPeriod("all")}
              className="mt-3 h-11"
            >
              View All time
            </Button>
          </div>
        )}

        {showEmpty && (
          <div className="rounded-2xl border border-border bg-card p-6 text-center">
            <Trophy className="mx-auto h-8 w-8 text-primary" />
            <p className="mt-2 text-sm font-semibold text-foreground">
              Earn your first rizz to get on the board
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Only scores above 0 show up here.</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEarnOpen(true)}
              className="mt-3 h-11 gap-1.5"
            >
              <Info className="h-4 w-4" /> How to earn rizz
            </Button>
          </div>
        )}

        {/* Podium: 1st center + taller with crown, 2nd left, 3rd right */}
        {showPodium && tracked && !showEmpty && (
          <div className="mb-3 grid grid-cols-3 items-end gap-2" aria-label="Top three">
            <PodiumSpot place={2} row={podium[1]} tall={false} onOpen={setCardUserId} />
            <PodiumSpot place={1} row={podium[0]} tall onOpen={setCardUserId} />
            <PodiumSpot place={3} row={podium[2]} tall={false} onOpen={setCardUserId} />
          </div>
        )}

        {/* Ranks 4+: uniform full-width rows */}
        <div className="space-y-2">
          {rest.map((r) => (
            <BoardRowCard
              key={r.id}
              row={r}
              isMe={user?.id === r.id}
              onOpen={setCardUserId}
              refCb={(el) => {
                if (el) rowRefs.current.set(r.id, el);
              }}
            />
          ))}
        </div>
        {board.isFetchingNextPage && <BoardSkeleton short />}

        <div ref={sentinelRef} aria-hidden className="h-1" />
        {!hasMore && rows.length > 3 && (
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            That&apos;s the whole board.
          </p>
        )}
      </div>

      {/* Sticky bottom bar */}
      {user && me && (
        <button
          type="button"
          onClick={scrollToMe}
          className="sticky bottom-0 z-10 mx-auto mb-2 flex min-h-[44px] w-full max-w-md items-center justify-center gap-1.5 rounded-2xl border border-[#c8ff3d]/40 bg-[#141416]/95 px-4 text-sm font-medium text-foreground shadow-xl backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d]"
        >
          {me.above ? (
            <span>
              You&apos;re <span className="font-bold text-[#c8ff3d]">#{me.rank}</span>
              <span className="text-muted-foreground"> · {formatNumber(me.gap)} rizz to pass </span>
              <span className="font-semibold">@{me.above.username}</span>
            </span>
          ) : (
            <span>
              You&apos;re <span className="font-bold text-[#c8ff3d]">#{me.rank}</span>
              <span className="text-muted-foreground"> · top of the board</span>
            </span>
          )}
        </button>
      )}
      {user && !me && !board.isLoading && tracked && (
        <button
          type="button"
          onClick={() => setEarnOpen(true)}
          className="sticky bottom-0 z-10 mx-auto mb-2 flex min-h-[44px] w-full max-w-md items-center justify-center gap-1.5 rounded-2xl border border-[#2a2a2e] bg-[#141416]/95 px-4 text-sm text-muted-foreground shadow-xl backdrop-blur"
        >
          You&apos;re unranked — earn rizz to join the board
        </button>
      )}

      <ProfileCardDialog
        user={cardUserId ? { userId: cardUserId } : null}
        open={!!cardUserId}
        onOpenChange={(o) => {
          if (!o) setCardUserId(null);
        }}
      />

      {/* How to earn rizz */}
      <Sheet open={earnOpen} onOpenChange={setEarnOpen}>
        <SheetContent
          side="bottom"
          hideClose
          className="mx-auto w-full max-w-md rounded-t-3xl border-white/10 glass-strong"
        >
          <div className="flex items-center gap-3">
            <SheetTitle className="flex-1 font-display text-lg">How to earn rizz</SheetTitle>
            <SheetClose asChild>
              <CloseButton />
            </SheetClose>
          </div>
          <ul className="mt-3 space-y-1">
            {EARN_ROWS.map((e) => (
              <li
                key={e.action}
                className="flex min-h-[44px] items-center justify-between rounded-xl px-3 hover:bg-white/5"
              >
                <span className="text-sm text-foreground">{e.action}</span>
                <span className="font-display font-bold text-[#c8ff3d]">{e.points}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Rizz is earned, not shared: there is no common pool and no fixed supply, so every point
            you make is yours and nobody&apos;s score goes down because you earned one. Scores
            update live, and only scores above 0 appear on the board.
          </p>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function PodiumSpot({
  place,
  row,
  tall,
  onOpen,
}: {
  place: 1 | 2 | 3;
  row: BoardRow | undefined;
  tall: boolean;
  onOpen: (userId: string) => void;
}) {
  if (!row) return <span />;
  const name = row.display_name || row.username;
  return (
    <button
      type="button"
      onClick={() => onOpen(row.id)}
      aria-label={`Rank ${place}: ${name}`}
      className={`flex min-h-[44px] flex-col items-center gap-1 rounded-2xl border px-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d] ${
        tall
          ? "border-[#c8ff3d]/60 bg-[#c8ff3d]/10 pb-4 pt-3"
          : "border-[#2a2a2e] bg-card pb-3 pt-2.5"
      }`}
    >
      {tall ? (
        <Crown className="h-6 w-6 text-[#c8ff3d]" aria-hidden />
      ) : (
        <span className="font-display text-sm font-bold text-muted-foreground">#{place}</span>
      )}
      <UserAvatar
        src={row.avatar_url ?? defaultAvatarFor(row.username)}
        fallback={name.charAt(0).toUpperCase()}
        size={tall ? 72 : 56}
      />
      <span className="w-full truncate text-sm font-bold text-foreground">{name}</span>
      <span className="w-full truncate text-[11px] text-muted-foreground">@{row.username}</span>
      <span className="flex items-center gap-1.5">
        <span className="font-display text-base font-bold text-[#c8ff3d]">
          {formatNumber(row.score)}
        </span>
        <RankDelta rank={row.rank} prevRank={row.prevRank} />
      </span>
    </button>
  );
}

function BoardRowCard({
  row,
  isMe,
  onOpen,
  refCb,
}: {
  row: BoardRow;
  isMe: boolean;
  onOpen: (userId: string) => void;
  refCb: (el: HTMLDivElement | null) => void;
}) {
  const name = row.display_name || row.username;
  return (
    <div ref={refCb}>
      <button
        type="button"
        onClick={() => onOpen(row.id)}
        aria-label={`Rank ${row.rank}: ${name}`}
        className={`flex h-16 w-full items-center gap-3 rounded-2xl border px-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d] ${
          isMe
            ? "border-[#c8ff3d] bg-[#c8ff3d]/10"
            : "border-[#2a2a2e] bg-card hover:bg-white/[0.04]"
        }`}
      >
        <span className="w-8 shrink-0 text-center font-display text-base font-bold text-muted-foreground">
          #{row.rank}
        </span>
        <UserAvatar
          src={row.avatar_url ?? defaultAvatarFor(row.username)}
          fallback={name.charAt(0).toUpperCase()}
          size={40}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-foreground">{name}</span>
            {isMe && (
              <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                YOU
              </span>
            )}
          </span>
          <span className="block truncate text-xs text-muted-foreground">@{row.username}</span>
        </span>
        <RankDelta rank={row.rank} prevRank={row.prevRank} />
        <span className="shrink-0 font-display text-base font-bold text-[#c8ff3d]">
          {formatNumber(row.score)}
        </span>
      </button>
    </div>
  );
}

function BoardSkeleton({ short = false }: { short?: boolean }) {
  return (
    <div className="space-y-2" role="status" aria-label="Loading leaderboard">
      {Array.from({ length: short ? 3 : 8 }).map((_, i) => (
        <div
          key={i}
          className="flex h-16 items-center gap-3 rounded-2xl border border-border bg-card/60 px-3"
        >
          <div className="skeleton-shimmer h-6 w-8 rounded" />
          <div className="skeleton-shimmer h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <div className="skeleton-shimmer h-3.5 w-1/3 rounded" />
            <div className="skeleton-shimmer h-3 w-1/4 rounded" />
          </div>
          <div className="skeleton-shimmer h-5 w-12 rounded" />
        </div>
      ))}
    </div>
  );
}
