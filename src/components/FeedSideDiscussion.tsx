import { useState, useRef, useEffect, useMemo, memo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare,
  Send,
  ChevronUp,
  CornerDownRight,
  Sparkles,
  Flame,
  Users,
} from "lucide-react";
import { CloseButton } from "@/components/ui/close-button";
import { Avatar, AvatarFallback, AvatarImage, InteractiveAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { fetchComments, addComment, toggleCommentLike, type FeedPost } from "@/lib/posts";
import { FollowSuggestions } from "@/components/FollowSuggestions";
import { RizzCat } from "@/components/RizzCat";
import { formatCount, cn } from "@/lib/utils";
import { commentDepths, commentIndent } from "@/lib/comment-tree";
import { emojiTextClass } from "@/lib/text-size";
import { GifContent } from "@/components/GifContent";
import { toast } from "@/lib/toast";
import { supabase } from "@/integrations/supabase/client";

type CommentRow = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  parent_comment_id?: string | null;
  author?: { username: string; display_name: string | null; avatar_url: string | null } | null;
};

type VoteData = { counts: Map<string, number>; mine: Set<string> };

async function fetchCommentVotes(
  commentIds: string[],
  myId: string | undefined,
): Promise<VoteData> {
  const counts = new Map<string, number>();
  const mine = new Set<string>();
  if (!commentIds.length) return { counts, mine };
  for (let i = 0; i < commentIds.length; i += 100) {
    const slice = commentIds.slice(i, i + 100);
    const { data, error } = await (supabase.from as any)("comment_likes")
      .select("comment_id, user_id")
      .in("comment_id", slice);
    if (error) break;
    for (const row of data ?? []) {
      counts.set(row.comment_id, (counts.get(row.comment_id) ?? 0) + 1);
      if (myId && row.user_id === myId) mine.add(row.comment_id);
    }
  }
  return { counts, mine };
}

