import { useEffect, useMemo, useRef, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RizzCat } from "@/components/RizzCat";
import { useAuth } from "@/lib/auth";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { buildCommentTree, newestFirst, pruneDeletedComments } from "@/lib/comment-tree";
import {
  COMMENT_MAX_LENGTH,
  COMMENT_PAGE,
  addComment,
  commentKeys,
  commentReactionError,
  commentVoteError,
  fetchCommentPage,
  fetchCommentReactions,
  fetchCommentVotes,
  softDeleteComment,
  toggleCommentLike,
  toggleCommentReaction,
  type CommentReactionMap,
  type CommentRow,
  type CommentVotes,
} from "@/lib/comment-thread";
import { CommentComposer } from "./CommentComposer";
import { CommentThread } from "./CommentThread";

/**
 * One comment surface, mounted four times.
 *
 * The post sheet, the inline thread under a feed card, the desktop discussion
 * pane and reel comments all render this: the same page of comments, the same
 * vote and reaction caches, the same reply state. It is a column — toolbar,
 * scroller, composer — so each surface only supplies its own chrome around it.
 */
export function CommentSection({
  postId,
  maxLength = COMMENT_MAX_LENGTH,
  compact = false,
  showToolbar = true,
  className,
}: {
  postId: string;
  maxLength?: number;
  compact?: boolean;
  showToolbar?: boolean;
  className?: string;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [sort, setSort] = useState<"top" | "new">("top");
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CommentRow | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  const comments = useQuery({
    queryKey: commentKeys.list(postId),
    queryFn: () => fetchCommentPage(postId),
    enabled: Boolean(postId),
    staleTime: 15_000,
  });

  const ids = useMemo(() => (comments.data ?? []).map((comment) => comment.id), [comments.data]);
  const votesKey = commentKeys.votes(postId, ids);
  const reactionsKey = commentKeys.reactions(postId, ids);

  const votes = useQuery({
    queryKey: votesKey,
    queryFn: () => fetchCommentVotes(ids, user?.id),
    enabled: Boolean(postId) && ids.length > 0,
    staleTime: 15_000,
    // A new comment changes the key; keep the numbers already on screen while
    // the next page loads instead of flashing every pill back to zero.
    placeholderData: keepPreviousData,
  });

  const reactions = useQuery({
    queryKey: reactionsKey,
    queryFn: () => fetchCommentReactions(ids, user?.id),
    enabled: Boolean(postId) && ids.length > 0,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });

  const invalidateThread = () => {
    void qc.invalidateQueries({ queryKey: commentKeys.list(postId) });
    void qc.invalidateQueries({ queryKey: ["feed"] });
  };

  const sendMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to comment");
      const text = body.trim();
      if (!text) throw new Error("Say something first");
      await addComment(postId, user.id, text.slice(0, maxLength), replyTo?.id);
    },
    onSuccess: () => {
      setBody("");
      setReplyTo(null);
      invalidateThread();
    },
    // The draft stays in the box on failure, so nothing typed is ever lost.
    onError: (error: Error) => toast.error(error.message),
  });

  const removeMut = useMutation({
    mutationFn: async (comment: CommentRow) => {
      if (!user) throw new Error("Sign in first");
      await softDeleteComment(comment.id, user.id);
    },
    onSuccess: invalidateThread,
    onError: (error: Error) => toast.error(error.message),
  });

  const voteMut = useMutation({
    mutationFn: (commentId: string) => toggleCommentLike(commentId),
    onMutate: async (commentId: string) => {
      await qc.cancelQueries({ queryKey: votesKey });
      const previous = qc.getQueryData<CommentVotes>(votesKey);
      if (previous) {
        const counts = new Map(previous.counts);
        const mine = new Set(previous.mine);
        const wasVoted = mine.has(commentId);
        if (wasVoted) mine.delete(commentId);
        else mine.add(commentId);
        counts.set(commentId, Math.max(0, (counts.get(commentId) ?? 0) + (wasVoted ? -1 : 1)));
        qc.setQueryData<CommentVotes>(votesKey, { counts, mine });
      }
      return { previous };
    },
    onError: (error: Error, _id, context) => {
      if (context?.previous) qc.setQueryData(votesKey, context.previous);
      toast.error(commentVoteError(error));
    },
    onSuccess: (result, commentId) => {
      const current = qc.getQueryData<CommentVotes>(votesKey);
      if (!current) return;
      const counts = new Map(current.counts);
      const mine = new Set(current.mine);
      counts.set(
        commentId,
        typeof result?.like_count === "number" ? result.like_count : (counts.get(commentId) ?? 0),
      );
      if (result?.liked) mine.add(commentId);
      else mine.delete(commentId);
      qc.setQueryData<CommentVotes>(votesKey, { counts, mine });
    },
  });

  const reactMut = useMutation({
    mutationFn: ({ commentId, emoji }: { commentId: string; emoji: string }) =>
      toggleCommentReaction(commentId, emoji),
    onMutate: async ({ commentId, emoji }) => {
      await qc.cancelQueries({ queryKey: reactionsKey });
      const previous = qc.getQueryData<CommentReactionMap>(reactionsKey);
      if (previous) {
        const next = new Map(previous);
        const bucket = [...(next.get(commentId) ?? [])];
        const index = bucket.findIndex((group) => group.emoji === emoji);
        if (index >= 0) {
          const group = bucket[index];
          const mine = !group.mine;
          const count = Math.max(0, group.count + (mine ? 1 : -1));
          if (count === 0) bucket.splice(index, 1);
          else bucket[index] = { ...group, mine, count };
        } else {
          bucket.push({ emoji, count: 1, mine: true });
        }
        bucket.sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
        next.set(commentId, bucket);
        qc.setQueryData<CommentReactionMap>(reactionsKey, next);
      }
      return { previous };
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previous) qc.setQueryData(reactionsKey, context.previous);
      toast.error(commentReactionError(error));
    },
    onSuccess: (groups, { commentId }) => {
      const current = qc.getQueryData<CommentReactionMap>(reactionsKey);
      if (!current) return;
      const next = new Map(current);
      next.set(commentId, groups);
      qc.setQueryData<CommentReactionMap>(reactionsKey, next);
    },
  });

  const compareRoots = useMemo(() => {
    if (sort === "new") return newestFirst<CommentRow>;
    const counts = votes.data?.counts;
    return (a: CommentRow, b: CommentRow) =>
      (counts?.get(b.id) ?? 0) - (counts?.get(a.id) ?? 0) ||
      b.created_at.localeCompare(a.created_at);
  }, [sort, votes.data]);

  const tree = useMemo(
    () => buildCommentTree(comments.data ?? [], compareRoots),
    [comments.data, compareRoots],
  );
  const visible = useMemo(
    () => pruneDeletedComments(tree, (comment) => Boolean(comment.deleted_at)),
    [tree],
  );

  // Tapping Reply should land the caret in the box, not just move a label.
  useEffect(() => {
    if (replyTo) bodyRef.current?.focus();
  }, [replyTo]);

  const loaded = comments.data?.length ?? 0;
  const capped = loaded >= COMMENT_PAGE;
  const rootCount = tree.roots.filter((root) => visible.has(root.id)).length;

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      {showToolbar && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/5 px-4 py-2">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5" />
            {loaded === 0
              ? "Comments"
              : `${capped ? `${loaded}+` : loaded} ${loaded === 1 ? "comment" : "comments"}`}
          </p>
          {/* Both sorts are always on screen once there is a comment to sort.
              This used to be one button that showed the *current* order and
              flipped when tapped, and it only appeared with more than one
              thread — so on a fresh reel it looked like comments had no sort
              at all. Two pills say what the choices are. */}
          {loaded > 0 && (
            <div
              role="group"
              aria-label="Sort comments"
              className="flex shrink-0 items-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.04] p-0.5"
            >
              {([
                ["top", "Top voted"],
                ["new", "Newest"],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={sort === id}
                  onClick={() => setSort(id)}
                  className={cn(
                    "h-6 rounded-md px-2 text-[11px] font-semibold transition-colors",
                    sort === id
                      ? "bg-white/12 text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div
        className={cn(
          "overscroll-contain",
          compact
            ? "max-h-72 overflow-y-auto px-3 py-2"
            : "min-h-0 flex-1 overflow-y-auto px-4 pb-3",
        )}
      >
        {comments.isLoading && (
          <div className="space-y-3 py-3" aria-label="Loading comments">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex animate-pulse gap-2.5">
                <div className="h-8 w-7 shrink-0 rounded-lg bg-white/[0.06]" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="h-2.5 w-24 rounded bg-white/[0.08]" />
                  <div className="h-2.5 w-full max-w-[16rem] rounded bg-white/[0.05]" />
                </div>
              </div>
            ))}
          </div>
        )}

        {comments.isError && (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              {comments.error instanceof Error
                ? comments.error.message
                : "Comments couldn’t load."}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 h-8"
              onClick={() => void comments.refetch()}
            >
              Try again
            </Button>
          </div>
        )}

        {!comments.isLoading && !comments.isError && rootCount === 0 && (
          <div className="py-8 text-center">
            <RizzCat mood="peek" size={compact ? 72 : 104} className="mx-auto mb-1" />
            <p className="text-sm text-muted-foreground">
              No comments yet — start the thread ✨
            </p>
          </div>
        )}

        {rootCount > 0 && (
          <CommentThread
            tree={tree}
            visible={visible}
            votes={votes.data}
            reactions={reactions.data}
            signedIn={Boolean(user)}
            myId={user?.id}
            replyingTo={replyTo?.id ?? null}
            compact={compact}
            onReply={(comment) =>
              setReplyTo({
                id: comment.id,
                username: comment.author?.username ?? comment.author?.display_name ?? "user",
              })
            }
            onVote={(commentId) => voteMut.mutate(commentId)}
            onReact={(commentId, emoji) => reactMut.mutate({ commentId, emoji })}
            onDelete={(comment) => setPendingDelete(comment)}
          />
        )}

        {capped && (
          <p className="py-3 text-center text-[11px] text-muted-foreground">
            Only the last {COMMENT_PAGE} comments are loaded here.
          </p>
        )}
      </div>

      <CommentComposer
        value={body}
        onChange={setBody}
        onSend={() => sendMut.mutate()}
        pending={sendMut.isPending}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        maxLength={maxLength}
        compact={compact}
        textareaRef={bodyRef}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(next) => {
          if (!next) setPendingDelete(null);
        }}
        title="Delete this comment?"
        description="It disappears from the thread for everyone. Replies that answer it stay where they are. This can't be undone."
        confirmLabel="Delete"
        tone="danger"
        onConfirm={async () => {
          if (!pendingDelete) return;
          await removeMut.mutateAsync(pendingDelete);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
