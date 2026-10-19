import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchPostById } from "@/lib/posts";
import { PostCard } from "@/components/PostCard";
import { PostCommentsSheet } from "@/components/PostCommentsSheet";
import { Button } from "@/components/ui/button";
import { RizzCat } from "@/components/RizzCat";
import { formatRelativeTime } from "@/lib/i18n";

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
 * Every "someone commented on your post" notification used to land on a
 * notifications list that only said "New Comment", with no way to see the
 * post the comment was about. This route is that link: `/p/<post id>` shows
 * the post itself, and `/p/<post id>?comment=<comment id>` opens straight
 * into the thread the comment belongs to.
 */
function PostPermalinkPage() {
  const { postId } = Route.useParams();
  const { comment } = Route.useSearch();
  const [commentsOpen, setCommentsOpen] = useState(false);

  const post = useQuery({
    queryKey: ["post", postId],
    queryFn: () => fetchPostById(postId),
    enabled: !!postId,
  });

  // The comment a notification refers to, so the thread can be opened on it.
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

  // A link that names a comment opens the thread straight away.
  useEffect(() => {
    if (comment && commentRow.data) setCommentsOpen(true);
  }, [comment, commentRow.data]);

  if (post.isLoading) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <div className="glass h-40 animate-pulse rounded-3xl" />
      </div>
    );
  }

  if (post.isError || !post.data) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <Button asChild variant="ghost" size="sm" className="mb-3 gap-1.5">
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
      <Button asChild variant="ghost" size="sm" className="mb-3 gap-1.5">
        <Link to="/feed">
          <ArrowLeft className="h-4 w-4" /> Back to feed
        </Link>
      </Button>

      <PostCard post={p} />

      {commentRow.data && (
        <button
          type="button"
          onClick={() => setCommentsOpen(true)}
          className="mt-3 flex w-full items-start gap-2 rounded-2xl border border-primary/30 bg-primary/5 p-3 text-left transition-colors hover:bg-primary/10"
        >
          <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold text-primary">
              @{commentRow.data.author?.username ?? "someone"} ·{" "}
              {formatRelativeTime(commentRow.data.created_at)}
            </span>
            <span className="block truncate text-sm text-foreground/90">
              {commentRow.data.body}
            </span>
          </span>
        </button>
      )}

      <PostCommentsSheet open={commentsOpen} onOpenChange={setCommentsOpen} postId={p.id} />
    </div>
  );
}
