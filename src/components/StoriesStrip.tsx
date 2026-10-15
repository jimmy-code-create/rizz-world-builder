import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AtSign, Eye, Heart, Loader2, Plus, Send, X } from "lucide-react";
import { CloseButton } from "@/components/ui/close-button";
import { AnimatePresence, motion, MotionConfig, useAnimationControls } from "framer-motion";
import { StoryComposer } from "@/components/StoryComposer";
import { FullScreenLayer } from "@/components/FullScreenLayer";
import { toast } from "@/lib/toast";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { renderCaptionWithTags } from "@/lib/hashtags";
import { useMentionLabels } from "@/lib/mention-tokens";
import { useStoriesStore } from "@/lib/stories-store";
import { useI18n } from "@/lib/i18n";

/**
 * The stories row at the top of the feed, and the full-screen viewer.
 *
 * Stories are 24-hour posts, NOT chat messages: they live in `public.stories`
 * (author, media, caption, expires_at, like_count, audience) and never touch
 * `messages` or `direct_messages` — a reply goes to the author's DM inbox as a
 * normal DM, and the story itself is never rendered in a chat.
 *
 * What was broken before this:
 *  - the like button only flipped a local flag: there was no `story_likes` table
 *    and no `like_count`, so nothing was saved and no count was ever shown;
 *  - tapping the heart again re-inserted the same row and silently failed;
 *  - a failed like left the UI lying about the state (no rollback);
 *  - the ring was always a gradient, so an unseen story looked the same as one
 *    you had already watched.
 *
 * All four are fixed here: the toggle is optimistic with a real rollback, the
 * count round-trips through Postgres, and seen state is remembered per device.
 */
type Story = {
  id: string;
  author_id: string;
  media_url: string;
  media_type: string;
  caption: string | null;
  created_at: string;
  expires_at: string;
  like_count: number;
  view_count: number;
  visibility: "public" | "close_friends" | "followers" | "following";
  author: { username: string; display_name: string | null; avatar_url: string | null; accent_color: string | null } | null;
};

const SEEN_KEY = "rizz:story-seen";

/** author id -> the newest story timestamp that author has already shown me. */
type SeenMap = Record<string, string>;

