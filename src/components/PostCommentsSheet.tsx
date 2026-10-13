import { memo, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronUp, Maximize2, Send, ArrowDownUp } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { addComment, fetchComments, toggleCommentLike } from "@/lib/posts";
import { cn, formatCount } from "@/lib/utils";
import { emojiTextClass } from "@/lib/text-size";
import { ProfilePreviewTrigger } from "@/components/ProfilePreview";

type CommentRow = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  parent_comment_id?: string | null;
  author?: { username: string; display_name: string | null; avatar_url: string | null } | null;
};

function timeAgo(iso: string): string {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

/**
 * Vote counts for a page of comments. Kept in one request for the whole list:
 * the page is capped, so this is a single indexed read rather than one per row.
 */
async function fetchCommentVotes(commentIds: string[], myId: string | undefined) {
  const counts = new Map<string, number>();
  const mine = new Set<string>();
  if (!commentIds.length) return { counts, mine };
  for (let i = 0; i < commentIds.length; i += 100) {
    const slice = commentIds.slice(i, i + 100);
    const { data, error } = await (supabase.from as any)("comment_likes")
      .select("comment_id, user_id")
      .in("comment_id", slice);
    if (error) break; // older projects simply show no vote numbers yet
    for (const row of data ?? []) {
      counts.set(row.comment_id, (counts.get(row.comment_id) ?? 0) + 1);
      if (myId && row.user_id === myId) mine.add(row.comment_id);
    }
  }
  return { counts, mine };
}

const CommentRowView = memo(function CommentRowView({
  comment,
  votes,
  voted,
  onVote,
  onReply,
  isMine,
  onDelete,
}: {
  comment: CommentRow;
  votes: number;
  voted: boolean;
  onVote: (id: string) => void;
  onReply: (id: string, username: string) => void;
  isMine: boolean;
  onDelete: (id: string) => void;
}) {
  const author = comment.author;
  const name = author?.display_name || author?.username || "someone";
  return (
    <div className="flex gap-3 py-3">
      <button
        type="button"
        onClick={() => onVote(comment.id)}
        aria-pressed={voted}
        data-comment-vote
        aria-label={voted ? "Remove your vote" : "Upvote this comment"}
        className={cn(
          "flex h-11 w-9 shrink-0 flex-col items-center justify-center rounded-xl border text-[11px] font-bold transition",
          voted
            ? "border-[var(--rizz-pink)]/50 bg-[var(--rizz-pink)]/15 text-[var(--rizz-pink)]"
            : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground",
        )}
      >
        <ChevronUp className="h-4 w-4" />
        {formatCount(votes)}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6 shrink-0">
            <AvatarImage src={author?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-gradient-primary text-[9px] font-bold">
              {name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <ProfilePreviewTrigger username={author?.username ?? null} className="min-w-0 truncate text-xs font-semibold">
            {name}
          </ProfilePreviewTrigger>
          <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(comment.created_at)}</span>
        </div>
        <p className={cn("mt-1 whitespace-pre-wrap text-sm leading-snug", emojiTextClass(comment.body))}>
          {comment.body}
        </p>
        <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
          <button
            type="button"
            className="hover:text-[var(--rizz-pink)]"
            onClick={() => onReply(comment.id, author?.username ?? "user")}
          >
            Reply
          </button>
          {isMine && (
            <button type="button" className="hover:text-destructive" onClick={() => onDelete(comment.id)}>
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

/**
 * The full-screen comment page.
 *
 * One request for the page of comments and one for their votes (capped at the
 * same 100 rows the inline list uses), memoised rows, and no layout animation —
 * which is what keeps it from stuttering on a phone.
 */
export function PostCommentsSheet({
  postId,
  open,
  onOpenChange,
}: {
  postId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [sort, setSort] = useState<"top" | "new">("top");
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);

  const comments = useQuery({
    queryKey: ["comments", postId],
    queryFn: () => fetchComments(postId) as unknown as Promise<CommentRow[]>,
    enabled: open,
    staleTime: 15_000,
  });

  const ids = useMemo(() => (comments.data ?? []).map((c) => c.id), [comments.data]);
  const votes = useQuery({
    queryKey: ["comment-votes", postId, ids.length, ids[0] ?? ""],
    queryFn: () => fetchCommentVotes(ids, user?.id),
    enabled: open && ids.length > 0,
    staleTime: 15_000,
  });

  const voteMut = useMutation({
    mutationFn: (commentId: string) => toggleCommentLike(commentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comment-votes", postId] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const sendMut = useMutation({
    mutationFn: () => addComment(postId, user!.id, body.trim(), replyTo?.id),
    onSuccess: () => {
      setBody("");
      setReplyTo(null);
      qc.invalidateQueries({ queryKey: ["comments", postId] });
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeMut = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await (supabase.from as any)("post_comments")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", commentId)
        .eq("author_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comments", postId] });
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const sorted = useMemo(() => {
    const list = [...(comments.data ?? [])];
    if (sort === "new") {
      list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    } else {
      const counts = votes.data?.counts;
      list.sort((a, b) => (counts?.get(b.id) ?? 0) - (counts?.get(a.id) ?? 0) || b.created_at.localeCompare(a.created_at));
    }
    return list;
  }, [comments.data, sort, votes.data]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92dvh] w-[min(100vw-1rem,44rem)] max-w-none flex-col gap-0 overflow-hidden rounded-3xl border-white/10 glass-strong p-0 sm:h-[86dvh]">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <DialogTitle className="font-display text-base font-bold">
            Comments {comments.data ? <span className="text-muted-foreground">· {comments.data.length}</span> : null}
          </DialogTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSort((s) => (s === "top" ? "new" : "top"))}
            className="h-8 gap-1.5 border-white/10 bg-white/5 text-xs"
          >
            <ArrowDownUp className="h-3.5 w-3.5" />
            {sort === "top" ? "Top voted" : "Newest"}
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
          {comments.isLoading && <p className="py-6 text-center text-xs text-muted-foreground">Loading comments…</p>}
          {!comments.isLoading && sorted.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">No comments yet — start the thread ✨</p>
          )}
          {sorted.map((comment) => (
            <CommentRowView
              key={comment.id}
              comment={comment}
              votes={votes.data?.counts.get(comment.id) ?? 0}
              voted={votes.data?.mine.has(comment.id) ?? false}
              onVote={(id) => voteMut.mutate(id)}
              onReply={(id, username) => setReplyTo({ id, username })}
              isMine={comment.author_id === user?.id}
              onDelete={(id) => removeMut.mutate(id)}
            />
          ))}
        </div>

        <div className="border-t border-white/10 p-3">
          {replyTo && (
            <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Replying to @{replyTo.username}</span>
              <button type="button" className="underline" onClick={() => setReplyTo(null)}>
                Cancel
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <Textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (body.trim() && user) sendMut.mutate();
                }
              }}
              rows={2}
              maxLength={2000}
              placeholder={replyTo ? `Reply to @${replyTo.username}…` : "Add a comment…"}
              className="min-h-11 resize-none border-white/10 bg-black/20"
            />
            <Button
              type="button"
              size="icon"
              disabled={!user || !body.trim() || sendMut.isPending}
              onClick={() => sendMut.mutate()}
              className="h-11 w-11 shrink-0 border-0 bg-gradient-primary shadow-glow"
              aria-label="Send comment"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Small launcher that owns its own open state, so a post card can offer the
 * full-screen page without threading another piece of state through it.
 */
export function PostCommentsButton({ postId }: { postId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label="Open the full-screen comments page"
        className="text-muted-foreground"
      >
        <Maximize2 className="h-4 w-4" />
      </Button>
      <PostCommentsSheet postId={postId} open={open} onOpenChange={setOpen} />
    </>
  );
}
