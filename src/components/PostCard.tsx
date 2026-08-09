import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, MessageCircle, Smile, Share2, Send, Bookmark, MoreHorizontal, Trash2, Flag, Link as LinkIcon, Pencil, Copy, EyeOff, VolumeX, Download, Languages, Pin, PinOff } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarDecoration } from "@/components/profile/AvatarDecoration";
import { Nameplate } from "@/components/profile/Nameplate";
import { useEquipped } from "@/lib/useEquipped";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import {
  toggleLike, addReaction, removeReaction, fetchReactions, fetchComments, addComment,
  deletePost, reportPost, updatePostCaption, togglePinPost,
  type FeedPost,
} from "@/lib/posts";
import { toggleBookmark } from "@/lib/bookmarks";
import { renderCaptionWithTags } from "@/lib/hashtags";
import { toast } from "sonner";

const QUICK_EMOJIS = ["🔥", "💖", "👀", "💀", "✨", "🎉", "🥶", "👑"];
const REPORT_REASONS = ["Spam", "Harassment", "Nudity", "Hate speech", "Violence", "Other"];

const HIDDEN_KEY = "rizz:hidden-posts";
const MUTED_KEY = "rizz:muted-authors";
const readSet = (k: string): Set<string> => {
  if (typeof window === "undefined") return new Set();
  try { return new Set(JSON.parse(localStorage.getItem(k) || "[]")); } catch { return new Set(); }
};
const writeSet = (k: string, s: Set<string>) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(k, JSON.stringify([...s]));
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function PostCard({ post, liked: initialLiked, saved: initialSaved }: { post: FeedPost; liked?: boolean; saved?: boolean }) {
  const isPinned = (post as any).is_pinned === true;
  const { user } = useAuth();
  const qc = useQueryClient();
  const [liked, setLiked] = useState(!!initialLiked);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [showComments, setShowComments] = useState(false);
  const [saved, setSaved] = useState(!!initialSaved);
  const [hidden, setHidden] = useState(false);
  const [burst, setBurst] = useState(0);
  const lastTap = useRef(0);

  useEffect(() => {
    const hp = readSet(HIDDEN_KEY);
    const ma = readSet(MUTED_KEY);
    if (hp.has(post.id) || (post.author_id && ma.has(post.author_id))) setHidden(true);
  }, [post.id, post.author_id]);

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

  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [editOpen, setEditOpen] = useState(false);
  const [caption, setCaption] = useState(post.caption ?? "");

  const deleteMut = useMutation({
    mutationFn: () => deletePost(post.id),
    onSuccess: () => {
      toast.success("Post deleted");
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["user-posts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reportMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to report");
      await reportPost({ postId: post.id, reporterId: user.id, reason: reportReason });
    },
    onSuccess: () => { toast.success("Report submitted — thanks"); setReportOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const editMut = useMutation({
    mutationFn: () => updatePostCaption(post.id, caption),
    onSuccess: () => {
      toast.success("Post updated");
      setEditOpen(false);
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["user-posts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pinMut = useMutation({
    mutationFn: () => togglePinPost(post.id, isPinned),
    onSuccess: () => {
      toast.success(isPinned ? "Unpinned" : "Pinned to top");
      qc.invalidateQueries({ queryKey: ["user-posts"] });
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isMine = user?.id === post.author_id;
  const postUrl = typeof window !== "undefined" ? `${window.location.origin}/u/${post.author?.username}` : "";
  const sharePost = async () => {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try { await (navigator as any).share({ title: `@${post.author?.username} on RIZZ`, text: post.caption ?? "", url: postUrl }); return; } catch {}
    }
    navigator.clipboard.writeText(postUrl);
    toast.success("Link copied");
  };

  const doubleTapLike = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      if (!liked) likeMut.mutate();
      setBurst((b) => b + 1);
    }
    lastTap.current = now;
  };
  const hideLocally = () => {
    const s = readSet(HIDDEN_KEY); s.add(post.id); writeSet(HIDDEN_KEY, s);
    setHidden(true); toast.success("Post hidden");
  };
  const muteAuthor = () => {
    if (!post.author_id) return;
    const s = readSet(MUTED_KEY); s.add(post.author_id); writeSet(MUTED_KEY, s);
    setHidden(true); toast.success(`Muted @${post.author?.username}`);
  };
  const copyText = () => {
    if (!post.caption) return toast.info("No caption to copy");
    navigator.clipboard.writeText(post.caption); toast.success("Caption copied");
  };
  const downloadMedia = () => {
    if (!post.media_url) return toast.info("No media to download");
    const a = document.createElement("a");
    a.href = post.media_url; a.target = "_blank"; a.rel = "noopener";
    a.click(); toast.success("Opening media");
  };

  if (hidden) return null;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-3xl border border-white/5 overflow-hidden mb-4 hover:border-white/10 transition-colors"
    >
      <header className="flex items-center gap-3 p-4 pb-3">
        <AuthorAvatarLink post={post} accent={accent} initial={initial} />
        <div className="flex-1 min-w-0">
          <AuthorNameLink post={post} />
          <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
            <span className="truncate">@{post.author?.username} · {timeAgo(post.created_at)}</span>
            {isPinned && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[var(--rizz-pink)] uppercase tracking-wider">
                <Pin className="h-2.5 w-2.5 fill-current" /> Pinned
              </span>
            )}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground h-8 w-8" aria-label="More">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="glass-strong border-white/10">
            <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(postUrl); toast.success("Link copied"); }}>
              <LinkIcon className="mr-2 h-4 w-4" /> Copy link
            </DropdownMenuItem>
            <DropdownMenuItem onClick={copyText}>
              <Copy className="mr-2 h-4 w-4" /> Copy text
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.success("Translated to English (preview)")}>
              <Languages className="mr-2 h-4 w-4" /> Translate
            </DropdownMenuItem>
            {post.media_url && (
              <DropdownMenuItem onClick={downloadMedia}>
                <Download className="mr-2 h-4 w-4" /> Download media
              </DropdownMenuItem>
            )}
            {isMine ? (
              <>
                <DropdownMenuItem onClick={() => pinMut.mutate()}>
                  {isPinned ? <><PinOff className="mr-2 h-4 w-4" /> Unpin from profile</> : <><Pin className="mr-2 h-4 w-4" /> Pin to profile</>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setCaption(post.caption ?? ""); setEditOpen(true); }}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit caption
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => { if (confirm("Delete this post?")) deleteMut.mutate(); }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete post
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={hideLocally}>
                  <EyeOff className="mr-2 h-4 w-4" /> Hide this post
                </DropdownMenuItem>
                <DropdownMenuItem onClick={muteAuthor}>
                  <VolumeX className="mr-2 h-4 w-4" /> Mute @{post.author?.username}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setReportOpen(true)} className="text-destructive focus:text-destructive">
                  <Flag className="mr-2 h-4 w-4" /> Report post
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {post.caption && (
        <p className="px-4 pb-3 text-sm leading-relaxed whitespace-pre-wrap">
          {renderCaptionWithTags(post.caption).map((p, i) => {
            if (p.tag) {
              return (
                <Link key={i} to="/tag/$tag" params={{ tag: p.tag }} className="text-[var(--rizz-pink)] hover:underline font-medium">{p.text}</Link>
              );
            }
            if (p.mention) {
              return (
                <Link key={i} to="/u/$username" params={{ username: p.mention }} className="text-[var(--rizz-pink)] hover:underline font-medium">{p.text}</Link>
              );
            }
            if (p.url) {
              return (
                <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline break-all">{p.text}</a>
              );
            }
            return <span key={i}>{p.text}</span>;
          })}
        </p>
      )}

      {post.media_url && (
        <div className="relative bg-black/40" onClick={doubleTapLike}>
          {post.media_type === "video" ? (
            <video src={post.media_url} controls preload="metadata" playsInline className="w-full max-h-[600px] object-contain" />
          ) : (
            <img src={post.media_url} alt="" loading="lazy" decoding="async" className="w-full max-h-[600px] object-cover" />
          )}
          <AnimatePresence>
            {burst > 0 && (
              <motion.div
                key={burst}
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1.4, opacity: 1 }}
                exit={{ scale: 1.8, opacity: 0 }}
                transition={{ duration: 0.55 }}
                className="pointer-events-none absolute inset-0 grid place-items-center"
                onAnimationComplete={() => setBurst(0)}
              >
                <Heart className="h-24 w-24 text-[var(--rizz-pink)] fill-current drop-shadow-[0_0_30px_rgba(255,45,146,0.8)]" />
              </motion.div>
            )}
          </AnimatePresence>
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
          onClick={sharePost}
          className="text-muted-foreground"
        >
          <Share2 className="h-5 w-5" />
        </Button>
      </footer>

      <AnimatePresence>
        {showComments && <CommentsThread postId={post.id} />}
      </AnimatePresence>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="glass-strong border-white/10">
          <DialogTitle className="font-display">Report this post</DialogTitle>
          <DialogDescription>Tell us what's wrong. Our team will review.</DialogDescription>
          <div className="grid grid-cols-2 gap-2 pt-2">
            {REPORT_REASONS.map((r) => (
              <button
                key={r}
                onClick={() => setReportReason(r)}
                className={`text-sm rounded-xl px-3 py-2 border transition-all ${reportReason === r ? "border-[var(--rizz-pink)] bg-[var(--rizz-pink)]/15" : "border-white/10 hover:bg-white/5"}`}
              >
                {r}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReportOpen(false)}>Cancel</Button>
            <Button onClick={() => reportMut.mutate()} disabled={reportMut.isPending} className="bg-gradient-primary border-0">Submit report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="glass-strong border-white/10">
          <DialogTitle className="font-display">Edit caption</DialogTitle>
          <DialogDescription>Refine your post — the original media stays the same.</DialogDescription>
          <Textarea value={caption} onChange={(e) => setCaption(e.target.value.slice(0, 2000))} rows={5} className="bg-transparent border-white/10" />
          <p className="text-[10px] text-muted-foreground text-right">{caption.length}/2000</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={() => editMut.mutate()} disabled={editMut.isPending} className="bg-gradient-primary border-0">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

function AuthorAvatarLink({ post, accent, initial }: { post: any; accent: string; initial: string }) {
  const eq = useEquipped(post.author_id);
  const deco = eq.data?.avatar_decoration;
  return (
    <Link to="/u/$username" params={{ username: post.author?.username ?? "" }}>
      {deco ? (
        <AvatarDecoration
          src={post.author?.avatar_url}
          fallback={initial}
          size={40}
          effectSlug={deco.slug}
          accent={deco.preview_color || accent}
        />
      ) : (
        <Avatar className="h-10 w-10 ring-2" style={{ boxShadow: `0 0 0 2px ${accent}40` }}>
          <AvatarImage src={post.author?.avatar_url ?? undefined} />
          <AvatarFallback className="bg-gradient-primary text-primary-foreground font-bold">{initial}</AvatarFallback>
        </Avatar>
      )}
    </Link>
  );
}

function AuthorNameLink({ post }: { post: any }) {
  const eq = useEquipped(post.author_id);
  const np = eq.data?.nameplate;
  const name = post.author?.display_name || post.author?.username || "";
  return (
    <Link
      to="/u/$username"
      params={{ username: post.author?.username ?? "" }}
      className="font-semibold text-sm hover:underline block truncate"
    >
      <Nameplate name={name} slug={np?.slug} />
    </Link>
  );
}