function loadSeen(): SeenMap {
  if (typeof localStorage === "undefined") return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(SEEN_KEY) || "{}") as SeenMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function StoriesStrip() {
  const { user, profile } = useAuth();
  const { t } = useI18n();
  const [stories, setStories] = useState<Story[]>([]);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [seen, setSeen] = useState<SeenMap>(() => loadSeen());

  const load = useCallback(async () => {
    setLoadError(null);
    const { data, error } = await supabase
      .from("stories")
      .select(
        "*, author:profiles!stories_author_id_fkey(username,display_name,avatar_url,accent_color)",
      )
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    if (error) {
      setLoadError(error.message);
      setLoading(false);
      return;
    }
    const rawStories = (data ?? []) as unknown as Story[];
    if (user) {
      // Fetch who I am following and who follows me in parallel
      const [{ data: myFollowings }, { data: authorsFollowingMe }] = await Promise.all([
        supabase.from("follows").select("following_id").eq("follower_id", user.id),
        supabase.from("follows").select("follower_id").eq("following_id", user.id),
      ]);

      const followingIds = new Set((myFollowings ?? []).map((r: { following_id: string }) => r.following_id));
      const followingMeSet = new Set((authorsFollowingMe ?? []).map((r: { follower_id: string }) => r.follower_id));

      // Home page feed only shows stories from accounts we follow (plus our own)
      const filtered = rawStories.filter((s) => {
        if (s.author_id === user.id) return true;
        if (!followingIds.has(s.author_id)) return false;
        if (s.visibility === "following") {
          return followingMeSet.has(s.author_id);
        }
        return true;
      });
      setStories(filtered);
    } else {
      setStories([]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  // Which of these stories I have already liked — one query for the whole strip.
  useEffect(() => {
    if (!user) {
      setLiked(new Set());
      return;
    }
    void (async () => {
      const { data, error } = await supabase
        .from("story_likes")
        .select("story_id")
        .eq("user_id", user.id);
      if (error) {
        // A read failure must not blank the strip; the button just starts unliked.
        console.debug("Could not load your story likes", error);
        return;
      }
      setLiked(new Set((data ?? []).map((row) => (row as { story_id: string }).story_id)));
    })();
  }, [user]);

  const markSeen = useCallback((authorId: string, at: string) => {
    setSeen((current) => {
      const previous = current[authorId];
      if (previous && new Date(previous) >= new Date(at)) return current;
      const next = { ...current, [authorId]: at };
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify(next));
      } catch {
        // Private mode: seen state is simply forgotten on reload.
      }
      return next;
    });
  }, []);

  /**
   * Optimistic like with a real rollback.
   *
   * The count is changed locally first so the tap feels instant, then written
   * through the user's own session (the `story_likes` policies allow only your
   * own rows) and the `bump_story_likes` trigger moves `stories.like_count`.
   * Anything that goes wrong puts the count back exactly as it was.
   */
  const toggleLike = useCallback(
    async (storyId: string) => {
      if (!user) {
        toast.info("Sign in to like stories");
        return false;
      }
      const wasLiked = liked.has(storyId);
      const delta = wasLiked ? -1 : 1;
      const snapshot = stories;

      setLiked((current) => {
        const next = new Set(current);
        if (wasLiked) next.delete(storyId);
        else next.add(storyId);
        return next;
      });
      setStories((current) =>
        current.map((story) =>
          story.id === storyId
            ? { ...story, like_count: Math.max(0, story.like_count + delta) }
            : story,
        ),
      );

      const query = supabase.from("story_likes");
      const { error } = wasLiked
        ? await query.delete().eq("story_id", storyId).eq("user_id", user.id)
        : await query.insert({ story_id: storyId, user_id: user.id });

      if (error) {
        // Roll back both halves so the UI never shows a like that wasn't saved.
        setLiked((current) => {
          const next = new Set(current);
          if (wasLiked) next.add(storyId);
          else next.delete(storyId);
          return next;
        });
        setStories(snapshot);
        toast.error(
          error.code === "23505"
            ? "You already liked this story."
            : "Couldn't save your like — check your connection and try again.",
        );
        return false;
      }
      return true;
    },
    [liked, stories, user],
  );

  // group by author, latest first
  const grouped = useMemo(
    () =>
      Array.from(
        stories
          .reduce((map, story) => {
            const key = story.author_id;
            if (!map.has(key)) map.set(key, [] as Story[]);
            map.get(key)!.push(story);
            return map;
          }, new Map<string, Story[]>())
          .values(),
      ),
    [stories],
  );

  const hasUnseen = (group: Story[]) => {
    const last = seen[group[0].author_id];
    if (!last) return true;
    return group.some((story) => new Date(story.created_at) > new Date(last));
  };

  useEffect(() => {
    const active = new Set(stories.map((s) => s.author_id));
    const unseen = new Set(
      grouped.filter((g) => hasUnseen(g)).map((g) => g[0].author_id),
    );
    useStoriesStore.getState().setActiveAuthors(active, unseen);
  }, [stories, seen, grouped]);

  const myGroupIdx = grouped.findIndex((g) => g[0].author_id === user?.id);
  const myStories = myGroupIdx >= 0 ? grouped[myGroupIdx] : [];
  const myHasUnseen = myStories.length > 0 && hasUnseen(myStories);

  return (
    <>
      <div className="-mx-4 mb-5 overflow-x-auto px-4 scrollbar-hide md:mx-0 md:px-0">
        <div className="flex items-center gap-3">
          {/* "Your Story" button styled just like Instagram */}
          <div className="flex shrink-0 flex-col items-center gap-1.5">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  if (myStories.length > 0 && myGroupIdx >= 0) {
                    setViewing(myGroupIdx);
                    markSeen(user!.id, myStories[0].created_at);
                  } else {
                    setComposerOpen(true);
                  }
                }}
                className={`relative h-16 w-16 rounded-full p-[2.5px] transition-transform hover:scale-105 active:scale-95 flex items-center justify-center ${
                  myStories.length > 0
                    ? myHasUnseen
                      ? "bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] shadow-[0_0_12px_rgba(220,39,67,0.35)]"
                      : "border-2 border-white/25"
                    : "border-2 border-dashed border-white/20 hover:border-primary/60"
                }`}
                aria-label={myStories.length > 0 ? "View your story" : "Add to your story"}
              >
                <Avatar className="h-full w-full ring-2 ring-background">
                  <AvatarImage src={profile?.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-primary/20 text-primary font-bold text-xs">
                    {(profile?.display_name || profile?.username || "You").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </button>

              {/* Plus badge on bottom-right corner */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setComposerOpen(true);
                }}
                title="Add to story"
                aria-label="Add to story"
                className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-primary text-primary-foreground border-2 border-background grid place-items-center shadow-md hover:scale-110 active:scale-90 transition-transform"
              >
                <Plus className="h-3.5 w-3.5 stroke-[3]" />
              </button>
            </div>
            <span className="text-[10px] font-medium text-foreground/90">{t("your_story")}</span>
          </div>

          {loading &&
            [0, 1, 2].map((index) => (
              <div key={index} className="flex shrink-0 flex-col items-center gap-1.5">
                <div className="h-16 w-16 animate-pulse rounded-full bg-white/10" />
                <div className="h-2.5 w-12 animate-pulse rounded-full bg-white/10" />
              </div>
            ))}

          {grouped.filter((g) => g[0].author_id !== user?.id).map((group) => {
            const story = group[0];
            const unseen = hasUnseen(group);
            const actualIdx = grouped.indexOf(group);
            return (
              <button
                type="button"
                key={story.author_id}
                onClick={() => {
                  setViewing(actualIdx);
                  markSeen(story.author_id, story.created_at);
                }}
                className="flex shrink-0 flex-col items-center gap-1.5 transition-transform hover:scale-105 active:scale-95"
                aria-label={`${unseen ? "Unseen story" : "Story"} from @${story.author?.username ?? "user"}`}
              >
                <div
                  className={`relative h-16 w-16 rounded-full p-[2.5px] ${
                    unseen
                      ? "bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] shadow-[0_0_14px_rgba(220,39,67,0.3)]"
                      : "border-2 border-white/20"
                  }`}
                >
                  <Avatar className="h-full w-full ring-2 ring-background">
                    <AvatarImage src={story.author?.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                      {(story.author?.username ?? "?").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {story.like_count > 0 && (
                    <span className="absolute -bottom-0.5 -right-0.5 inline-flex items-center gap-0.5 rounded-full border border-black/40 bg-black/80 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm">
                      <Heart className="h-2.5 w-2.5 fill-rose-500 text-rose-500" />
                      {story.like_count}
                    </span>
                  )}
                </div>
                <span className="max-w-[64px] truncate text-[10px] font-medium text-muted-foreground">
                  @{story.author?.username ?? "?"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {!loading && loadError && (
        <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-3">
          <span className="text-xs">Stories couldn't be loaded.</span>
          <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      )}

      <AnimatePresence>
        {viewing !== null && grouped[viewing] && (
          <StoryViewer
            key={grouped[viewing][0].author_id}
            group={grouped[viewing]}
            likedIds={liked}
            onToggleLike={toggleLike}
            onClose={() => setViewing(null)}
            onNext={() => {
              const next = viewing + 1 < grouped.length ? viewing + 1 : null;
              setViewing(next);
              if (next !== null) markSeen(grouped[next][0].author_id, grouped[next][0].created_at);
            }}
            onPrev={() => {
              const previous = viewing - 1 >= 0 ? viewing - 1 : null;
              setViewing(previous);
              if (previous !== null) markSeen(grouped[previous][0].author_id, grouped[previous][0].created_at);
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {composerOpen && (
          <StoryComposer open={composerOpen} onClose={() => setComposerOpen(false)} onPosted={load} />
        )}
      </AnimatePresence>
    </>
  );
}

function StoryViewer({
  group,
  likedIds,
  onToggleLike,
  onClose,
  onNext,
  onPrev,
}: {
  group: Story[];
  likedIds: Set<string>;
  onToggleLike: (storyId: string) => Promise<boolean>;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const story = group[idx];
  const { user } = useAuth();
  const [replyBody, setReplyBody] = useState("");
  const [replying, setReplying] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const remainingMs = useRef(5000);
  const timerStartedAt = useRef(0);
  const lastTap = useRef(0);
  const heart = useAnimationControls();
  const [heartBurst, setHeartBurst] = useState(0);
  const quickReactions = ["🔥", "😂", "😮", "😢", "👏"];

  const storyId = story?.id ?? "";
  const captionBodies = useMemo(() => [story?.caption ?? ""], [story?.caption]);
  const mentionLabel = useMentionLabels(captionBodies);
  const isMine = !!user && user.id === story?.author_id;
  const isLiked = likedIds.has(storyId);
  const qc = useQueryClient();
  const reactionsKey = useMemo(() => ["story-reactions", user?.id, storyId], [user?.id, storyId]);

  /**
   * Likes are saved in `story_likes`; reactions are saved in `story_reactions`.
   * Both were on the same row before, which is why the heart could look selected
   * without anything being persisted.
   */
  const reactions = useQuery({
    queryKey: reactionsKey,
    enabled: !!user && !!story,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("story_reactions")
        .select("emoji")
        .eq("story_id", storyId)
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((row: { emoji: string }) => row.emoji) as string[];
    },
  });
  const myReactions = reactions.data ?? [];

  const toggleReaction = async (emoji: string) => {
    if (!user) {
      toast.info("Sign in to react to stories");
      return;
    }
    const selected = myReactions.includes(emoji);
    const prev = myReactions;
    const next = selected ? prev.filter((e) => e !== emoji) : [...prev, emoji];

    // Optimistic update for instant feedback
    qc.setQueryData<string[]>(reactionsKey, next);

    const query = (supabase.from as any)("story_reactions");
    const { error } = selected
      ? await query.delete().eq("story_id", storyId).eq("user_id", user.id).eq("emoji", emoji)
      : await query.insert({ story_id: storyId, user_id: user.id, emoji });
    if (error) {
      qc.setQueryData<string[]>(reactionsKey, prev);
      toast.error("Couldn't save that reaction.");
      return;
    }
  };

  const viewers = useQuery({
    queryKey: ["story-viewers", storyId],
    enabled: !!user && isMine && viewersOpen && !!story,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("story_views")
        .select("viewer_id, viewed_at")
        .eq("story_id", storyId)
        .order("viewed_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const byViewer = new Map<string, (typeof rows)[number]>();
      for (const row of rows) if (!byViewer.has(row.viewer_id)) byViewer.set(row.viewer_id, row);
      const uniqueRows = [...byViewer.values()];
      const viewerIds = uniqueRows.map((row) => row.viewer_id);
      if (!viewerIds.length) return [];
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", viewerIds);
      if (profileError) throw profileError;
      const byId = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
      return uniqueRows.map((row) => ({ ...row, viewer: byId.get(row.viewer_id) ?? null }));
    },
  });

  const sendStoryReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = replyBody.trim();
    if (!user || !story || !text || replying) return;
    if (isMine) {
      toast.info("You can't reply to your own story.");
      return;
    }
    setReplying(true);
    try {
      // The reply is a normal DM that carries the story id, so it lands in the
      // author's inbox as a message with the story attached — never as a story
      // rendered inside chat.
      const { error } = await supabase.from("direct_messages").insert({
        sender_id: user.id,
        recipient_id: story.author_id,
        body: text,
        story_id: story.id,
      });
      if (error) throw error;
      setReplyBody("");
      toast.success("Reply sent to their inbox");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't send your story reply");
    } finally {
      setReplying(false);
    }
  };

  useEffect(() => {
    remainingMs.current = 5000;
  }, [idx, storyId]);

  useEffect(() => {
    if (paused) return;
    if (user && story) {
      supabase
        .from("story_views")
        .insert({ story_id: story.id, viewer_id: user.id })
        .then(() => {});
    }
    const timer = setTimeout(() => {
      if (idx + 1 < group.length) setIdx(idx + 1);
      else onNext();
    }, remainingMs.current);
    timerStartedAt.current = Date.now();
    return () => {
      clearTimeout(timer);
      remainingMs.current = Math.max(0, remainingMs.current - (Date.now() - timerStartedAt.current));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, storyId, group.length, paused, user]);

  /** A double tap likes (and never un-likes) and pops a heart. */
  const handleDoubleTap = async () => {
    setHeartBurst((value) => value + 1);
    void heart.start({ scale: [0.4, 1.15, 1], opacity: [0, 1, 1], transition: { duration: 0.32 } });
    if (!isLiked) await onToggleLike(storyId);
  };

  const registerTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      lastTap.current = 0;
      void handleDoubleTap();
      return true;
    }
    lastTap.current = now;
    return false;
  };

  if (!story) return null;

  return (
    <FullScreenLayer open>
      <MotionConfig reducedMotion="user">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/95"
          onClick={onClose}
        >
          <div
            className="relative z-10 flex h-[100dvh] w-full flex-col overflow-hidden bg-[#090710]"
            style={{
              paddingTop: "env(safe-area-inset-top, 0px)",
              paddingBottom: "env(safe-area-inset-bottom, 0px)",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="absolute left-4 right-4 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] z-30 flex gap-1">
              {group.map((_, index) => (
                <div key={index} className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
                  <div
                    className={`h-full bg-white transition-all ${
                      index < idx ? "w-full" : index === idx ? "w-full animate-[progress_5s_linear]" : "w-0"
                    }`}
                    style={{ animationPlayState: paused ? "paused" : "running" }}
                  />
                </div>
              ))}
            </div>

            <CloseButton
              onClick={onClose}
              aria-label="Close story"
              className="absolute right-3 top-[calc(env(safe-area-inset-top,0px)+1.75rem)] z-30 bg-black/55 backdrop-blur-md"
            />

            <div className="absolute left-3 top-[calc(env(safe-area-inset-top,0px)+1.75rem)] z-30 flex items-center gap-2 rounded-full bg-black/45 px-2 py-1.5 backdrop-blur-md">
              <Avatar className="h-7 w-7 ring-1 ring-white/35">
                <AvatarImage src={story.author?.avatar_url ?? undefined} />
                <AvatarFallback>{(story.author?.username ?? "?").charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <Link
                to="/u/$username"
                params={{ username: story.author?.username ?? "" }}
                className="max-w-36 truncate text-xs font-semibold hover:underline"
              >
                @{story.author?.username}
              </Link>
              {story.visibility === "close_friends" && (
                <span className="rounded-full bg-emerald-500/25 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  Close friends
                </span>
              )}
              {story.visibility === "followers" && (
                <span className="rounded-full bg-sky-500/25 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                  Followers
                </span>
              )}
              {story.visibility === "following" && (
                <span className="rounded-full bg-amber-500/25 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                  Following only
                </span>
              )}
            </div>

            {isMine && (
              <button
                type="button"
                onClick={() => setViewersOpen(true)}
                aria-label="See story viewers and likes"
                className="absolute right-16 top-[calc(env(safe-area-inset-top,0px)+1.75rem)] z-30 inline-flex h-11 items-center gap-1.5 rounded-full border border-white/10 bg-black/55 px-3 text-xs text-white backdrop-blur-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Eye className="h-4 w-4" /> {story.like_count > 0 ? `${story.like_count} ❤` : "Viewers"}
              </button>
            )}

            <div
              className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black/65 pt-10"
              onPointerDown={(event) => {
                if ((event.target as HTMLElement).closest("button, a, input")) return;
                pressStart.current = { x: event.clientX, y: event.clientY };
                setPaused(true);
              }}
              onPointerUp={(event) => {
                const start = pressStart.current;
                pressStart.current = null;
                setPaused(false);
                if (!start) return;
                const dx = event.clientX - start.x;
                const dy = event.clientY - start.y;
                if (dy > 90) {
                  onClose();
                  return;
                }
                if (dx < -90) {
                  if (idx + 1 < group.length) setIdx(idx + 1);
                  else onNext();
                  return;
                }
                if (dx > 90) {
                  if (idx > 0) setIdx(idx - 1);
                  else onPrev();
                  return;
                }
                // A tap (not a drag) can be the second half of a double tap.
                if (Math.abs(dx) < 8 && Math.abs(dy) < 8) registerTap();
              }}
              onPointerCancel={() => {
                pressStart.current = null;
                setPaused(false);
              }}
            >
              {story.media_type === "video" ? (
                <video
                  src={story.media_url}
                  autoPlay
                  playsInline
                  muted={false}
                  className="h-full max-h-full max-w-full object-contain"
                />
              ) : (
                <img
                  src={story.media_url}
                  alt={story.caption ?? "Story"}
                  loading="lazy"
                  decoding="async"
                  className="h-full max-h-full w-full object-cover"
                />
              )}

              <button
                type="button"
                aria-label="Previous story"
                className="absolute left-0 top-16 z-20 h-[calc(100%-4rem)] w-[12%] cursor-w-resize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                onClick={(event) => {
                  event.stopPropagation();
                  if (idx > 0) setIdx(idx - 1);
                  else onPrev();
                }}
              />
              <button
                type="button"
                aria-label="Next story"
                className="absolute right-0 top-16 z-20 h-[calc(100%-4rem)] w-[12%] cursor-e-resize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                onClick={(event) => {
                  event.stopPropagation();
                  if (idx + 1 < group.length) setIdx(idx + 1);
                  else onNext();
                }}
              />

              {/* Double-tap heart. Re-keyed so the animation replays each time. */}
              <AnimatePresence>
                {heartBurst > 0 && (
                  <motion.span
                    key={heartBurst}
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1.1, opacity: 1 }}
                    exit={{ scale: 1.4, opacity: 0 }}
                    transition={{ duration: 0.32, ease: "easeOut" }}
                    className="pointer-events-none absolute grid place-items-center"
                    aria-hidden="true"
                  >
                    <Heart className="h-24 w-24 fill-primary text-primary drop-shadow-[0_0_24px_rgba(255,65,150,0.65)]" />
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            {story.caption && (
              <p className="max-h-24 overflow-y-auto border-t border-white/[0.06] px-4 py-2.5 text-center text-sm leading-snug text-white/90">
                {renderCaptionWithTags(story.caption).map((part, index) =>
                  part.mentionToken ? (
                    <span key={index} className="mention-highlight font-medium">
                      {mentionLabel(part.mentionToken)}
                    </span>
                  ) : part.mention ? (
                    <Link
                      key={index}
                      to="/u/$username"
                      params={{ username: part.mention }}
                      className="mention-highlight font-medium hover:underline"
                    >
                      {part.text}
                    </Link>
                  ) : part.tag ? (
                    <Link key={index} to="/tag/$tag" params={{ tag: part.tag }} className="font-medium text-primary hover:underline">
                      {part.text}
                    </Link>
                  ) : (
                    <span key={index}>{part.text}</span>
                  ),
                )}
              </p>
            )}

            {/* React row: the like chip and the quick emoji live in one capsule,
                so the bar reads as a single control instead of floating emoji. */}
            <div className="flex min-h-[62px] items-center gap-2 border-t border-white/10 bg-white/[0.025] px-3 py-2">
              <button
                type="button"
                aria-label={isLiked ? "Remove like" : "Like story"}
                aria-pressed={isLiked}
                disabled={!user}
                onClick={() => void onToggleLike(story.id)}
                className={`inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isLiked
                    ? "border-primary/45 bg-primary/15 text-primary"
                    : "border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/10"
                }`}
              >
                <motion.span animate={isLiked ? { scale: [1, 1.35, 1] } : {}} transition={{ duration: 0.24 }}>
                  <Heart className={`h-5 w-5 ${isLiked ? "fill-current" : ""}`} />
                </motion.span>
                <span className="text-xs font-bold tabular-nums">{story.like_count}</span>
              </button>

              <div className="no-scrollbar flex min-w-0 flex-1 items-center justify-between gap-0.5 overflow-x-auto rounded-full border border-white/[0.08] bg-white/[0.03] p-1">
                {quickReactions.map((emoji) => {
                  const selected = myReactions.includes(emoji);
                  return (
                    <button
                      key={emoji}
                      type="button"
                      aria-label={`React with ${emoji}`}
                      aria-pressed={selected}
                      disabled={!user}
                      onClick={() => void toggleReaction(emoji)}
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        selected
                          ? "bg-primary/20 ring-1 ring-primary/45"
                          : "hover:bg-white/10"
                      }`}
                    >
                      {emoji}
                    </button>
                  );
                })}
              </div>
            </div>

            {user && !isMine && (
              <form onSubmit={sendStoryReply} className="flex items-center gap-2 border-t border-white/10 bg-white/[0.025] px-3 py-2.5">
                <div className="relative min-w-0 flex-1">
                  <AtSign className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input
                    value={replyBody}
                    onChange={(event) => setReplyBody(event.target.value)}
                    maxLength={2000}
                    aria-label="Reply to story"
                    placeholder="Reply to their inbox…"
                    className="h-11 min-w-0 rounded-full border-white/10 bg-black/25 pl-10"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={!replyBody.trim() || replying}
                  size="icon"
                  aria-label="Send story reply"
                  className="h-11 w-11 shrink-0 rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 active:scale-95"
                >
                  {replying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>
            )}

            <Dialog open={viewersOpen} onOpenChange={setViewersOpen}>
              <DialogContent className="glass-strong z-[140] border-white/10">
                <DialogTitle>Story insights</DialogTitle>
                <div className="flex items-center gap-4 pb-1">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
                    <Eye className="h-4 w-4 text-primary" /> {story.view_count} views
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
                    <Heart className="h-4 w-4 fill-primary text-primary" /> {story.like_count} likes
                  </span>
                </div>
                {viewers.isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading viewers…</p>
                ) : viewers.isError ? (
                  <p className="text-sm text-muted-foreground">Viewer details aren't available right now.</p>
                ) : (viewers.data ?? []).length ? (
                  <div className="max-h-[50dvh] space-y-2 overflow-y-auto">
                    {viewers.data!.map((row: any, index: number) => (
                      <div key={`${row.viewed_at}-${index}`} className="flex items-center gap-3 rounded-xl p-2">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={row.viewer?.avatar_url ?? undefined} />
                          <AvatarFallback>{(row.viewer?.username ?? "?").charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {row.viewer?.display_name || `@${row.viewer?.username ?? "user"}`}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No viewers yet.</p>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </motion.div>
      </MotionConfig>
    </FullScreenLayer>
  );
}
