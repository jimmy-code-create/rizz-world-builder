import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { UserPlus, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function FollowSuggestions() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["follow-suggestions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: following } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user!.id);
      const excludeIds = [user!.id, ...(following ?? []).map((r: any) => r.following_id)];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, rizz_score, accent_color")
        .not("id", "in", `(${excludeIds.join(",")})`)
        .order("rizz_score", { ascending: false })
        .limit(5);
      return profs ?? [];
    },
    staleTime: 60_000,
  });

  const followMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("follows")
        .insert({ follower_id: user!.id, following_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["follow-suggestions"] });
      toast.success("Following ✨");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!data || data.length === 0) return null;

  return (
    <div className="glass rounded-3xl p-4 mb-4 border border-white/5">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-[var(--rizz-pink)]" />
        <h3 className="text-sm font-display font-bold tracking-tight">Suggested for you</h3>
      </div>
      <div className="space-y-2">
        {data.map((p: any) => {
          const initial = (p.display_name || p.username || "?").charAt(0).toUpperCase();
          return (
            <div key={p.id} className="flex items-center gap-3">
              <Link to="/u/$username" params={{ username: p.username }}>
                <Avatar className="h-9 w-9 ring-2" style={{ boxShadow: `0 0 0 2px ${p.accent_color || "var(--rizz-pink)"}40` }}>
                  <AvatarImage src={p.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-gradient-primary text-primary-foreground font-bold text-xs">{initial}</AvatarFallback>
                </Avatar>
              </Link>
              <Link to="/u/$username" params={{ username: p.username }} className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.display_name || p.username}</p>
                <p className="text-xs text-muted-foreground truncate">@{p.username} · {p.rizz_score} rizz</p>
              </Link>
              <Button
                size="sm"
                onClick={() => followMut.mutate(p.id)}
                disabled={followMut.isPending}
                className="bg-gradient-primary border-0 h-8 px-3 shadow-glow"
              >
                <UserPlus className="h-3.5 w-3.5 mr-1" />
                Follow
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}