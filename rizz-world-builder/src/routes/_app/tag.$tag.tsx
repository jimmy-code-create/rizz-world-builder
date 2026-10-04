import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Hash, TrendingUp } from "lucide-react";
import { fetchPostsByTag, fetchTrendingTags } from "@/lib/hashtags";
import { PostCard } from "@/components/PostCard";

export const Route = createFileRoute("/_app/tag/$tag")({
  head: ({ params }) => ({ meta: [{ title: `#${params.tag} · RIZZ` }] }),
  component: TagPage,
});

function TagPage() {
  const { tag } = Route.useParams();
  const tagLower = tag.toLowerCase();
  const posts = useQuery({ queryKey: ["tag", tagLower], queryFn: () => fetchPostsByTag(tagLower) });
  const trending = useQuery({ queryKey: ["trending-tags"], queryFn: () => fetchTrendingTags(8) });

  return (
    <div>
      <header className="glass rounded-3xl border border-white/5 p-6 mb-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-primary opacity-10" />
        <div className="relative flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <Hash className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold">#{tagLower}</h1>
            <p className="text-sm text-muted-foreground">{posts.data?.length ?? 0} posts</p>
          </div>
        </div>
      </header>

      {trending.data && trending.data.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground"><TrendingUp className="h-3 w-3" /> Trending</div>
          <div className="flex flex-wrap gap-2">
            {trending.data.map((t) => (
              <Link key={t.tag} to="/tag/$tag" params={{ tag: t.tag }} className={`text-xs px-3 py-1.5 rounded-full border transition-all ${t.tag === tagLower ? "bg-gradient-primary border-transparent text-primary-foreground shadow-glow" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>
                #{t.tag} <span className="opacity-60">· {t.post_count}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {posts.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {posts.data && posts.data.length === 0 && (
        <div className="glass rounded-3xl border border-white/5 p-10 text-center">
          <p className="text-sm text-muted-foreground">No posts with this tag yet. Be the first.</p>
        </div>
      )}
      {posts.data?.map((p) => <PostCard key={p.id} post={p} />)}
    </div>
  );
}