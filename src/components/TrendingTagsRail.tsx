import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Hash, TrendingUp } from "lucide-react";
import { fetchTrendingTags } from "@/lib/hashtags";
import { formatCount } from "@/lib/utils";

/**
 * The feed's tag rail.
 *
 * It sits between the composer and "LATEST DROPS", so it renders as a small ink
 * card of its own: the same `--brand-ink-2` surface as a post (with the ink
 * palette pinned, so Paper mode cannot repaint the label dark-on-dark), a lime
 * section label, and one horizontal row of pill chips. The chips never wrap —
 * the row scrolls — so a long tag list can't grow the rail and push the feed
 * down. Each chip carries its own count badge instead of a bare number.
 */
export function TrendingTagsRail() {
  const { data } = useQuery({
    queryKey: ["trending-tags-rail"],
    queryFn: () => fetchTrendingTags(12),
    staleTime: 60_000,
  });
  if (!data || data.length < 2) return null;
  return (
    <div data-focus-hide className="py-2">
      <div className="flex items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-[var(--brand-ink-2)] px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="flex shrink-0 items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-[var(--brand-signal)]" strokeWidth={2.5} />
          <span className="font-display text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--brand-signal)]">
            Trending
          </span>
        </div>
        <div className="no-scrollbar -my-1 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-1">
          {data.map((t) => (
            <Link
              key={t.tag}
              to="/tag/$tag"
              params={{ tag: t.tag }}
              className="inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-white/10 bg-white/[0.05] pl-2.5 pr-1 text-[11px] font-medium text-[var(--brand-paper)] transition-colors hover:border-white/20 hover:bg-white/10"
            >
              <Hash className="h-3 w-3 shrink-0 text-[var(--brand-signal)]" strokeWidth={2.5} />
              <span className="max-w-[8.5rem] truncate">{t.tag}</span>
              <span className="ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-white/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none tabular-nums text-[var(--brand-paper-dim)]">
                {formatCount(t.post_count)}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
