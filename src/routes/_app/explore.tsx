import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Flame, Hash, Clock, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { fetchTrendingTags } from "@/lib/hashtags";
import { formatNumber } from "@/lib/formatters";

const RECENT_KEY = "rizz:recent-search";
function loadRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; }
}
function pushRecent(s: string) {
  const list = [s, ...loadRecent().filter((x) => x !== s)].slice(0, 6);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
}

export const Route = createFileRoute("/_app/explore")({
  head: () => ({ meta: [{ title: "Explore · RIZZ" }] }),
  component: ExplorePage,
});

function ExplorePage() {
  const [q, setQ] = useState("");
  const [recent, setRecent] = useState<string[]>(() => (typeof window === "undefined" ? [] : loadRecent()));

  useEffect(() => {
    if (!q.trim()) return;
    const id = window.setTimeout(() => { pushRecent(q.trim()); setRecent(loadRecent()); }, 800);
    return () => window.clearTimeout(id);
  }, [q]);

  const search = useQuery({
    queryKey: ["explore-search", q],
    queryFn: async () => {
      const query = supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio, rizz_score, accent_color")
        .order("rizz_score", { ascending: false })
        .not("username", "is", null)
        .limit(30);
      if (q.trim()) query.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).filter((profile) => profile.username !== null);
    },
  });

  const trending = useQuery({
    queryKey: ["trending-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("id, media_url, media_type, like_count, author:profiles!posts_author_id_fkey(username)")
        .not("media_url", "is", null)
        .order("like_count", { ascending: false })
        .limit(9);
      if (error) throw error;
      return data;
    },
  });

  const trendingTags = useQuery({ queryKey: ["trending-tags"], queryFn: () => fetchTrendingTags(12) });

  return (
    <div>
      <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-display text-3xl font-bold tracking-tight mb-1 text-foreground">
        Explore
      </motion.h1>
      <p className="text-sm text-muted-foreground mb-5">Find your people. Find your vibes.</p>

      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search creators, tags…  (⌘K)"
          className="pl-10 border-border bg-card h-11 min-h-[44px]"
        />
        {q && (
          <button onClick={() => setQ("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Clear">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {!q && recent.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="flex items-center gap-1.5 font-display font-semibold text-sm text-muted-foreground">
              <Clock className="h-4 w-4" /> Recent
            </h2>
            <button onClick={() => { localStorage.removeItem(RECENT_KEY); setRecent([]); }} className="text-[10px] text-muted-foreground hover:text-foreground">Clear</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recent.map((r) => (
              <button key={r} onClick={() => setQ(r)} className="border border-border bg-card rounded-full px-3 py-1.5 text-xs hover:border-primary/40 transition-colors">
                {r}
              </button>
            ))}
          </div>
        </section>
      )}

      {trendingTags.data && trendingTags.data.length > 0 && (
        <section className="mb-8">
          <h2 className="flex items-center gap-1.5 font-display font-semibold text-lg mb-3 text-foreground">
            <Hash className="h-5 w-5 text-primary" /> Trending tags
          </h2>
          <div className="flex flex-wrap gap-2">
            {trendingTags.data.map((t) => (
              <Link key={t.tag} to="/tag/$tag" params={{ tag: t.tag }} className="border border-border bg-card rounded-full px-3.5 py-1.5 text-sm hover:border-primary/40 transition-colors flex items-center gap-1.5">
                <span className="font-medium text-foreground">#{t.tag}</span>
                <span className="text-xs text-muted-foreground">{formatNumber(t.post_count)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {trending.data && trending.data.length > 0 && (
        <section className="mb-8">
          <h2 className="flex items-center gap-1.5 font-display font-semibold text-lg mb-3 text-foreground">
            <Flame className="h-5 w-5 text-primary" /> Trending
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {trending.data.map((p) => (
              <div key={p.id} className="aspect-square rounded-xl overflow-hidden bg-card border border-border relative group">
                {p.media_type === "video" ? (
                  <video src={p.media_url ?? ""} className="w-full h-full object-cover" muted />
                ) : (
                  <img src={p.media_url ?? ""} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                  <span className="text-xs font-medium text-white">❤ {formatNumber(p.like_count)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-display font-semibold text-lg mb-3 text-foreground">Top creators</h2>
        <div className="space-y-2">
          {search.data?.map((p) => (
            <Link
              key={p.id}
              to="/u/$username"
              params={{ username: p.username }}
              className="rounded-2xl p-3 flex items-center gap-3 hover:bg-surface-2 border border-border bg-card transition-colors"
            >
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
                <p className="text-xs text-muted-foreground">Rizz</p>
                <p className="font-display font-bold text-primary">{formatNumber(p.rizz_score)}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
