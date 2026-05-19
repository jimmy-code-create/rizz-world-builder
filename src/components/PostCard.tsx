import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, MessageCircle, Smile, Share2, Send, Bookmark } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/lib/auth";
import {
  toggleLike, addReaction, removeReaction, fetchReactions, fetchComments, addComment,
  type FeedPost,
} from "@/lib/posts";
import { toggleBookmark } from "@/lib/bookmarks";
import { renderCaptionWithTags } from "@/lib/hashtags";
import { toast } from "sonner";

const QUICK_EMOJIS = ["🔥", "💖", "👀", "💀", "✨", "🎉", "🥶", "👑"];

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function PostCard({ post, liked: initialLiked, saved: initialSaved }: { post: FeedPost; liked?: boolean; saved?: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [liked, setLiked] = useState(!!initialLiked);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [showComments, setShowComments] = useState(false);
  const [saved, setSaved] = useState(!!initialSaved);

  const reactions = useQuery({
    queryKey: ["reactions", post.id],
    queryFn: () => fetchReactions(post.id),
    enabled: post.reaction_count > 0,
  });

  const grouped = (reactions.data ?? []).reduce<Record<string, { count: number; mine: boolean }>>(
    (acc, r) => {
      const e = r.emoji;
      if (!acc[e]) acc[e] = { count: 0, mine: false };
      acc[e].count++;
      if (r.user_id === user?.id) acc[e].mine = true;
      return acc;
    },
    {}
  );

  const likeMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to like");
      const wasLiked = liked;
      setLiked(!wasLiked);
      setLikeCount((c) => c + (wasLiked ? -1 : 1));
      try {
        await toggleLike(post.id, user.id, wasLiked);
      } catch (e) {
        setLiked(wasLiked);
        setLikeCount((c) => c + (wasLiked ? 1 : -1));
        throw e;
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reactMut = useMutation({
    mutationFn: async (emoji: string) => {
      if (!user) throw new Error("Sign in to react");
      const mine = grouped[emoji]?.mine;
      if (mine) await removeReaction(post.id, user.id, emoji);
      else await addReaction(post.id, user.id, emoji);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reactions", post.id] });
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const accent = post.author?.accent_color || "var(--rizz-pink)";
  const initial = (post.author?.display_name || post.author?.username || "?").charAt(0).toUpperCase();

  const bookmarkMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to save");
      const was = saved;
      setSaved(!was);
      try { await toggleBookmark(post.id, user.id, was); }
      catch (e) { setSaved(was); throw e; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bookmarks"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-3xl border border-white/5 overflow-hidden mb-4 hover:border-white/10 transition-colors"
    >
      <header className="flex items-center gap-3 p-4 pb-3">
        <Link to="/u/$username" params={{ username: post.author?.username ?? "" }}>
          <Avatar className="h-10 w-10 ring-2" style={{ boxShadow: `0 0 0 2px ${accent}40` }}>
            <AvatarImage src={post.author?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-gradient-primary text-primary-foreground font-bold">{initial}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-1 min-w-0">
          <Link to="/u/$username" params={{ username: post.author?.username ?? "" }} className="font-semibold text-sm hover:underline block truncate">
            {post.author?.display_name || post.author?.username}
          </Link>
          <p className="text-xs text-muted-foreground truncate">@{post.author?.username} · {timeAgo(post.created_at)}</p>
        </div>
      </header>

      {post.caption && (
        <p className="px-4 pb-3 text-sm leading-relaxed whitespace-pre-wrap">
          {renderCaptionWithTags(post.caption).map((p, i) =>
            p.tag ? (
              <Link key={i} to="/tag/$tag" params={{ tag: p.tag }} className="text-[var(--rizz-pink)] hover:underline font-medium">{p.text}</Link>
            ) : (
              <span key={i}>{p.text}</span>
            )
          )}
        </p>
      )}

      {post.media_url && (
        <div className="relative bg-black/40">
          {post.media_type === "video" ? (
            <video src={post.media_url} controls className="w-full max-h-[600px] object-contain" />
          ) : (
            <img src={post.media_url} alt="" className="w-full max-h-[600px] object-cover" />
          )}
        </div>
      )}

      {Object.keys(grouped).length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pt-3">
          {Object.entries(grouped).map(([emoji, { count, mine }]) => (
            <button
              key={emoji}
              onClick={() => reactMut.mutate(emoji)}
              className={`text-xs px-2 py-1 rounded-full border transition-all ${
                mine
                  ? "bg-[var(--rizz-pink)]/15 border-[var(--rizz-pink)]/40 shadow-glow"
                  : "bg-white/5 border-white/10 hover:bg-white/10"
              }`}
            >
              <span className="mr-1">{emoji}</span>
              <span className="font-medium">{count}</span>
            </button>
          ))}
        </div>
      )}

      <footer className="flex items-center gap-1 px-2 py-2 border-t border-white/5 mt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => likeMut.mutate()}
          className={`gap-1.5 ${liked ? "text-[var(--rizz-pink)]" : "text-muted-foreground"}`}
        >
          <motion.span animate={liked ? { scale: [1, 1.4, 1] } : {}}>
            <Heart className={`h-5 w-5 ${liked ? "fill-current" : ""}`} />
          </motion.span>
          <span className="text-xs font-medium">{likeCount}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowComments((s) => !s)}
          className="gap-1.5 text-muted-foreground"
        >
          <MessageCircle className="h-5 w-5" />
          <span className="text-xs font-medium">{post.comment_count}</span>
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              <Smile className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2 glass-strong border-white/10">
            <div className="flex gap-1">
              {QUICK_EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => reactMut.mutate(e)}
                  className="h-9 w-9 rounded-lg hover:bg-white/10 text-lg transition-transform hover:scale-125"
                >
                  {e}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => bookmarkMut.mutate()}
          className={saved ? "text-[var(--rizz-pink)]" : "text-muted-foreground"}
          aria-label="Save post"
        >
          <Bookmark className={`h-5 w-5 ${saved ? "fill-current" : ""}`} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(window.location.origin + "/u/" + post.author?.username);
            toast.success("Profile link copied");
          }}
          className="text-muted-foreground"
        >
          <Share2 className="h-5 w-5" />
        </Button>
      </footer>

      <AnimatePresence>
        {showComments && <CommentsThread postId={post.id} />}
      </AnimatePresence>
    </motion.article>
  );
}

function CommentsThread({ postId }: { postId: string }) {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const comments = useQuery({
    queryKey: ["comments", postId],
    queryFn: () => fetchComments(postId),
  });
  const mut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to comment");
      if (!body.trim()) return;
      await addComment(postId, user.id, body.trim());
    },
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["comments", postId] });
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="border-t border-white/5 bg-black/20 overflow-hidden"
    >
      <div className="px-4 py-3 max-h-72 overflow-y-auto space-y-3">
        {comments.isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
        {comments.data?.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No comments yet — be first ✨</p>
        )}
        {comments.data?.map((c) => {
          const a = (c as unknown as { author: { username: string; display_name: string | null; avatar_url: string | null } }).author;
          return (
            <div key={c.id} className="flex gap-2 text-sm">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarImage src={a?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-gradient-primary text-[10px]">
                  {(a?.display_name || a?.username || "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-xs">@{a?.username}</span>{" "}
                <span className="text-xs text-muted-foreground">· {timeAgo(c.created_at)}</span>
                <p className="text-sm leading-snug mt-0.5">{c.body}</p>
              </div>
            </div>
          );
        })}
      </div>
      {user && (
        <form
          onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}
          className="flex items-center gap-2 p-3 border-t border-white/5"
        >
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-gradient-primary text-[10px]">
              {(profile?.display_name || profile?.username || "?").charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <Input
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 500))}
            placeholder="Add a comment…"
            className="bg-transparent border-white/10 h-9"
          />
          <Button type="submit" size="icon" disabled={!body.trim() || mut.isPending} className="bg-gradient-primary border-0 h-9 w-9">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      )}
    </motion.div>
  );
}