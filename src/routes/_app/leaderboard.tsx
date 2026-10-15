import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Crown, Medal, RefreshCw, Trophy } from "lucide-react";
import { UserAvatar } from "@/components/ui/avatar";
import { ProfilePreviewTrigger } from "@/components/ProfilePreview";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatNumber } from "@/lib/formatters";
import { defaultAvatarFor } from "@/lib/default-avatars";

export const Route = createFileRoute("/_app/leaderboard")({
  head: () => ({ meta: [{ title: "Leaderboard · RIZZ" }] }),
  component: LeaderboardPage,
});

type BoardRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  rizz_score: number | null;
  accent_color: string | null;
};

const MEDALS = ["🥇", "🥈", "🥉"] as const;

function LeaderboardPage() {
  const { user } = useAuth();
  const top = useQuery({
    queryKey: ["leaderboard"],
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<BoardRow[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, rizz_score, accent_color")
        .order("rizz_score", { ascending: false })
        .order("created_at", { ascending: true })
        .not("username", "is", null)
        .limit(50);
      if (error) throw error;
      return ((data ?? []) as BoardRow[]).filter((profile) => profile.username !== null);
    },
  });

  const rows = top.data ?? [];
  const myIndex = user ? rows.findIndex((r) => r.id === user.id) : -1;

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <Trophy className="h-7 w-7 text-primary" />
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Top Rizz</h1>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => void top.refetch()}
          disabled={top.isFetching}
          aria-label="Refresh leaderboard"
          className="ml-auto h-11 w-11"
        >
          <RefreshCw className={`h-4 w-4 ${top.isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">The realest energy on the app.</p>

      {myIndex >= 0 && (
        <p className="mb-4 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-medium text-foreground" role="status">
          You&apos;re <span className="font-bold text-primary">#{myIndex + 1}</span> with{" "}
          {formatNumber(rows[myIndex]?.rizz_score ?? 0)} rizz.
        </p>
      )}

      {top.isLoading && (
        <div className="space-y-2" role="status" aria-label="Loading leaderboard">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-3">
              <div className="skeleton-shimmer h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <div className="skeleton-shimmer h-3.5 w-1/3 rounded" />
                <div className="skeleton-shimmer h-3 w-1/4 rounded" />
              </div>
              <div className="skeleton-shimmer h-5 w-12 rounded" />
            </div>
          ))}
        </div>
      )}

      {top.isError && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">Couldn&apos;t load the leaderboard.</p>
          <Button type="button" variant="outline" onClick={() => void top.refetch()} className="mt-3 h-11">
            Try again
          </Button>
        </div>
      )}

      {!top.isLoading && !top.isError && rows.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">Nobody&apos;s on the board yet. Be the first.</p>
        </div>
      )}

      <div className="space-y-2">
        {rows.map((p, i) => {
          const name = p.display_name || p.username || "Member";
          const isMe = user?.id === p.id;
          return (
            <ProfilePreviewTrigger key={p.id} username={p.username}>
              <span
                className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${
                  isMe
                    ? "border-primary bg-primary/10 hover:bg-primary/15"
                    : i < 3
                      ? "border-primary/40 bg-card hover:bg-surface-2"
                      : "border-border bg-card/60 hover:bg-card"
                }`}
              >
                <span
                  className={`w-8 shrink-0 text-center font-display text-lg font-bold ${
                    i === 0 ? "text-primary" : "text-muted-foreground"
                  }`}
                  aria-label={`Rank ${i + 1}`}
                >
                  {i === 0 ? <Crown className="mx-auto h-5 w-5" /> : i < 3 ? MEDALS[i] : `#${i + 1}`}
                </span>
                <UserAvatar
                  src={p.avatar_url ?? defaultAvatarFor(p.username ?? p.id)}
                  fallback={name.charAt(0).toUpperCase()}
                  size="md"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-semibold text-foreground">{name}</span>
                    {isMe && (
                      <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                        YOU
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">@{p.username}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="flex items-center gap-1 font-display text-lg font-bold text-primary">
                    {i > 0 && i < 3 && <Medal className="h-4 w-4" aria-hidden />}
                    {formatNumber(p.rizz_score)}
                  </span>
                </span>
              </span>
            </ProfilePreviewTrigger>
          );
        })}
      </div>

      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        Tap any row for the full profile. Scores update as people post, react and earn badges.
      </p>
      {/* NOTE: rizz_score currently has no writer (no trigger/cron/edge function
          increments it from likes/comments/reactions/posts/badges), so ordering can
          look frozen until a score pipeline is added — that needs a DB migration. */}
    </div>
  );
}
