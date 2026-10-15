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
    <div data-focus-hide className="rounded-xl px-2.5 py-1.5 mb-2 border border-[#2a2a2e] bg-[#141416] flex items-center gap-2 overflow-hidden">
      <div className="flex items-center gap-1 shrink-0 text-[11px] font-semibold text-foreground">
        <TrendingUp className="h-3 w-3 text-primary" />
        <span className="font-display">Trending</span>
      </div>
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none no-scrollbar py-0.5">
        {data.map((t) => (
          <Link
            key={t.tag}
            to="/tag/$tag"
            params={{ tag: t.tag }}
            className="shrink-0 h-6 px-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 text-[11px] font-medium inline-flex items-center gap-1 transition-colors text-muted-foreground hover:text-foreground"
          >
            <Hash className="h-2.5 w-2.5 text-primary" />
            <span>{t.tag}</span>
            <span className="text-[10px] text-muted-foreground/70">{t.post_count}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}