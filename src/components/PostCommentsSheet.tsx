import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronUp, CornerDownRight, Maximize2, Send, ArrowDownUp } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage, InteractiveAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CloseButton } from "@/components/ui/close-button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { addComment, fetchComments, toggleCommentLike } from "@/lib/posts";
import { cn, formatCount } from "@/lib/utils";
import { emojiTextClass } from "@/lib/text-size";
import { GifContent } from "@/components/GifContent";
import { ProfilePreviewTrigger } from "@/components/ProfilePreview";
import { RizzCat } from "@/components/RizzCat";
import { EmojiAutocomplete, replaceEmojiToken } from "@/components/EmojiAutocomplete";

/** The page size fetchComments uses. When a thread fills it, say "100+" instead
 *  of pretending that is the whole thread. */
const COMMENT_PAGE = 100;

type CommentRow = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  parent_comment_id?: string | null;
  author?: { username: string; display_name: string | null; avatar_url: string | null } | null;
};

type VoteData = { counts: Map<string, number>; mine: Set<string> };

function timeAgo(iso: string): string {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  // Months and years, so an old thread never drops a raw locale date into the
  // middle of a relative timeline.
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(months / 12)}y`;
}

/** A missing function means the votes SQL was never applied to this project. */
function voteErrorMessage(error: Error): string {
  if (/toggle_comment_like|schema cache|does not exist|not found|404/i.test(error.message ?? "")) {
    return "Comment votes aren't enabled on this database yet (backend-sql/11_reactions_likes.sql).";
  }
  return error.message;
}

/**
 * Vote counts for a page of comments. Kept in one request for the whole list:
 * the page is capped, so this is a single indexed read rather than one per row.
 */
async function fetchCommentVotes(commentIds: string[], myId: string | undefined): Promise<VoteData> {
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
  parentName,
  onVote,
  onReply,
  isMine,
  onDelete,
}: {
  comment: CommentRow;
  votes: number;
  voted: boolean;
  /** Set when this comment answers another one, so the thread reads as a thread. */
  parentName: string | null;
  onVote: (id: string) => void;
  onReply: (id: string, username: string) => void;
  isMine: boolean;
  onDelete: (id: string) => void;
}) {
  const author = comment.author;
  const name = author?.display_name || author?.username || "someone";
  return (
    <div className={cn("flex gap-2.5 py-2.5", parentName && "ml-3 border-l border-white/10 pl-2.5")}>
      <button
        type="button"
        onClick={() => onVote(comment.id)}
        aria-pressed={voted}
        data-comment-vote
        aria-label={voted ? "Remove your vote" : "Upvote this comment"}
        className={cn(
          "flex h-9 w-8 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border text-[11px] font-bold transition",
          voted
            ? "border-primary/50 bg-primary/15 text-primary"
            : "border-white/10 bg-white/[0.03] text-muted-foreground hover:border-white/20 hover:text-foreground",
        )}
      >
        <ChevronUp className="h-3.5 w-3.5" />
        <span className="leading-none">{formatCount(votes)}</span>
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <InteractiveAvatar
            src={author?.avatar_url}
            fallback={name.charAt(0).toUpperCase()}
            size={24}
            userId={comment.author_id}
            username={author?.username}
          />
          <ProfilePreviewTrigger username={author?.username ?? null} className="min-w-0 truncate text-xs font-semibold">
            {name}
          </ProfilePreviewTrigger>
          <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(comment.created_at)}</span>
        </div>
        {parentName && (
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <CornerDownRight className="h-3 w-3 shrink-0" />
            replying to @{parentName}
          </p>
        )}
        <p className={cn("mt-1 whitespace-pre-wrap text-sm leading-snug", emojiTextClass(comment.body, "comment"))}>
          <GifContent>{comment.body}</GifContent>
        </p>
        <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
          <button
            type="button"
            className="py-0.5 transition-colors hover:text-primary"
            onClick={() => onReply(comment.id, author?.username ?? "user")}
          >
            Reply
          </button>
          {isMine && (
            <button
              type="button"
              className="py-0.5 transition-colors hover:text-destructive"
              onClick={() => onDelete(comment.id)}
            >
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
 * which is what keeps it from stuttering on a phone. Votes apply straight to
 * the cache, so tapping the arrow feels instant and then lands on the server's
 * own number.
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
  const [caret, setCaret] = useState(0);
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  const comments = useQuery({
    queryKey: ["comments", postId],
    queryFn: () => fetchComments(postId) as unknown as Promise<CommentRow[]>,
    enabled: open,
    staleTime: 15_000,
  });

  const ids = useMemo(() => (comments.data ?? []).map((c) => c.id), [comments.data]);
  // One stable key for the read and the vote mutation, so a vote writes to the
  // exact cache entry the list is rendering instead of a sibling query.
  const votesKey = ["comment-votes", postId, ids.length, ids[0] ?? ""];
  const votes = useQuery({
    queryKey: votesKey,
    queryFn: () => fetchCommentVotes(ids, user?.id),
    enabled: open && ids.length > 0,
    staleTime: 15_000,
  });

  const voteMut = useMutation({
    mutationFn: (commentId: string) => toggleCommentLike(commentId),
    // Optimistic: flip the arrow and the number now, roll back if the server
    // says no, then trust the count the RPC returns.
    onMutate: async (commentId: string) => {
      await qc.cancelQueries({ queryKey: votesKey });
      const previous = qc.getQueryData<VoteData>(votesKey);
      if (previous) {
        const counts = new Map(previous.counts);
        const mine = new Set(previous.mine);
        const wasVoted = mine.has(commentId);
        if (wasVoted) mine.delete(commentId);
        else mine.add(commentId);
        counts.set(commentId, Math.max(0, (counts.get(commentId) ?? 0) + (wasVoted ? -1 : 1)));
        qc.setQueryData<VoteData>(votesKey, { counts, mine });
      }
      return { previous };
    },
    onError: (error: Error, _commentId, context) => {
      if (context?.previous) qc.setQueryData(votesKey, context.previous);
      toast.error(voteErrorMessage(error));
    },
    onSuccess: (result, commentId) => {
      const current = qc.getQueryData<VoteData>(votesKey);
      if (!current) return;
      const counts = new Map(current.counts);
      const mine = new Set(current.mine);
      counts.set(commentId, typeof result?.like_count === "number" ? result.like_count : counts.get(commentId) ?? 0);
      if (result?.liked) mine.add(commentId);
      else mine.delete(commentId);
      qc.setQueryData<VoteData>(votesKey, { counts, mine });
    },
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

  /** id -> @handle, so a reply can name the comment it answers. */
  const authorsById = useMemo(() => {
    const map = new Map<string, string>();
    for (const comment of comments.data ?? []) {
      map.set(comment.id, comment.author?.username ?? comment.author?.display_name ?? "someone");
    }
    return map;
  }, [comments.data]);

  // Tapping Reply should land the caret in the box, not just change a label.
  useEffect(() => {
    if (replyTo) bodyRef.current?.focus();
  }, [replyTo]);

  const loaded = comments.data?.length ?? 0;
  const capped = loaded >= COMMENT_PAGE;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="flex h-[92dvh] w-[min(100vw-1rem,44rem)] max-w-none flex-col gap-0 overflow-hidden rounded-3xl border-white/10 glass-strong p-0 sm:h-[86dvh]"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 py-2.5 px-4">
          <DialogTitle className="min-w-0 truncate font-display text-base font-bold">
            Comments{" "}
            {comments.data ? (
              <span className="text-muted-foreground">
                · {capped ? `${loaded}+` : loaded}
              </span>
            ) : null}
          </DialogTitle>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={sort === "top" ? "Sorted by top voted. Switch to newest" : "Sorted by newest. Switch to top voted"}
              onClick={() => setSort((s) => (s === "top" ? "new" : "top"))}
              className="h-8 shrink-0 gap-1.5 border-white/10 bg-white/5 px-2.5 text-xs"
            >
              <ArrowDownUp className="h-3.5 w-3.5" />
              <span className="hidden min-[360px]:inline">{sort === "top" ? "Top voted" : "Newest"}</span>
            </Button>
            <DialogClose asChild>
              <CloseButton />
            </DialogClose>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
          {comments.isLoading && <p className="py-6 text-center text-xs text-muted-foreground">Loading comments…</p>}

          {/* A failed read must not look like an empty thread. */}
          {comments.isError && (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                {comments.error instanceof Error ? comments.error.message : "Comments couldn’t load."}
              </p>
              <Button variant="outline" size="sm" className="mt-3 h-8" onClick={() => void comments.refetch()}>
                Try again
              </Button>
            </div>
          )}

          {!comments.isLoading && !comments.isError && sorted.length === 0 && (
            <div className="py-10 text-center">
              <RizzCat mood="peek" size={104} className="mx-auto mb-1" />
              <p className="text-sm text-muted-foreground">No comments yet — start the thread ✨</p>
            </div>
          )}

          {sorted.map((comment) => (
            <CommentRowView
              key={comment.id}
              comment={comment}
              votes={votes.data?.counts.get(comment.id) ?? 0}
              voted={votes.data?.mine.has(comment.id) ?? false}
              parentName={comment.parent_comment_id ? authorsById.get(comment.parent_comment_id) ?? null : null}
              onVote={(id) => voteMut.mutate(id)}
              onReply={(id, username) => setReplyTo({ id, username })}
              isMine={comment.author_id === user?.id}
              onDelete={(id) => {
                if (window.confirm("Delete this comment?")) removeMut.mutate(id);
              }}
            />
          ))}

          {capped && (
            <p className="py-3 text-center text-[11px] text-muted-foreground">
              Only the {COMMENT_PAGE} most recent comments are loaded here.
            </p>
          )}
        </div>

        <div className="shrink-0 border-t border-white/10 p-3">
          {replyTo && (
            <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="truncate">Replying to @{replyTo.username}</span>
              <button type="button" className="shrink-0 underline" onClick={() => setReplyTo(null)}>
                Cancel
              </button>
            </div>
          )}
          <div className="relative flex items-end gap-2">
            <div className="relative flex-1">
              <Textarea
                ref={bodyRef}
                value={body}
                onChange={(event) => {
                  setBody(event.target.value);
                  setCaret(event.target.selectionStart ?? event.target.value.length);
                }}
                onSelect={(event) => {
                  const target = event.target as HTMLTextAreaElement;
                  setCaret(target.selectionStart ?? 0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    if (body.trim() && user) sendMut.mutate();
                  }
                }}
                rows={2}
                maxLength={2000}
                placeholder={replyTo ? `Reply to @${replyTo.username}…` : "Add a comment… (:cat_ for emojis)"}
                className="min-h-11 resize-none border-white/10 bg-black/20"
              />
              <EmojiAutocomplete
                value={body}
                caret={caret}
                onPick={(token) => {
                  const next = replaceEmojiToken(body, caret, token);
                  setBody(next.value);
                  setCaret(next.caret);
                  requestAnimationFrame(() => {
                    const el = bodyRef.current;
                    if (el) {
                      el.focus();
                      el.setSelectionRange(next.caret, next.caret);
                    }
                  });
                }}
              />
            </div>
            <Button
              type="button"
              size="icon"
              disabled={!user || !body.trim() || sendMut.isPending}
              onClick={() => sendMut.mutate()}
              className="h-11 w-11 shrink-0 border-0 bg-primary text-primary-foreground shadow-md"
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
        className="h-8 w-8 text-muted-foreground rounded-full relative touch-manipulation before:absolute before:-inset-y-1.5 before:-inset-x-1"
      >
        <Maximize2 className="h-4 w-4" />
      </Button>
      <PostCommentsSheet postId={postId} open={open} onOpenChange={setOpen} />
    </>
  );
}
