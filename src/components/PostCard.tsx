import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Heart, MessageCircle, Smile, Share2, Send, Bookmark, MoreHorizontal, Trash2, Flag, Link as LinkIcon, ExternalLink, Pencil, Copy, EyeOff, VolumeX, Download, Languages, Pin, PinOff, Quote, Ban, Lock, Users } from "lucide-react";
import { BadgeRow } from "@/components/BadgeChip";
import { ReactionChipButton } from "@/components/reactions/ReactionChipButton";
import { cn, formatCount } from "@/lib/utils";
import { commentDepths as commentDepthsFor, commentIndent } from "@/lib/comment-tree";
import { getActiveLanguage, useI18n, tf, formatRelativeTime } from "@/lib/i18n";
import { emojiTextClass } from "@/lib/text-size";
import { normalizeAvatarUrl } from "@/lib/default-avatars";
import { Avatar, AvatarFallback, AvatarImage, InteractiveAvatar } from "@/components/ui/avatar";
import { Nameplate } from "@/components/profile/Nameplate";
import { PostCommentsButton } from "@/components/PostCommentsSheet";
import { ProfilePreviewTrigger } from "@/components/ProfilePreview";
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
import { PollBlock } from "@/components/post/PollBlock";
import { QuoteEmbed } from "@/components/post/QuoteEmbed";
import { GifPicker } from "@/components/GifPicker";
import { GifContent } from "@/components/GifContent";
import { renderGifSegments } from "@/lib/gif-content";
import { MarkdownText } from "@/components/MarkdownText";
import { ExternalVideoEmbed } from "@/components/ExternalVideoEmbed";
import { RizzVideoPlayer } from "@/components/RizzVideoPlayer";
import { parseExternalReelLink } from "@/lib/external-reels";
import { blockUser, muteUser } from "@/lib/social";
import { renderCaptionWithTags } from "@/lib/hashtags";
import { toast } from "@/lib/toast";
import { supabase } from "@/integrations/supabase/client";
import { useMediaViewer } from "@/components/media/useMediaViewer";
import { translateText, detectSourceLang, LANGUAGE_NAMES } from "@/lib/translate";
import { loadPrefs } from "@/lib/prefs";
import { PostReactionsSheet } from "@/components/reactions/PostReactionsSheet";

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
  return formatRelativeTime(iso);
}