function timeAgo(iso: string): string {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function FeedSideDiscussion({
  activePost,
  onClose,
}: {
  activePost: FeedPost | null;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  const postId = activePost?.id ?? "";

  const comments = useQuery({
    queryKey: ["comments", postId],
    queryFn: () => fetchComments(postId) as unknown as Promise<CommentRow[]>,
    enabled: !!postId,
    staleTime: 15_000,
  });

  const ids = useMemo(() => (comments.data ?? []).map((c) => c.id), [comments.data]);
  const votesKey = ["comment-votes", postId, ids.length, ids[0] ?? ""];
  const votes = useQuery({
    queryKey: votesKey,
    queryFn: () => fetchCommentVotes(ids, user?.id),
    enabled: !!postId && ids.length > 0,
    staleTime: 15_000,
  });

  const voteMut = useMutation({
    mutationFn: (commentId: string) => toggleCommentLike(commentId),
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
    onError: (_error, _id, context) => {
      if (context?.previous) qc.setQueryData(votesKey, context.previous);
    },
    onSuccess: (result, commentId) => {
      const current = qc.getQueryData<VoteData>(votesKey);
      if (!current) return;
      const counts = new Map(current.counts);
      const mine = new Set(current.mine);
      counts.set(
        commentId,
        typeof result?.like_count === "number" ? result.like_count : (counts.get(commentId) ?? 0),
      );
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

  const authorsById = useMemo(() => {
    const map = new Map<string, string>();
    for (const comment of comments.data ?? []) {
      map.set(comment.id, comment.author?.username ?? comment.author?.display_name ?? "someone");
    }
    return map;
  }, [comments.data]);

  /** How deep each comment sits in the reply chain, so the thread has shape. */
  const depths = useMemo(() => commentDepths(comments.data ?? []), [comments.data]);

  useEffect(() => {
    if (replyTo) bodyRef.current?.focus();
  }, [replyTo]);

  if (!activePost) {
    return (
      <div className="space-y-4">
        {/* Desktop Discussion Helper Card */}
        <div className="glass rounded-3xl p-5 border border-white/10">
          <div className="flex items-center gap-2 mb-2 text-primary">
            <MessageSquare className="h-4 w-4" />
            <h3 className="text-sm font-display font-bold text-foreground">
              {t("side_discussions")}
            </h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            On wide screens, tap the comment icon on any post to read and reply here side-by-side
            without losing your place in the feed.
          </p>
        </div>

        <FollowSuggestions />

        {/* Gen Z Creator Tip */}
        <div className="glass rounded-3xl p-5 border border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h4 className="text-xs font-display font-bold uppercase tracking-wider text-muted-foreground">
              {t("vibe_check")}
            </h4>
          </div>
          <p className="text-xs text-foreground/80 leading-relaxed">
            Drop polls and GIFs to spark more reactions. Active contributors earn exclusive profile
            badges and drops.
          </p>
        </div>
      </div>
    );
  }

  const postAuthor = activePost.author?.display_name || activePost.author?.username || "creator";

  return (
    <div className="glass-strong rounded-3xl border border-white/10 overflow-hidden flex flex-col h-[calc(100vh-6rem)] sticky top-6 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <InteractiveAvatar
            src={activePost.author?.avatar_url}
            fallback={postAuthor.charAt(0).toUpperCase()}
            size={24}
            userId={activePost.author_id}
            username={activePost.author?.username}
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate leading-tight">{t("discussion")}</p>
            <p className="text-[10px] text-muted-foreground truncate leading-tight">
              @{activePost.author?.username}
            </p>
          </div>
        </div>
        <CloseButton onClick={onClose} aria-label="Close discussion pane" />
      </div>

      {/* Post Caption Preview */}
      {activePost.caption && (
        <div className="px-4 py-2.5 bg-white/[0.02] border-b border-white/5 text-xs text-muted-foreground line-clamp-3">
          &ldquo;{activePost.caption}&rdquo;
        </div>
      )}

      {/* Comments List */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2 space-y-3">
        {comments.isLoading && (
          <p className="py-6 text-center text-xs text-muted-foreground">Loading comments…</p>
        )}

        {!comments.isLoading && (comments.data?.length ?? 0) === 0 && (
          <div className="py-10 text-center">
            <RizzCat mood="peek" size={80} className="mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">
              No comments yet — be the first to reply!
            </p>
          </div>
        )}

        {comments.data?.map((comment) => {
          const author = comment.author;
          const name = author?.display_name || author?.username || "someone";
          const count = votes.data?.counts.get(comment.id) ?? 0;
          const isVoted = votes.data?.mine.has(comment.id) ?? false;
          const parentName = comment.parent_comment_id
            ? authorsById.get(comment.parent_comment_id)
            : null;
          const depth = depths.get(comment.id) ?? 0;

          return (
            <div
              key={comment.id}
              className={cn("flex gap-2 text-xs", depth > 0 && "border-l border-white/10 pl-2")}
              style={depth > 0 ? { marginLeft: commentIndent(depth) } : undefined}
            >
              <button
                type="button"
                onClick={() => voteMut.mutate(comment.id)}
                aria-pressed={isVoted}
                aria-label={isVoted ? "Remove vote" : "Upvote"}
                className={cn(
                  "flex h-7 w-6 shrink-0 flex-col items-center justify-center rounded border text-[10px] font-bold transition",
                  isVoted
                    ? "border-primary/50 bg-primary/15 text-primary"
                    : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground",
                )}
              >
                <ChevronUp className="h-3 w-3" />
                <span className="leading-none">{count}</span>
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-foreground truncate">{name}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {timeAgo(comment.created_at)}
                  </span>
                </div>
                {parentName && (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <CornerDownRight className="h-2.5 w-2.5" /> @{parentName}
                  </p>
                )}
                <p
                  className={cn(
                    "mt-0.5 whitespace-pre-wrap leading-snug",
                    emojiTextClass(comment.body, "comment"),
                  )}
                >
                  <GifContent>{comment.body}</GifContent>
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setReplyTo({ id: comment.id, username: author?.username ?? "user" })
                  }
                  className="mt-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                >
                  Reply
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-white/10 p-3 bg-black/20">
        {replyTo && (
          <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="truncate">Replying to @{replyTo.username}</span>
            <button type="button" className="shrink-0 underline" onClick={() => setReplyTo(null)}>
              Cancel
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (body.trim() && user) sendMut.mutate();
              }
            }}
            rows={2}
            maxLength={2000}
            placeholder={replyTo ? `Reply to @${replyTo.username}…` : "Write a comment…"}
            className="min-h-9 resize-none border-white/10 bg-black/30 text-xs"
          />
          <Button
            type="button"
            size="icon"
            disabled={!user || !body.trim() || sendMut.isPending}
            onClick={() => sendMut.mutate()}
            className="h-9 w-9 shrink-0 border-0 bg-primary text-primary-foreground shadow-md"
            aria-label="Send comment"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
