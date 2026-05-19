import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bookmark } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { fetchMyBookmarks } from "@/lib/bookmarks";
import { PostCard } from "@/components/PostCard";

export const Route = createFileRoute("/_app/bookmarks")({
  head: () => ({ meta: [{ title: "Saved · RIZZ" }] }),
  component: BookmarksPage,
});

function BookmarksPage() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["bookmarks", user?.id],
    queryFn: () => fetchMyBookmarks(user!.id),
    enabled: !!user,
  });

  return (
    <div>
      <header className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
          <Bookmark className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold">Saved</h1>
          <p className="text-sm text-muted-foreground">Posts you bookmarked for later</p>
        </div>
      </header>
      {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {q.data && q.data.length === 0 && (
        <div className="glass rounded-3xl border border-white/5 p-10 text-center">
          <Bookmark className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Nothing saved yet. Tap the bookmark icon on any post.</p>
        </div>
      )}
      {q.data?.map((p) => <PostCard key={p.id} post={p} />)}
    </div>
  );
}