import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, Search, Compass } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { fetchMyBookmarks } from "@/lib/bookmarks";
import { PostCard } from "@/components/PostCard";

export const Route = createFileRoute("/_app/bookmarks")({
  head: () => ({ meta: [{ title: "Saved · RIZZ" }] }),
  component: BookmarksPage,
});

function BookmarksPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const q = useQuery({
    queryKey: ["bookmarks", user?.id],
    queryFn: () => fetchMyBookmarks(user!.id),
    enabled: !!user,
  });
  const filtered = useMemo(() => {
    const list = q.data ?? [];
    if (!search.trim()) return list;
    const t = search.toLowerCase();
    return list.filter((p) =>
      p.caption?.toLowerCase().includes(t) ||
      p.author?.username?.toLowerCase().includes(t) ||
      p.author?.display_name?.toLowerCase().includes(t)
    );
  }, [q.data, search]);

  return (
    <div>
      <header className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
          <Bookmark className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold">Saved</h1>
          <p className="text-sm text-muted-foreground">{q.data?.length ?? 0} posts bookmarked for later</p>
        </div>
      </header>
      {q.data && q.data.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search saved posts…" className="pl-9 glass border-white/10" />
        </div>
      )}
      {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {q.data && q.data.length === 0 && (
        <div className="glass rounded-3xl border border-white/5 p-10 text-center">
          <Bookmark className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground mb-4">Nothing saved yet. Tap the bookmark icon on any post.</p>
          <Button asChild className="bg-gradient-primary border-0 shadow-glow"><Link to="/explore"><Compass className="mr-2 h-4 w-4" /> Discover posts</Link></Button>
        </div>
      )}
      {filtered.map((p) => <PostCard key={p.id} post={p} saved />)}
      {q.data && q.data.length > 0 && filtered.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-10">No saved posts match "{search}"</p>
      )}
    </div>
  );
}