import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchPostById } from "@/lib/posts";
import { PostCard } from "@/components/PostCard";
import { CommentSection } from "@/components/comments/CommentSection";
import { Button } from "@/components/ui/button";
import { RizzCat } from "@/components/RizzCat";
import { formatRelativeTime } from "@/lib/i18n";
import { EmojiText } from "@/components/emoji/EmojiText";

export const Route = createFileRoute("/_app/p/$postId")({
  validateSearch: (search: Record<string, unknown>): { comment?: string } => ({
    comment: typeof search.comment === "string" && search.comment ? search.comment : undefined,
  }),
  head: () => ({ meta: [{ title: "Post · RIZZ" }] }),
  component: PostPermalinkPage,
});

/**
 * A single post, on its own page.
 *
 * The feed used to open a side discussion sheet, which on a phone covered the
 * post it was discussing and lost your place when you closed it. This route is
 * the full-page view: the post (media, then reactions), then the threaded
 * comments in a scrolling panel with the composer pinned to its bottom. The
 * back button returns to wherever you came from and restores the feed scroll
 * position saved when the card was tapped.
 */
function PostPermalinkPage() {
  const { postId } = Route.useParams();
  const { comment } = Route.useSearch();
  const router = useRouter();

  const post = useQuery({
    queryKey: ["post", postId],
    queryFn: () => fetchPostById(postId),
    enabled: !!postId,
  });

  // The comment a notification refers to, so the page can say which one and
  // open the thread on it.
  const commentRow = useQuery({
    queryKey: ["post-comment", postId, comment],
    queryFn: async () => {
      if (!comment) return null;
      const { data } = await supabase
        .from("post_comments")
        .select(
          "id, body, created_at, author_id, author:profiles!post_comments_author_id_fkey(username, display_name)",
        )
        .eq("id", comment)
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!comment,
  });

  const goBack = () => {
    // `history.length` is not a perfect test, but a deep link opened in a fresh
    // tab should land on the feed rather than close the tab.
    if (typeof window !== "undefined" && window.history.length > 1) router.history.back();
    else void router.navigate({ to: "/feed" });
  };

  if (post.isLoading) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-3">
        <div className="glass h-10 w-28 animate-pulse rounded-xl motion-reduce:animate-none" />
        <div className="glass aspect-square animate-pulse rounded-3xl motion-reduce:animate-none" />
        <div className="glass h-24 animate-pulse rounded-3xl motion-reduce:animate-none" />
      </div>
    );
  }

  if (post.isError || !post.data) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <Button asChild variant="ghost" size="sm" className="mb-3 gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Link to="/feed">
            <ArrowLeft className="h-4 w-4" /> Back to feed
          </Link>
        </Button>
        <div className="glass rounded-3xl p-10 text-center">
          <RizzCat mood="sleepy" size={112} className="mx-auto mb-1" />
          <p className="text-sm text-muted-foreground">
            This post is gone, or it was never public.
          </p>
        </div>
      </div>
    );
  }

  const p = post.data;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={goBack} className="gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <span className="text-[11px] font-semibold text-muted-foreground">
          Post
        </span>
      </div>

      <PostCard post={p} />

      {commentRow.data && (
        <div className="mt-3 flex items-start gap-2 rounded-2xl border border-primary/30 bg-primary/5 p-3">
          <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold text-primary">
              @{commentRow.data.author?.username ?? "someone"} ·{" "}
              {formatRelativeTime(commentRow.data.created_at)}
            </span>
            <span className="block truncate text-sm text-foreground/90">
              <EmojiText text={commentRow.data.body} />
            </span>
          </span>
        </div>
      )}

      {/* The thread grows with its comments and only becomes a scroller once
          it would take more than 62dvh. A fixed-height box used to sit here:
          with one comment it left a screen of empty surface, and because the
          box was itself a scroller, dragging over it never moved the page. */}
      <section
        aria-label="Comments"
        className="glass mt-3 flex max-h-[62dvh] flex-col overflow-hidden rounded-3xl border border-white/10"
      >
        <CommentSection postId={p.id} className="min-h-0 flex-1" />
      </section>
    </div>
  );
}