function PostCardImpl({ post, liked: initialLiked, saved: initialSaved }: { post: FeedPost; liked?: boolean; saved?: boolean }) {
  const isPinned = (post as any).is_pinned === true;
  const externalVideo =
    post.media_type === "video" && post.media_url
      ? parseExternalReelLink(post.media_url)
      : null;
  const { user } = useAuth();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [liked, setLiked] = useState(!!initialLiked);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const localLikeChange = useRef(false);
  const [showComments, setShowComments] = useState(false);
  const [saved, setSaved] = useState(!!initialSaved);
  const [hidden, setHidden] = useState(false);
  const [burst, setBurst] = useState(0);
  const lastTap = useRef(0);
  const burstTimer = useRef<number | null>(null);
  const cardRef = useRef<HTMLElement | null>(null);
  const [reactionsNearViewport, setReactionsNearViewport] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => () => {
    if (burstTimer.current !== null) window.clearTimeout(burstTimer.current);
  }, []);

  useEffect(() => {
    const hp = readSet(HIDDEN_KEY);
    const ma = readSet(MUTED_KEY);
    if (hp.has(post.id) || (post.author_id && ma.has(post.author_id))) setHidden(true);
  }, [post.id, post.author_id]);

  useEffect(() => {
    if (hidden || post.reaction_count < 1 || !cardRef.current) return;
    if (typeof IntersectionObserver === "undefined") {
      setReactionsNearViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setReactionsNearViewport(true);
        observer.disconnect();
      },
      { rootMargin: "300px 0px" },
    );
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [hidden, post.reaction_count]);

  const reactions = useQuery({
    queryKey: ["reactions", post.id],
    queryFn: () => fetchReactions(post.id),
    enabled: post.reaction_count > 0 && reactionsNearViewport,
    staleTime: 30_000,
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
      localLikeChange.current = true;
      setLiked(!wasLiked);
      setLikeCount((c) => c + (wasLiked ? -1 : 1));
      try {
        const result = await toggleLike(post.id, user.id, wasLiked);
        setLiked(result.liked);
        setLikeCount(result.like_count);
        return result;
      } catch (e) {
        localLikeChange.current = false;
        setLiked(wasLiked);
        setLikeCount((c) => c + (wasLiked ? 1 : -1));
        throw e;
      }
    },
    onSuccess: (result) => {
      if (!user) return;
      qc.setQueriesData<Set<string>>({ queryKey: ["my-likes", user.id] }, (previous) => {
        if (!previous) return previous;
        const next = new Set(previous);
        if (result.liked) next.add(post.id);
        else next.delete(post.id);
        return next;
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (initialLiked === undefined) return;
    if (!localLikeChange.current) {
      setLiked(initialLiked);
    } else if (initialLiked === liked) {
      localLikeChange.current = false;
    }
  }, [initialLiked, liked]);

  const reactMut = useMutation({
    mutationFn: async ({ emoji, mine }: { emoji: string; mine: boolean }) => {
      if (!user) throw new Error("Sign in to react");
      if (mine) await removeReaction(post.id, user.id, emoji);
      else await addReaction(post.id, user.id, emoji);
    },
    onMutate: async ({ emoji, mine }) => {
      const queryKey = ["reactions", post.id] as const;
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<Awaited<ReturnType<typeof fetchReactions>>>(queryKey) ?? [];
      const next = mine
        ? previous.filter((reaction) => reaction.emoji !== emoji || reaction.user_id !== user?.id)
        : [...previous, { emoji, user_id: user?.id ?? "" }];
      qc.setQueryData(queryKey, next);
      return { queryKey, previous };
    },
    onSuccess: (_data, variables) => {
      // SINGLE SOURCE OF TRUTH: the server owns the count. Reconcile the
      // reaction list once after the toggle so a chip never lies (a remote
      // SINGLE SOURCE OF TRUTH: the server owns the count. Reconcile the
      // reaction list once after the toggle so a chip never lies (a remote
      // echo, a failed remove or a count the feed cached wrong, all self-heal
      // here). The feed's cached reaction_count is nudged in place instead of
      // invalidated — no refetch, no flicker, no stale number.
      void qc.invalidateQueries({ queryKey: ["reactions", post.id] });
      if (variables) {
        const delta = variables.mine ? -1 : 1;
        qc.setQueriesData<{ id: string; reaction_count?: number }[]>({ queryKey: ["feed"] }, (posts) =>
          posts?.map((entry) =>
            entry.id === post.id
              ? { ...entry, reaction_count: Math.max(0, (entry.reaction_count ?? 0) + delta) }
              : entry,
          ),
        );
      }
    },
    onError: (e: Error, _variables, context) => {
      if (context) qc.setQueryData(context.queryKey, context.previous);
      // A failed remove also leaves the cached reaction_count off by one —
      // reconcile the post list the same way a success would.
      void qc.invalidateQueries({ queryKey: ["reactions", post.id] });
      const mine = _variables?.mine;
      qc.setQueriesData<{ id: string; reaction_count?: number }[]>({ queryKey: ["feed"] }, (posts) =>
        posts?.map((entry) =>
          entry.id === post.id
            ? { ...entry, reaction_count: Math.max(0, (entry.reaction_count ?? 0) + (mine ? 1 : -1)) }
            : entry,
        ),
      );
      toast.error(e.message);
    },
  });
  const toggleReaction = (emoji: string) => {
    if (!user) {
      toast.error("Sign in to react");
      return;
    }
    const current = qc.getQueryData<Awaited<ReturnType<typeof fetchReactions>>>(["reactions", post.id]) ?? reactions.data ?? [];
    const mine = current.some((reaction) => reaction.emoji === emoji && reaction.user_id === user.id);
    reactMut.mutate({ emoji, mine });
  };

  const accent = post.author?.accent_color || "var(--brand-signal)";
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
  const [mediaFailed, setMediaFailed] = useState(false);
  const [reactionsSheetOpen, setReactionsSheetOpen] = useState(false);
  const [initialReactionTab, setInitialReactionTab] = useState<string | null>(null);

  const [translatedCaption, setTranslatedCaption] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslated, setShowTranslated] = useState(false);
  const [translatedLang, setTranslatedLang] = useState<string>("");

  const handleTranslate = async () => {
    if (!post.caption?.trim()) {
      toast.info(t("no_caption"));
      return;
    }
    const currentLang = getActiveLanguage();
    const langLabel = LANGUAGE_NAMES[currentLang] ?? currentLang;

    if (showTranslated) {
      setShowTranslated(false);
      return;
    }

    if (translatedCaption && translatedLang === currentLang) {
      setShowTranslated(true);
      toast.success(`${t("translated_to")} ${langLabel}`);
      return;
    }

    setIsTranslating(true);
    try {
      const translated = await translateText(post.caption, currentLang);
      setTranslatedCaption(translated);
      setTranslatedLang(currentLang);
      setShowTranslated(true);
      toast.success(`${t("translated_to")} ${langLabel}`);
    } catch {
      toast.error(tf("translate_failed", { lang: langLabel }));
    } finally {
      setIsTranslating(false);
    }
  };

  const viewerLang = getActiveLanguage();
  const detectedSource = post.caption ? detectSourceLang(post.caption) : null;
  const canTranslate = Boolean(post.caption?.trim() && (!detectedSource || detectedSource !== viewerLang));

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
  // The permalink for a single post, so a link can point at the post itself
  // and not just the profile it happens to sit on.
  const postUrl = typeof window !== "undefined" ? `${window.location.origin}/p/${post.id}` : "";
  const sharePost = async () => {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try { await (navigator as any).share({ title: `@${post.author?.username} on RIZZ`, text: post.caption ?? "", url: postUrl }); return; } catch {}
    }
    navigator.clipboard.writeText(postUrl);
    toast.success("Link copied");
  };

  // Tapping the photo (not the caption) opens the full-screen viewer.
  const media = useMediaViewer();

  const doubleTapLike = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      if (!liked) likeMut.mutate();
      setBurst((b) => b + 1);
        if (burstTimer.current !== null) window.clearTimeout(burstTimer.current);
        burstTimer.current = window.setTimeout(() => setBurst(0), 650);
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
    if (user) muteUser(user.id, post.author_id).catch(() => {});
    setHidden(true); toast.success(`Muted @${post.author?.username}`);
  };
  const blockAuthor = async () => {
    if (!user || !post.author_id) return;
    if (!confirm(`Block @${post.author?.username}? You won't see each other anywhere on RIZZ.`)) return;
    try {
      await blockUser(user.id, post.author_id);
      setHidden(true);
      qc.invalidateQueries({ queryKey: ["feed"] });
      toast.success(`Blocked @${post.author?.username}`);
    } catch (e: any) { toast.error(e.message); }
  };
  const quoteThis = () => {
    window.dispatchEvent(new CustomEvent("rizz:quote-post", { detail: { id: post.id } }));
    window.dispatchEvent(new Event("rizz:new-post"));
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
  const viewOriginal = () => {
    if (!externalVideo?.ok) return;
    const link = document.createElement("a");
    link.href = externalVideo.value.sourceUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.click();
  };

  if (hidden) return null;

  return (
    <motion.article
      ref={cardRef}
      id={`post-${post.id}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="feed-post-card relative isolate mb-2 overflow-hidden rounded-2xl"
    >
      <header className="flex items-center gap-2.5 p-3 pb-2">
        <AuthorAvatarLink post={post} initial={initial} />
        <div className="flex-1 min-w-0">
          <AuthorNameLink post={post} />
          <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
            <span className="truncate">@{post.author?.username} · {timeAgo(post.created_at)}</span>
            {(post as any).edited_at && <span className="text-[10px] italic">· edited</span>}
            {post.visibility === "close_friends" && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-400/15 px-1.5 text-[9px] font-bold uppercase tracking-wide text-emerald-300">
                <Lock className="h-2.5 w-2.5" /> Close friends
              </span>
            )}
            {isPinned && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-primary uppercase tracking-wider">
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
            <DropdownMenuItem onClick={quoteThis}>
              <Quote className="mr-2 h-4 w-4" /> Quote post
            </DropdownMenuItem>
            {canTranslate && (
              <DropdownMenuItem onClick={handleTranslate} disabled={isTranslating}>
                <Languages className="mr-2 h-4 w-4" />
                {isTranslating
                  ? "Translating…"
                  : showTranslated
                    ? "Show original"
                    : `Translate (${LANGUAGE_NAMES[viewerLang] || "Preferred"})`}
              </DropdownMenuItem>
            )}
            {externalVideo?.ok && (
              <DropdownMenuItem onClick={viewOriginal}>
                <ExternalLink className="mr-2 h-4 w-4" /> View original
              </DropdownMenuItem>
            )}
            {post.media_url && !externalVideo?.ok && (
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
                <DropdownMenuItem onClick={blockAuthor}>
                  <Ban className="mr-2 h-4 w-4" /> Block @{post.author?.username}
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
        <div className="px-3 pb-2">
          <div className={cn("text-sm leading-relaxed", emojiTextClass(showTranslated && translatedCaption ? translatedCaption : post.caption))}>
            {renderGifSegments(showTranslated && translatedCaption ? translatedCaption : post.caption).map((segment, segmentIndex) => segment.isGif || segment.isSticker
              ? <GifContent key={`media-${segmentIndex}`}>{segment.marker ?? ""}</GifContent>
              : <MarkdownText
                  key={`text-${segmentIndex}`}
                  text={segment.value}
                  renderPlainText={(plain) => renderCaptionWithTags(plain).map((p, i) => {
                    if (p.tag) {
                      return <Link key={i} to="/tag/$tag" params={{ tag: p.tag }} className="text-primary hover:underline font-medium">{p.text}</Link>;
                    }
                    if (p.mention) {
                      return <Link key={i} to="/u/$username" params={{ username: p.mention }} className="mention-highlight hover:underline font-medium">{p.text}</Link>;
                    }
                    if (p.url) {
                      return <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline break-all">{p.text}</a>;
                    }
                    return <span key={i}>{p.text}</span>;
                  })}
                />)}
          </div>
          {showTranslated && (
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Languages className="h-3 w-3 text-primary" />
              <span>{t("translated_to")} {LANGUAGE_NAMES[translatedLang] ?? translatedLang}</span>
              <span>·</span>
              <button
                type="button"
                onClick={() => setShowTranslated(false)}
                className="font-medium text-primary hover:underline focus-visible:outline-none"
              >
                See original
              </button>
            </div>
          )}
          {!showTranslated && translatedCaption && (
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Languages className="h-3 w-3" />
              <button
                type="button"
                onClick={() => setShowTranslated(true)}
                className="font-medium text-primary hover:underline focus-visible:outline-none"
              >
                {tf("see_translation_as", { lang: LANGUAGE_NAMES[translatedLang] ?? translatedLang })}
                <span className="ml-1 rounded-full border border-primary/40 px-1 py-px text-[8px] font-bold uppercase text-primary">
                  {t("beta")}
                </span>
              </button>
            </div>
          )}
          {(() => {
            const detectedSource = detectSourceLang(post.caption);
            const userLang = getActiveLanguage();
            const isDifferentLang = detectedSource !== userLang;
            if (!isDifferentLang || translatedCaption || post.caption.trim().length <= 3) return null;
            return (
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Languages className="h-3 w-3" />
                <button
                  type="button"
                  onClick={handleTranslate}
                  disabled={isTranslating}
                  className="font-medium text-muted-foreground hover:text-primary hover:underline focus-visible:outline-none"
                >
                  {isTranslating ? t("translating") : tf("translate_post_as", { lang: LANGUAGE_NAMES[userLang] || "Preferred" })}
                  <span className="ml-1 rounded-full border border-primary/40 px-1 py-px text-[8px] font-bold uppercase text-primary">
                    {t("beta")}
                  </span>
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {post.quote_post_id && <QuoteEmbed postId={post.quote_post_id} />}
      <PollBlock
        postId={post.id}
        translation={
          showTranslated && translatedLang ? { active: true, targetLang: translatedLang } : null
        }
      />

      {post.media_url && !mediaFailed && (
        <div
          className="post-media-frame relative mb-2 max-h-[min(48dvh,390px)] overflow-hidden bg-black/50"
          onClick={
            externalVideo?.ok
              ? undefined
              : (event) => {
                  // Photos and GIFs open the viewer; anything else keeps the like tap.
                  if (media.onMediaClick(event)) return;
                  doubleTapLike();
                }
          }
        >
          {media.viewer}
          {post.media_type === "video" ? (
            externalVideo?.ok ? (
              <ExternalVideoEmbed sourceUrl={post.media_url} className="mx-auto h-[min(48dvh,390px)] w-full max-w-[390px]" />
            ) : (
              <RizzVideoPlayer src={post.media_url} label={`Video by @${post.author?.username ?? "creator"}`} />
            )
          ) : (
            <div className="relative w-full overflow-hidden flex items-center justify-center bg-white/[0.02]">
              {!imageLoaded && (
                <div
                  className="absolute inset-0 skeleton-shimmer animate-shimmer-sweep min-h-[180px]"
                  aria-hidden="true"
                />
              )}
              <img
                src={post.media_url}
                alt=""
                loading="lazy"
                decoding="async"
                onLoad={() => setImageLoaded(true)}
                onError={() => setMediaFailed(true)}
                className={`w-full max-h-[min(48dvh,390px)] object-contain transition-all duration-300 ${
                  imageLoaded ? "opacity-100 blur-0" : "opacity-0 blur-sm"
                }`}
              />
            </div>
          )}
          <AnimatePresence>
            {!externalVideo?.ok && burst > 0 && (
              <motion.div
                key={burst}
                initial={{ scale: reduceMotion ? 1 : 0.88, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
                className="pointer-events-none absolute inset-0 z-10 grid place-items-center"
              >
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/65 px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-md">
                  <Heart className="h-3.5 w-3.5 fill-primary text-primary" />
                  Liked
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {Object.keys(grouped).length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2">
          {Object.entries(grouped).map(([emoji, { count, mine }]) => (
            <ReactionChipButton
              key={emoji}
              emoji={emoji}
              count={count}
              mine={mine}
              // Remove works end to end: the peek's "Remove" button calls the
              // same toggle the chip itself uses (one source of truth).
              target={{
                emoji,
                count,
                source: { kind: "post", id: post.id },
                ...(mine && user ? { remove: () => toggleReaction(emoji) } : {}),
              }}
              onToggle={() => toggleReaction(emoji)}
            />
          ))}
          <button
            type="button"
            onClick={() => {
              setInitialReactionTab("all");
              setReactionsSheetOpen(true);
            }}
            aria-label="View all reactions"
            title="View all reactions"
            className="h-6 w-6 inline-flex items-center justify-center text-muted-foreground hover:text-foreground rounded-full border border-white/10 hover:bg-white/10 transition-colors shrink-0"
          >
            <Users className="h-3 w-3" />
          </button>
        </div>
      )}

      <footer className="flex h-11 items-center gap-1 px-3.5 border-t border-white/5 mt-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => likeMut.mutate()}
          className={`h-8 px-2.5 relative gap-1.5 rounded-full touch-manipulation before:absolute before:-inset-y-1.5 before:inset-x-0 ${liked ? "text-primary" : "text-muted-foreground"}`}
        >
          <motion.span animate={liked ? { scale: [1, 1.4, 1] } : {}}>
            <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
          </motion.span>
          <span className="text-xs font-medium">{formatCount(likeCount)}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            window.dispatchEvent(new CustomEvent("rizz:open-side-discussion", { detail: { post } }));
            setShowComments((s) => !s);
          }}
          className="h-8 px-2.5 relative gap-1.5 rounded-full text-muted-foreground touch-manipulation before:absolute before:-inset-y-1.5 before:inset-x-0"
        >
          <MessageCircle className="h-4 w-4" />
          <span className="text-xs font-medium">{formatCount(post.comment_count)}</span>
        </Button>
        <PostCommentsButton postId={post.id} />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 relative rounded-full text-muted-foreground touch-manipulation before:absolute before:-inset-y-1.5 before:-inset-x-1" aria-label="React to post">
              <Smile className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2 bg-[var(--brand-ink-2,#131315)] border border-[var(--brand-line,#2a2a2e)] rounded-xl shadow-xl">
            <div className="flex gap-1">
              {QUICK_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => toggleReaction(e)}
                  aria-label={`React with ${e}`}
                  className="h-9 w-9 rounded-lg text-lg transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30 hover:bg-white/10 active:scale-95"
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
          className={`h-8 w-8 p-0 relative rounded-full touch-manipulation before:absolute before:-inset-y-1.5 before:-inset-x-1 ${saved ? "text-primary" : "text-muted-foreground"}`}
          aria-label="Save post"
        >
          <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={sharePost}
          className="h-8 w-8 p-0 relative rounded-full text-muted-foreground touch-manipulation before:absolute before:-inset-y-1.5 before:-inset-x-1"
          aria-label="Share post"
        >
          <Share2 className="h-4 w-4" />
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
                className={`text-sm rounded-xl px-3 py-2 border transition-all ${reportReason === r ? "border-primary bg-primary/15" : "border-white/10 hover:bg-white/5"}`}
              >
                {r}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReportOpen(false)}>Cancel</Button>
            <Button onClick={() => reportMut.mutate()} disabled={reportMut.isPending} className="bg-primary text-primary-foreground border-0">Submit report</Button>
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
            <Button onClick={() => editMut.mutate()} disabled={editMut.isPending} className="bg-primary text-primary-foreground border-0">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PostReactionsSheet
        postId={post.id}
        open={reactionsSheetOpen}
        onOpenChange={setReactionsSheetOpen}
        initialEmoji={initialReactionTab}
      />
    </motion.article>
  );
}

function CommentsThread({ postId }: { postId: string }) {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  const comments = useQuery({
    queryKey: ["comments", postId],
    queryFn: () => fetchComments(postId),
  });
  /** How deep each comment sits in the reply chain, so the thread has shape. */
  const commentDepths = useMemo(() => commentDepthsFor(comments.data ?? []), [comments.data]);
  const mut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to comment");
      if (!body.trim()) return;
      await addComment(postId, user.id, body.trim(), replyTo?.id);
    },
    onSuccess: () => {
      setBody("");
      setReplyTo(null);
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
        {comments.data?.map((c: any) => {
          const a = (c as unknown as { author: { username: string; display_name: string | null; avatar_url: string | null } }).author;
          const comment = c as typeof c & { parent_comment_id?: string | null };
          const depth = commentDepths.get(c.id) ?? 0;
          return (
            <div
              key={c.id}
              className={cn("flex gap-2 text-sm", depth > 0 && "border-l border-white/10 pl-2")}
              style={depth > 0 ? { marginLeft: commentIndent(depth) } : undefined}
            >
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarImage src={a?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">
                  {(a?.display_name || a?.username || "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-xs">@{a?.username}</span>{" "}
                <span className="text-xs text-muted-foreground">· {timeAgo(c.created_at)}</span>
                <p className={cn("text-sm leading-snug mt-0.5 whitespace-pre-wrap", emojiTextClass(c.body, "comment"))}><GifContent>{c.body}</GifContent></p>
                <div className="mt-1 flex items-center gap-3">
                  {user && (
                    <button
                      type="button"
                      className="text-[10px] text-muted-foreground hover:text-primary"
                      onClick={() => setReplyTo({ id: c.id, username: a?.username ?? "user" })}
                    >
                      Reply
                    </button>
                  )}
                  {user?.id === c.author_id && (
                    <button
                      type="button"
                      className="text-[10px] text-muted-foreground hover:text-destructive"
                      onClick={async () => {
                        const currentUserId = user?.id;
                        if (!currentUserId) return;
                        const { error } = await (supabase.from as any)("post_comments")
                          .update({ deleted_at: new Date().toISOString() })
                          .eq("id", c.id)
                          .eq("author_id", currentUserId);
                        if (error) {
                          toast.error(error.message);
                          return;
                        }
                        void qc.invalidateQueries({ queryKey: ["comments", postId] });
                        void qc.invalidateQueries({ queryKey: ["feed"] });
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
                <CommentInteractions commentId={c.id} />
              </div>
            </div>
          );
        })}
      </div>
      {user && (
        <div className="border-t border-white/5">
          {replyTo && (
            <div className="flex items-center justify-between px-3 pt-2 text-[11px] text-muted-foreground">
              <span>Replying to @{replyTo.username}</span>
              <button type="button" onClick={() => setReplyTo(null)} className="hover:text-foreground">Cancel</button>
            </div>
          )}
          <form
            onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}
            className="flex items-center gap-2 p-3"
          >
            <GifPicker onSelect={(marker) => setBody((current) => `${current}${current ? " " : ""}${marker}`.slice(0, 500))} />
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">
                {(profile?.display_name || profile?.username || "?").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <Input
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, 500))}
              placeholder={replyTo ? "Write a reply…" : "Add a comment…"}
              className="bg-transparent border-white/10 h-9"
            />
            <Button type="submit" size="icon" disabled={!body.trim() || mut.isPending} className="bg-primary text-primary-foreground border-0 h-9 w-9">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </motion.div>
  );
}

type CommentReaction = { emoji: string; user_id: string };
type CommentInteractions = { reactions: CommentReaction[]; likes: string[] };

function CommentInteractions({ commentId }: { commentId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["comment-interactions", commentId] as const;
  const interactions = useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: async (): Promise<CommentInteractions> => {
      const [reactionResult, likeResult] = await Promise.all([
        (supabase.from as any)("comment_reactions").select("emoji,user_id").eq("comment_id", commentId),
        (supabase.from as any)("comment_likes").select("user_id").eq("comment_id", commentId),
      ]);
      if (reactionResult.error) throw reactionResult.error;
      if (likeResult.error) throw likeResult.error;
      return {
        reactions: reactionResult.data ?? [],
        likes: (likeResult.data ?? []).map((row: { user_id: string }) => row.user_id),
      };
    },
    staleTime: 10_000,
  });
  const current = interactions.data ?? { reactions: [], likes: [] };
  const grouped = current.reactions.reduce<Record<string, { count: number; mine: boolean }>>((result, reaction) => {
    result[reaction.emoji] ??= { count: 0, mine: false };
    result[reaction.emoji].count += 1;
    result[reaction.emoji].mine ||= reaction.user_id === user?.id;
    return result;
  }, {});
  const liked = current.likes.includes(user?.id ?? "");

  const react = useMutation({
    mutationFn: async (emoji: string) => {
      const { data, error } = await (supabase.rpc as any)("toggle_comment_reaction", {
        _comment_id: commentId,
        _emoji: emoji,
      });
      if (error) throw error;
      return data as { emoji: string; count: number; mine: boolean }[];
    },
    onMutate: async (emoji) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<CommentInteractions>(key) ?? { reactions: [], likes: [] };
      const exists = previous.reactions.some((reaction) => reaction.emoji === emoji && reaction.user_id === user?.id);
      qc.setQueryData<CommentInteractions>(key, {
        ...previous,
        reactions: exists
          ? previous.reactions.filter((reaction) => reaction.emoji !== emoji || reaction.user_id !== user?.id)
          : [...previous.reactions, { emoji, user_id: user?.id ?? "" }],
      });
      return { previous };
    },
    onSuccess: (data) => {
      qc.setQueryData<CommentInteractions>(key, (previous) => ({
        reactions: data.flatMap((entry) => Array.from({ length: entry.count }, (_, index) => ({
          emoji: entry.emoji,
          user_id: entry.mine && index === 0 ? user?.id ?? "" : `other-${entry.emoji}-${index}`,
        }))),
        likes: previous?.likes ?? [],
      }));
    },
    onError: (error: Error, _emoji, context) => {
      if (context) qc.setQueryData(key, context.previous);
      toast.error(error.message);
    },
  });

  const toggleLike = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase.rpc as any)("toggle_comment_like", { _comment_id: commentId });
      if (error) throw error;
      return data as { liked: boolean; like_count: number };
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<CommentInteractions>(key) ?? { reactions: [], likes: [] };
      qc.setQueryData<CommentInteractions>(key, {
        ...previous,
        likes: liked
          ? previous.likes.filter((id) => id !== user?.id)
          : [...previous.likes, user?.id ?? ""],
      });
      return { previous };
    },
    onSuccess: (result) => {
      qc.setQueryData<CommentInteractions>(key, (previous) => {
        const likes = (previous?.likes ?? []).filter((id) => id !== user?.id);
        if (result.liked && user) likes.push(user.id);
        return { reactions: previous?.reactions ?? [], likes };
      });
    },
    onError: (error: Error, _variables, context) => {
      if (context) qc.setQueryData(key, context.previous);
      toast.error(error.message);
    },
  });

  if (!user) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      <button
        type="button"
        aria-pressed={liked}
        disabled={toggleLike.isPending}
        onClick={() => toggleLike.mutate()}
        className={`rounded-full px-1.5 py-0.5 text-[10px] ${liked ? "text-primary" : "text-muted-foreground"}`}
      >
        ♥ {current.likes.length || ""}
      </button>
      {["❤️", "😂", "🔥"].map((emoji) => (
        <ReactionChipButton
          key={emoji}
          emoji={emoji}
          count={grouped[emoji]?.count ?? 0}
          mine={grouped[emoji]?.mine ?? false}
          target={{
            emoji,
            count: grouped[emoji]?.count ?? 0,
            source: { kind: "comment", id: commentId },
            ...(grouped[emoji]?.mine ? { remove: () => react.mutate(emoji) } : {}),
          }}
          onToggle={() => react.mutate(emoji)}
          className="h-5 gap-1 px-1.5 text-[10px]"
          title={`React ${emoji}`}
        />
      ))}
    </div>
  );
}

function AuthorAvatarLink({ post, initial }: { post: any; initial: string }) {
  return (
    <InteractiveAvatar
      src={post.author?.avatar_url}
      fallback={initial}
      size="md"
      userId={post.author_id}
      username={post.author?.username}
    />
  );
}

function AuthorNameLink({ post }: { post: any }) {
  const name = post.author?.display_name || post.author?.username || "";
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <ProfilePreviewTrigger
        username={post.author?.username}
        className="min-w-0 truncate text-left text-sm font-semibold hover:underline"
      >
        <Nameplate name={name} />
      </ProfilePreviewTrigger>
      {!!post.author?.badges?.length && <BadgeRow badges={post.author.badges} max={3} size="sm" />}
    </div>
  );
}

// Memoized: a PostCard owns a lot of subtree (media, polls, comment composer),
// so parent re-renders (typing, likes elsewhere) must not re-render every card.
export const PostCard = memo(PostCardImpl);