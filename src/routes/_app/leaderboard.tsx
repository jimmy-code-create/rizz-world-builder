import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Crown } from "lucide-react";
import { UserAvatar } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { formatNumber } from "@/lib/formatters";

export const Route = createFileRoute("/_app/leaderboard")({
  head: () => ({ meta: [{ title: "Leaderboard · RIZZ" }] }),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const top = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, rizz_score, accent_color")
        .order("rizz_score", { ascending: false })
        .not("username", "is", null)
        .limit(50);
      if (error) throw error;
      return (data ?? []).filter((profile) => profile.username !== null);
    },
  });

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Trophy className="h-7 w-7 text-primary" />
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Top Rizz</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">The realest energy on the app.</p>

      <div className="space-y-2">
        {top.data?.map((p, i) => (
          <Link
            key={p.id}
            to="/u/$username"
            params={{ username: p.username }}
            className={`rounded-2xl p-3 flex items-center gap-3 border transition-colors ${
              i < 3
                ? "border-primary/40 bg-card hover:bg-surface-2"
                : "border-border bg-card/60 hover:bg-card"
            }`}
          >
            <div className={`w-8 text-center font-display font-bold ${i === 0 ? "text-primary" : "text-muted-foreground"}`}>
              {i === 0 ? <Crown className="h-5 w-5 mx-auto" /> : `#${i + 1}`}
            </div>
            <UserAvatar
              src={p.avatar_url}
              fallback={p.display_name || p.username}
              size="md"
            />
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate text-foreground">{p.display_name || p.username}</p>
              <p className="text-xs text-muted-foreground truncate">@{p.username}</p>
            </div>
            <div className="text-right">
              <p className="font-display font-bold text-lg text-primary">{formatNumber(p.rizz_score)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
