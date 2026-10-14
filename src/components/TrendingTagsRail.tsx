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
  if (!data || data.length < 2) return null;
  return (
    <div data-focus-hide className="glass rounded-2xl px-3 py-2 mb-2 border border-white/5 flex items-center gap-2.5 overflow-hidden">
      <div className="flex items-center gap-1.5 shrink-0 text-xs font-semibold text-foreground">
        <TrendingUp className="h-3.5 w-3.5 text-primary" />
        <span className="font-display">Trending</span>
      </div>
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none no-scrollbar py-0.5">
        {data.map((t) => (
          <Link
            key={t.tag}
            to="/tag/$tag"
            params={{ tag: t.tag }}
            className="shrink-0 h-7 px-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-medium inline-flex items-center gap-1 transition-colors"
          >
            <Hash className="h-3 w-3 text-primary" />
            <span>{t.tag}</span>
            <span className="text-[10px] text-muted-foreground">{t.post_count}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}