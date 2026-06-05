import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Hash, TrendingUp } from "lucide-react";
import { fetchTrendingTags } from "@/lib/hashtags";

export function TrendingTagsRail() {
  const { data } = useQuery({
    queryKey: ["trending-tags-rail"],
    queryFn: () => fetchTrendingTags(12),
    staleTime: 60_000,
  });
  if (!data || data.length === 0) return null;
  return (
    <div className="glass rounded-3xl p-4 mb-4 border border-white/5">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="h-4 w-4 text-[var(--rizz-pink)]" />
        <h3 className="text-sm font-display font-bold tracking-tight">Trending now</h3>
      </div>
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1 scrollbar-none">
        {data.map((t) => (
          <Link
            key={t.tag}
            to="/tag/$tag"
            params={{ tag: t.tag }}
            className="shrink-0 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
          >
            <Hash className="h-3 w-3 text-[var(--rizz-pink)]" />
            <span>{t.tag}</span>
            <span className="text-muted-foreground">· {t.post_count}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}