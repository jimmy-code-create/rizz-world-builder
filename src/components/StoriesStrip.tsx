import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, Plus, X, Eye, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { StoryComposer } from "@/components/StoryComposer";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Story = {
  id: string;
  author_id: string;
  media_url: string;
  media_type: string;
  caption: string | null;
  created_at: string;
  expires_at: string;
  author: { username: string; display_name: string | null; avatar_url: string | null; accent_color: string | null } | null;
};

export function StoriesStrip() {
  const { user } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [viewing, setViewing] = useState<number | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("stories")
      .select("*, author:profiles!stories_author_id_fkey(username,display_name,avatar_url,accent_color)")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    setStories((data ?? []) as any);
  };

  useEffect(() => { load(); }, []);

  // group by author, latest first
  const grouped = Array.from(
    stories.reduce((m, s) => {
      const k = s.author_id;
      if (!m.has(k)) m.set(k, [] as Story[]);
      m.get(k)!.push(s);
      return m;
    }, new Map<string, Story[]>()).values()
  );

  return (
    <>
      <div className="mb-5 -mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-3">
          {/* Add story */}
          <button
            onClick={() => setComposerOpen(true)}
            className="flex flex-col items-center gap-1.5 shrink-0"
          >
            <div className="relative h-16 w-16 rounded-full bg-gradient-primary p-[2px] shadow-glow">
              <div className="h-full w-full rounded-full bg-background flex items-center justify-center">
                <Plus className="h-6 w-6" />
              </div>
            </div>
            <span className="text-[10px] font-medium text-muted-foreground">Your story</span>
          </button>

          {grouped.map((group, idx) => {
            const s = group[0];
            const accent = s.author?.accent_color || "var(--rizz-pink)";
            return (
              <button
                key={s.author_id}
                onClick={() => setViewing(idx)}
                className="flex flex-col items-center gap-1.5 shrink-0"
              >
                <div className="relative h-16 w-16 rounded-full p-[2px]" style={{ background: `conic-gradient(from 0deg, ${accent}, var(--rizz-violet), ${accent})` }}>
                  <Avatar className="h-full w-full ring-2 ring-background">
                    <AvatarImage src={s.author?.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-gradient-primary text-xs font-bold">
                      {(s.author?.username ?? "?").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <span className="text-[10px] font-medium truncate max-w-[64px]">
                  @{s.author?.username ?? "?"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {viewing !== null && grouped[viewing] && (
          <StoryViewer
            group={grouped[viewing]}
            onClose={() => setViewing(null)}
            onNext={() => setViewing(viewing + 1 < grouped.length ? viewing + 1 : null)}
            onPrev={() => setViewing(viewing - 1 >= 0 ? viewing - 1 : null)}
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

function StoryViewer({ group, onClose, onNext, onPrev }: { group: Story[]; onClose: () => void; onNext: () => void; onPrev: () => void }) {
  const [idx, setIdx] = useState(0);
  const story = group[idx];
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [replyBody, setReplyBody] = useState("");
  const [replying, setReplying] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const remainingMs = useRef(5000);
  const timerStartedAt = useRef(0);
  const reactionKey = ["story-reactions", user?.id, story?.id] as const;
  const quickReactions = ["🔥", "😂", "😮", "😢", "👏"];

  const reactions = useQuery({
    queryKey: reactionKey,
    enabled: !!user && !!story,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("story_reactions")
        .select("emoji")
        .eq("story_id", story.id)
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((row: { emoji: string }) => row.emoji) as string[];
    },
  });
  const toggleReaction = useMutation({
    mutationFn: async ({ storyId, emoji }: { storyId: string; emoji: string }) => {
      if (!user) throw new Error("Sign in to react to stories");
      const key = ["story-reactions", user.id, storyId] as const;
      const selected = (queryClient.getQueryData<string[]>(key) ?? []).includes(emoji);
      const query = (supabase.from as any)("story_reactions");
      const result = selected
        ? await query.delete().eq("story_id", storyId).eq("user_id", user.id).eq("emoji", emoji)
        : await query.insert({ story_id: storyId, user_id: user.id, emoji });
      if (result.error) throw result.error;
    },
    onMutate: async ({ storyId, emoji }) => {
      const key = ["story-reactions", user?.id, storyId] as const;
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<string[]>(key) ?? [];
      queryClient.setQueryData<string[]>(
        key,
        previous.includes(emoji) ? previous.filter((item) => item !== emoji) : [...previous, emoji],
      );
      return { key, previous };
    },
    onError: (error, _variables, context) => {
      if (context) queryClient.setQueryData(context.key, context.previous);
      toast.error(error.message);
    },
    onSettled: (_data, _error, variables) =>
      queryClient.invalidateQueries({ queryKey: ["story-reactions", user?.id, variables.storyId] }),
  });
  const myReactions = reactions.data ?? [];
  const reactToStory = (emoji: string) => {
    if (story) toggleReaction.mutate({ storyId: story.id, emoji });
  };

  const viewers = useQuery({
    queryKey: ["story-viewers", story?.id],
    enabled: !!user && user.id === story?.author_id && viewersOpen && !!story,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("story_views")
        .select("viewer_id, viewed_at")
        .eq("story_id", story!.id)
        .order("viewed_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const byViewer = new Map<string, (typeof rows)[number]>();
      for (const row of rows) {
        if (!byViewer.has(row.viewer_id)) byViewer.set(row.viewer_id, row);
      }
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
    if (story.author_id === user.id) return toast.info("You can’t reply to your own story.");
    setReplying(true);
    try {
      const { error } = await supabase.from("direct_messages").insert({
        sender_id: user.id,
        recipient_id: story.author_id,
        body: text,
        story_id: story.id,
      });
      if (error) throw error;
      setReplyBody("");
      toast.success("Reply sent in chat");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't send your story reply");
    } finally {
      setReplying(false);
    }
  };

  useEffect(() => {
    remainingMs.current = 5000;
  }, [idx, story?.id]);

  useEffect(() => {
    if (paused) return;
    if (user && story) {
      supabase.from("story_views").insert({ story_id: story.id, viewer_id: user.id }).then(() => {});
    }
    const t = setTimeout(() => {
      if (idx + 1 < group.length) setIdx(idx + 1);
      else onNext();
    }, remainingMs.current);
    timerStartedAt.current = Date.now();
    return () => {
      clearTimeout(t);
      remainingMs.current = Math.max(0, remainingMs.current - (Date.now() - timerStartedAt.current));
    };
  }, [idx, story, user, group.length, onNext, paused]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/95"
      onClick={onClose}
    >
      <div
        className="relative z-10 flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-[#090710] shadow-[0_24px_80px_-28px_rgba(0,0,0,0.9)] sm:h-[min(92dvh,800px)] sm:rounded-3xl sm:border sm:border-white/10"
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="absolute left-4 right-4 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] z-30 flex gap-1">
          {group.map((_, i) => (
            <div key={i} className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
              <div
                className={`h-full bg-white transition-all ${i < idx ? "w-full" : i === idx ? "w-full animate-[progress_5s_linear]" : "w-0"}`}
                style={{ animationPlayState: paused ? "paused" : "running" }}
              />
            </div>
          ))}
        </div>
        <button
          onClick={onClose}
          aria-label="Close story"
          className="absolute right-3 top-[calc(env(safe-area-inset-top,0px)+1.75rem)] z-30 grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-black/55 text-white backdrop-blur-md transition hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="absolute left-3 top-[calc(env(safe-area-inset-top,0px)+1.75rem)] z-30 flex items-center gap-2 rounded-full bg-black/45 px-2 py-1.5 backdrop-blur-md">
          <Avatar className="h-7 w-7 ring-1 ring-white/35">
            <AvatarImage src={story.author?.avatar_url ?? undefined} />
            <AvatarFallback>{(story.author?.username ?? "?").charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="max-w-36 truncate text-xs font-semibold">@{story.author?.username}</span>
        </div>
        {user?.id === story.author_id && (
          <button
            type="button"
            onClick={() => setViewersOpen(true)}
            aria-label="See story viewers"
            className="absolute right-14 top-[calc(env(safe-area-inset-top,0px)+1.75rem)] z-30 inline-flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-black/55 px-3 text-xs text-white backdrop-blur-md"
          >
            <Eye className="h-4 w-4" /> Viewers
          </button>
        )}

        <div
          className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black/65 pt-10"
          onPointerDown={(event) => {
            if ((event.target as HTMLElement).closest("button")) return;
            pressStart.current = { x: event.clientX, y: event.clientY };
            setPaused(true);
          }}
          onPointerUp={(event) => {
            const start = pressStart.current;
            pressStart.current = null;
            if (start) {
              const dx = event.clientX - start.x;
              const dy = event.clientY - start.y;
              if (dy > 90) onClose();
              else if (dx < -90) {
                if (idx + 1 < group.length) setIdx(idx + 1);
                else onNext();
              } else if (dx > 90) {
                if (idx > 0) setIdx(idx - 1);
                else onPrev();
              }
            }
            setPaused(false);
          }}
          onPointerCancel={() => { pressStart.current = null; setPaused(false); }}
        >
          {story.media_type === "video" ? (
            <video src={story.media_url} autoPlay playsInline className="h-full max-h-full max-w-full object-contain" />
          ) : (
            <img src={story.media_url} alt={story.caption ?? ""} className="h-full max-h-full w-full object-cover" />
          )}
          <button
            aria-label="Previous story"
            className="absolute left-0 top-16 z-20 h-[calc(100%-4rem)] w-[12%] cursor-w-resize"
            onClick={(event) => { event.stopPropagation(); if (idx > 0) setIdx(idx - 1); else onPrev(); }}
          />
          <button
            aria-label="Next story"
            className="absolute right-0 top-16 z-20 h-[calc(100%-4rem)] w-[12%] cursor-e-resize"
            onClick={(event) => { event.stopPropagation(); if (idx + 1 < group.length) setIdx(idx + 1); else onNext(); }}
          />
        </div>
        {story.caption && (
          <p className="max-h-20 overflow-y-auto border-t border-white/[0.06] px-4 py-2.5 text-center text-sm leading-snug text-white/90">
            {story.caption}
          </p>
        )}
        <div className="flex min-h-[62px] items-center gap-2 border-t border-white/10 bg-white/[0.025] px-3 py-2">
          <button
            type="button"
            aria-label={myReactions.includes("❤️") ? "Remove like" : "Like story"}
            aria-pressed={myReactions.includes("❤️")}
            disabled={!user || reactions.isLoading || toggleReaction.isPending}
            onClick={() => reactToStory("❤️")}
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition ${
              myReactions.includes("❤️")
                ? "border-[var(--rizz-pink)]/45 bg-[var(--rizz-pink)]/15 text-[var(--rizz-pink)]"
                : "border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/10"
            }`}
          >
            <Heart className={`h-5 w-5 ${myReactions.includes("❤️") ? "fill-current" : ""}`} />
          </button>
          <span className="mr-1 text-[10px] font-medium uppercase tracking-[0.12em] text-white/45">React</span>
          <div className="flex min-w-0 flex-1 justify-between gap-1">
            {quickReactions.map((emoji) => {
              const selected = myReactions.includes(emoji);
              return (
                <button
                  key={emoji}
                  type="button"
                  aria-label={`React with ${emoji}`}
                  aria-pressed={selected}
                  disabled={!user || reactions.isLoading || toggleReaction.isPending}
                  onClick={() => reactToStory(emoji)}
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border text-lg transition ${
                    selected
                      ? "border-[var(--rizz-violet)]/55 bg-[var(--rizz-violet)]/20"
                      : "border-transparent hover:border-white/10 hover:bg-white/[0.07]"
                  }`}
                >
                  {emoji}
                </button>
              );
            })}
          </div>
        </div>
        {user && user.id !== story.author_id && (
          <form onSubmit={sendStoryReply} className="flex items-center gap-2 border-t border-white/10 bg-white/[0.025] px-3 py-2">
            <Input
              value={replyBody}
              onChange={(event) => setReplyBody(event.target.value)}
              maxLength={2000}
              aria-label="Reply to story"
              placeholder="Reply in chat…"
              className="h-10 min-w-0 border-white/10 bg-black/20"
            />
            <Button type="submit" disabled={!replyBody.trim() || replying} size="icon" aria-label="Send story reply" className="shrink-0 bg-gradient-primary">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        )}
      </div>
      <Dialog open={viewersOpen} onOpenChange={setViewersOpen}>
        <DialogContent className="glass-strong border-white/10">
          <DialogTitle>Story viewers</DialogTitle>
          {viewers.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading viewers…</p>
          ) : viewers.isError ? (
            <p className="text-sm text-muted-foreground">Viewer details aren’t available right now.</p>
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
    </motion.div>
  );
}
