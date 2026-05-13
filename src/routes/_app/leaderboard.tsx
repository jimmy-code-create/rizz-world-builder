import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Crown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";

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
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Trophy className="h-7 w-7 text-[var(--rizz-pink)]" />
        <h1 className="font-display text-3xl font-bold tracking-tight">Top Rizz</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">The realest energy on the app.</p>

      <div className="space-y-2">
        {top.data?.map((p, i) => (
          <Link
            key={p.id}
            to="/u/$username"
            params={{ username: p.username }}
            className={`glass rounded-2xl p-3 flex items-center gap-3 border transition-all ${
              i < 3 ? "border-[var(--rizz-pink)]/30 shadow-glow" : "border-white/5 hover:border-white/10"
            }`}
          >
            <div className={`w-8 text-center font-display font-bold ${i === 0 ? "text-[var(--rizz-pink)]" : "text-muted-foreground"}`}>
              {i === 0 ? <Crown className="h-5 w-5 mx-auto" /> : `#${i + 1}`}
            </div>
            <Avatar className="h-12 w-12 ring-2" style={{ boxShadow: `0 0 0 2px ${p.accent_color || "var(--rizz-pink)"}40` }}>
              <AvatarImage src={p.avatar_url ?? undefined} />
              <AvatarFallback className="bg-gradient-primary font-bold">
                {(p.display_name || p.username).charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{p.display_name || p.username}</p>
              <p className="text-xs text-muted-foreground truncate">@{p.username}</p>
            </div>
            <div className="text-right">
              <p className="font-display font-bold text-lg text-[var(--rizz-pink)]">{p.rizz_score}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}