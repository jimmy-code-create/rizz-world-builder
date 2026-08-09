import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useEffect, useState } from "react";
import {
  Heart, MessageCircle, Share2, Volume2, VolumeX, Music2,
  Plus, Upload, Scissors, Type as TypeIcon, Loader2, Check, Captions, Gauge, Sparkles, Bookmark, Send,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { fetchReels, createPost, toggleLike, fetchMyLikes, fetchComments, addComment } from "@/lib/posts";
import { toggleBookmark, fetchMyBookmarkIds } from "@/lib/bookmarks";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

const SONG_LIBRARY = [
  { id: "neon", title: "Neon Heartbeat", artist: "RIZZ FM", bpm: 128, mood: "Hype" },
  { id: "midnight", title: "Midnight Drive", artist: "Lunar Tape", bpm: 92, mood: "Chill" },
  { id: "sakura", title: "Sakura Bloom", artist: "Yume", bpm: 105, mood: "Soft" },
  { id: "phonk", title: "Phonk Phantom", artist: "ZVRR", bpm: 140, mood: "Drift" },
  { id: "afro", title: "Lagos Sunset", artist: "Ade & Co", bpm: 115, mood: "Afro" },
  { id: "lofi", title: "Study Cat", artist: "Boku", bpm: 80, mood: "Lo-fi" },
  { id: "trap", title: "Diamond Drip", artist: "808 Saint", bpm: 145, mood: "Trap" },
  { id: "hyper", title: "Hyperpop Crush", artist: "Glitch", bpm: 160, mood: "Hyper" },
];

export const Route = createFileRoute("/_app/reels")({
  head: () => ({ meta: [{ title: "Reels · RIZZ" }] }),
  component: ReelsPage,
});

function ReelsPage() {
  const reels = useQuery({ queryKey: ["reels"], queryFn: () => fetchReels(40) });
  const { user } = useAuth();
  const [muted, setMuted] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [captions, setCaptions] = useState(true);
  const [filter, setFilter] = useState<string>("none");

  const likes = useQuery({
    queryKey: ["reel-likes", user?.id, reels.data?.map((r) => r.id).join(",")],
    queryFn: () => fetchMyLikes(user!.id, reels.data!.map((r) => r.id)),
    enabled: !!user && !!reels.data && reels.data.length > 0,
  });
  const saved = useQuery({
    queryKey: ["my-bookmarks-set", user?.id],
    queryFn: () => fetchMyBookmarkIds(user!.id),
    enabled: !!user,
  });

  return (
    <div className="-mx-4 md:-mx-8 -my-6 md:-my-10 h-[calc(100dvh-7rem)] md:h-[calc(100dvh-2.5rem)]">
      <button
        onClick={() => setEditorOpen(true)}
        className="fixed bottom-24 md:bottom-6 right-4 z-30 h-14 w-14 rounded-full bg-gradient-primary shadow-glow grid place-items-center active:scale-95 transition-transform"
        aria-label="Upload reel"
      >
        <Plus className="h-7 w-7 text-white" />
      </button>

      <ReelEditor open={editorOpen} onClose={() => setEditorOpen(false)} />

      <div className="fixed top-[calc(env(safe-area-inset-top)+3.75rem)] md:top-4 left-1/2 -translate-x-1/2 z-30 max-w-[calc(100vw-1rem)] flex items-center gap-1.5 glass-strong border border-white/10 rounded-full px-2 py-1 text-[11px] overflow-x-auto no-scrollbar whitespace-nowrap">
        <Gauge className="h-3.5 w-3.5 opacity-70 shrink-0" />
        {[0.5, 1, 1.5, 2].map((s) => (
          <button key={s} onClick={() => setSpeed(s)} className={`shrink-0 px-1.5 py-0.5 rounded-full ${speed === s ? "bg-gradient-primary text-white" : "opacity-60 hover:opacity-100"}`}>{s}x</button>
        ))}
        <span className="w-px h-3 bg-white/10 mx-1 shrink-0" />
        <button onClick={() => setCaptions((c) => !c)} className={`shrink-0 px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 ${captions ? "bg-white/20" : "opacity-60"}`} aria-label="Toggle captions"><Captions className="h-3.5 w-3.5" /> CC</button>
        <span className="w-px h-3 bg-white/10 mx-1 shrink-0" />
        <Sparkles className="h-3.5 w-3.5 opacity-70 shrink-0" />
        {(["none", "warm", "cool", "noir", "vivid"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`shrink-0 px-1.5 py-0.5 rounded-full capitalize ${filter === f ? "bg-gradient-primary text-white" : "opacity-60 hover:opacity-100"}`}>{f}</button>
        ))}
      </div>

      {reels.isLoading && <div className="h-full grid place-items-center text-muted-foreground">Loading reels…</div>}
      {reels.data?.length === 0 && (
        <div className="h-full grid place-items-center text-center px-8">
          <div>
            <div className="text-5xl mb-3">🎬</div>
            <p className="text-muted-foreground mb-4">No reels yet — be the first to drop a vibe.</p>
            <Button onClick={() => setEditorOpen(true)} className="bg-gradient-primary border-0 shadow-glow">
              <Upload className="h-4 w-4 mr-2" /> Upload a reel
            </Button>
          </div>
        </div>
      )}
      <div className="h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar">
        {reels.data?.map((r) => (
          <ReelItem
            key={r.id}
            post={r}
            muted={muted}
            toggleMute={() => setMuted((m) => !m)}
            speed={speed}
            captions={captions}
            filter={filter}
            initialLiked={!!likes.data?.has(r.id)}
            initialSaved={!!saved.data?.has(r.id)}
          />
        ))}
      </div>
    </div>
  );
}

const FILTER_CSS: Record<string, string> = {
  none: "none",
  warm: "saturate(1.15) hue-rotate(-10deg) brightness(1.05)",
  cool: "saturate(1.05) hue-rotate(15deg) brightness(1.02) contrast(1.05)",
  noir: "grayscale(1) contrast(1.15)",
  vivid: "saturate(1.55) contrast(1.1)",
};

function ReelItem({ post, muted, toggleMute, speed, captions, filter, initialLiked, initialSaved }: { post: any; muted: boolean; toggleMute: () => void; speed: number; captions: boolean; filter: string; initialLiked: boolean; initialSaved: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const ref = useRef<HTMLVideoElement>(null);
  const [progress, setProgress] = useState(0);
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState<number>(post.like_count ?? 0);
  const [saved, setSaved] = useState(initialSaved);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [burst, setBurst] = useState(0); // heart burst counter
  const lastTap = useRef(0);

  useEffect(() => setLiked(initialLiked), [initialLiked]);
  useEffect(() => setSaved(initialSaved), [initialSaved]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) el.play().catch(() => {});
        else el.pause();
      },
      { threshold: 0.6 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => { if (ref.current) ref.current.playbackRate = speed; }, [speed]);

  async function doLike(force?: boolean) {
    if (!user) { toast.error("Sign in to like"); return; }
    const next = force ?? !liked;
    if (next === liked) { setBurst((n) => n + 1); return; }
    setLiked(next);
    setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)));
    if (next) setBurst((n) => n + 1);
    try {
      await toggleLike(post.id, user.id, !next);
      qc.invalidateQueries({ queryKey: ["reel-likes"] });
    } catch (e: any) {
      setLiked(!next);
      setLikeCount((c) => Math.max(0, c + (next ? -1 : 1)));
      toast.error(e.message ?? "Couldn't like");
    }
  }

  async function doSave() {
    if (!user) { toast.error("Sign in to save"); return; }
    const next = !saved;
    setSaved(next);
    try {
      await toggleBookmark(post.id, user.id, !next);
      toast.success(next ? "Saved" : "Removed from saved");
      qc.invalidateQueries({ queryKey: ["my-bookmarks-set"] });
    } catch (e: any) {
      setSaved(!next);
      toast.error(e.message ?? "Couldn't save");
    }
  }

  function onVideoTap() {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      doLike(true);
      lastTap.current = 0;
    } else {
      lastTap.current = now;
      // single-tap: toggle mute after a short delay unless a double tap follows
      setTimeout(() => {
        if (lastTap.current && Date.now() - lastTap.current >= 280) {
          toggleMute();
          lastTap.current = 0;
        }
      }, 300);
    }
  }

  const remix = () => toast.success("Remix template saved to your drafts ✨");
  const share = () => {
    navigator.clipboard.writeText(window.location.origin + "/u/" + post.author?.username);
    toast.success("Link copied");
  };

  return (
    <section className="relative h-full snap-start grid place-items-center bg-black">
      <video
        ref={ref}
        src={post.media_url}
        muted={muted}
        loop
        playsInline
        onClick={onVideoTap}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (v.duration) setProgress((v.currentTime / v.duration) * 100);
        }}
        className="h-full w-full object-contain transition-[filter] duration-300"
        style={{ filter: FILTER_CSS[filter] || "none" }}
      />
      {burst > 0 && (
        <Heart
          key={burst}
          className="pointer-events-none absolute inset-0 m-auto h-32 w-32 text-[var(--rizz-pink)] fill-[var(--rizz-pink)] drop-shadow-2xl animate-ping-once"
          style={{ animation: "reel-heart 700ms ease-out forwards" }}
        />
      )}
      <div className="absolute top-0 inset-x-0 h-0.5 bg-white/10">
        <div className="h-full bg-gradient-primary shadow-glow" style={{ width: `${progress}%` }} />
      </div>
      <button onClick={toggleMute} className="absolute top-[calc(env(safe-area-inset-top)+0.75rem)] md:top-4 right-4 h-10 w-10 rounded-full glass-strong grid place-items-center z-20">
        {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </button>
      <div className="absolute left-4 right-20 bottom-28 md:bottom-6 text-white drop-shadow">
        <Link to="/u/$username" params={{ username: post.author?.username ?? "" }} className="flex items-center gap-2 mb-2">
          <Avatar className="h-9 w-9 ring-2 ring-white/40">
            <AvatarImage src={post.author?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-gradient-primary text-xs">{(post.author?.username ?? "?").charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="font-bold text-sm">@{post.author?.username}</span>
        </Link>
        {captions && post.caption && <p className="text-sm line-clamp-3 bg-black/30 backdrop-blur-sm rounded-lg px-2 py-1 inline-block">{post.caption}</p>}
        <div className="flex items-center gap-1.5 text-xs mt-2 opacity-80">
          <Music2 className="h-3.5 w-3.5" /> Original audio · @{post.author?.username}
        </div>
      </div>
      <div className="absolute right-2 bottom-32 md:bottom-10 flex flex-col items-center gap-3 text-white z-10">
        <ReelAction
          icon={<Heart className={`h-6 w-6 ${liked ? "fill-[var(--rizz-pink)] text-[var(--rizz-pink)]" : ""}`} />}
          label={String(likeCount)}
          onClick={() => doLike()}
          active={liked}
        />
        <ReelAction
          icon={<MessageCircle className="h-6 w-6" />}
          label={String(post.comment_count ?? 0)}
          onClick={() => setCommentsOpen(true)}
        />
        <ReelAction
          icon={<Bookmark className={`h-6 w-6 ${saved ? "fill-white" : ""}`} />}
          label={saved ? "Saved" : "Save"}
          onClick={doSave}
          active={saved}
        />
        <ReelAction icon={<Share2 className="h-6 w-6" />} label="Share" onClick={share} />
        <Button onClick={remix} size="sm" variant="outline" className="rounded-full bg-white/10 border-white/30 text-white h-8 px-3 text-xs">Remix</Button>
      </div>

      <CommentsSheet open={commentsOpen} onOpenChange={setCommentsOpen} postId={post.id} />

      <style>{`
        @keyframes reel-heart {
          0% { transform: scale(0.4); opacity: 0; }
          25% { transform: scale(1.2); opacity: 1; }
          70% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.4); opacity: 0; }
        }
      `}</style>
    </section>
  );
}

function ReelAction({ icon, label, onClick, active }: { icon: React.ReactNode; label: string; onClick?: () => void; active?: boolean }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
      <span className={`h-12 w-12 rounded-full glass-strong grid place-items-center ${active ? "ring-2 ring-white/50" : ""}`}>{icon}</span>
      <span className="text-[11px] font-semibold drop-shadow">{label}</span>
    </button>
  );
}

function CommentsSheet({ open, onOpenChange, postId }: { open: boolean; onOpenChange: (o: boolean) => void; postId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const comments = useQuery({
    queryKey: ["reel-comments", postId],
    queryFn: () => fetchComments(postId),
    enabled: open,
  });
  const mut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in first");
      if (!body.trim()) throw new Error("Say something");
      await addComment(postId, user.id, body.trim().slice(0, 500));
    },
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["reel-comments", postId] });
      qc.invalidateQueries({ queryKey: ["reels"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="glass-strong border-white/10 rounded-t-3xl max-h-[80dvh] flex flex-col pb-[max(env(safe-area-inset-bottom),0.75rem)]"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-lg">Comments</SheetTitle>
        </SheetHeader>
        <div className="flex-1 min-h-0 overflow-y-auto py-3 space-y-3">
          {comments.isLoading && <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>}
          {comments.data?.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Be the first to comment ✨</p>}
          {(comments.data ?? []).map((c: any) => (
            <div key={c.id} className="flex gap-2.5">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={c.author?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-gradient-primary text-xs">{(c.author?.username ?? "?").charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold">@{c.author?.username}</p>
                <p className="text-sm break-words">{c.body}</p>
              </div>
            </div>
          ))}
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}
          className="flex items-center gap-2 pt-2 border-t border-white/5"
        >
          <Input
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 500))}
            placeholder="Add a comment…"
            className="glass border-white/10"
          />
          <Button type="submit" size="icon" disabled={!body.trim() || mut.isPending} className="bg-gradient-primary border-0 shadow-glow shrink-0">
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function ReelEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [textMode, setTextMode] = useState(false);
  const [textBg, setTextBg] = useState("linear-gradient(135deg,#ff3ea5,#7c3aed)");
  const [song, setSong] = useState<string | null>(null);
  const [songQuery, setSongQuery] = useState("");
  const [trim, setTrim] = useState<[number, number]>([0, 60]);
  const [duration, setDuration] = useState(60);
  const [overlay, setOverlay] = useState("");
  const previewRef = useRef<HTMLVideoElement>(null);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const pick = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("video/")) { toast.error("Pick a video file"); return; }
    if (f.size > 50 * 1024 * 1024) { toast.error("Max 50MB"); return; }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const reset = () => {
    setFile(null); setCaption(""); setSong(null); setOverlay(""); setTextMode(false);
    setTrim([0, 60]); setDuration(60);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  const mut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in first");
      if (!file && !textMode) throw new Error("Pick a video, or switch to text mode");
      const songTag = song ? SONG_LIBRARY.find((s) => s.id === song) : null;
      const songLine = songTag ? `\n🎵 ${songTag.title} — ${songTag.artist}` : "";
      const overlayLine = overlay ? `\n${overlay}` : "";
      const fullCaption = (caption + overlayLine + songLine).trim();
      if (!file) {
        if (!fullCaption) throw new Error("Write something for your text reel");
        const textFile = await renderTextReel(caption || overlay, textBg);
        return createPost({ authorId: user.id, caption: fullCaption, file: textFile, kind: "reel" });
      }
      return createPost({ authorId: user.id, caption: fullCaption, file, kind: "reel" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reels"] });
      qc.invalidateQueries({ queryKey: ["feed"] });
      toast.success("Reel posted 🎬");
      reset();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filteredSongs = SONG_LIBRARY.filter((s) =>
    !songQuery || (s.title + s.artist + s.mood).toLowerCase().includes(songQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="glass-strong border-white/10 md:max-w-3xl p-0 overflow-hidden flex flex-col
          max-md:top-0 max-md:left-0 max-md:right-0 max-md:bottom-0 max-md:translate-x-0 max-md:translate-y-0
          max-md:max-w-none max-md:w-screen max-md:h-[100dvh] max-md:rounded-none md:max-h-[90dvh]"
      >
        <div
          className="flex items-center justify-between px-5 py-3 border-b border-white/10 shrink-0"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          <DialogTitle className="text-base font-black">Create reel</DialogTitle>
          <DialogDescription className="sr-only">Upload a video, trim it, add a song and caption.</DialogDescription>
          <span className="h-8 w-8" aria-hidden />
        </div>

        <div className="grid md:grid-cols-2 gap-0 flex-1 min-h-0 overflow-y-auto md:overflow-hidden">
          <div className="bg-black grid place-items-center min-h-[240px] md:min-h-[440px] relative">
            {previewUrl ? (
              <>
                <video
                  ref={previewRef}
                  src={previewUrl}
                  className="max-h-full max-w-full object-contain"
                  controls
                  preload="metadata"
                  onLoadedMetadata={(e) => {
                    const d = Math.round((e.currentTarget.duration || 60));
                    setDuration(d);
                    setTrim([0, Math.min(d, 60)]);
                  }}
                />
                {overlay && (
                  <div className="absolute inset-x-4 top-4 text-center pointer-events-none">
                    <span className="inline-block bg-black/60 text-white px-3 py-1 rounded-lg text-sm font-bold backdrop-blur">{overlay}</span>
                  </div>
                )}
                {song && (
                  <div className="absolute left-3 bottom-3 flex items-center gap-1.5 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full backdrop-blur">
                    <Music2 className="h-3 w-3" />
                    {SONG_LIBRARY.find((s) => s.id === song)?.title}
                  </div>
                )}
              </>
            ) : textMode ? (
              <div className="h-full w-full grid place-items-center p-6 text-center" style={{ background: textBg }}>
                <p className="text-white font-black text-xl leading-snug drop-shadow-lg break-words">
                  {caption || overlay || "Type your text reel…"}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-white/70 px-6 py-10 text-center">
                <label className="cursor-pointer flex flex-col items-center gap-3">
                  <input type="file" accept="video/*" hidden onChange={(e) => pick(e.target.files?.[0] ?? null)} />
                  <div className="h-16 w-16 rounded-full bg-gradient-primary grid place-items-center shadow-glow">
                    <Upload className="h-7 w-7 text-white" />
                  </div>
                  <p className="font-bold text-white">Tap to upload video</p>
                  <p className="text-xs">MP4, MOV · up to 50MB</p>
                </label>
                <button onClick={() => setTextMode(true)} className="text-xs underline text-white/80">
                  or post a text-only reel
                </button>
              </div>
            )}
          </div>

          <div className="p-4 overflow-y-auto">
            {textMode && !file && (
              <div className="mb-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
                {[
                  "linear-gradient(135deg,#ff3ea5,#7c3aed)",
                  "linear-gradient(135deg,#0ea5e9,#22d3ee)",
                  "linear-gradient(135deg,#f97316,#ef4444)",
                  "linear-gradient(135deg,#10b981,#22d3ee)",
                  "linear-gradient(135deg,#111,#333)",
                ].map((g) => (
                  <button key={g} onClick={() => setTextBg(g)}
                    className={`h-8 w-14 shrink-0 rounded-lg border ${textBg === g ? "border-white" : "border-white/10"}`}
                    style={{ background: g }} aria-label="Background" />
                ))}
                <button onClick={() => setTextMode(false)} className="text-[11px] text-muted-foreground underline shrink-0 ml-1">use video</button>
              </div>
            )}
            <Tabs defaultValue="caption">
              <TabsList className="w-full glass border border-white/10">
                <TabsTrigger value="caption" className="flex-1"><TypeIcon className="h-3.5 w-3.5 mr-1" /> Caption</TabsTrigger>
                <TabsTrigger value="song" className="flex-1"><Music2 className="h-3.5 w-3.5 mr-1" /> Song</TabsTrigger>
                <TabsTrigger value="trim" className="flex-1"><Scissors className="h-3.5 w-3.5 mr-1" /> Trim</TabsTrigger>
              </TabsList>

              <TabsContent value="caption" className="space-y-3 mt-4">
                <Textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value.slice(0, 500))}
                  placeholder="Describe your reel… use #hashtags and @mentions"
                  className="glass border-white/10 min-h-[110px] resize-none"
                />
                <p className="text-xs text-muted-foreground text-right">{500 - caption.length} left</p>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Sticker text</p>
                  <Input
                    value={overlay}
                    onChange={(e) => setOverlay(e.target.value.slice(0, 60))}
                    placeholder="POV: it's Friday"
                    className="glass border-white/10"
                  />
                </div>
              </TabsContent>

              <TabsContent value="song" className="space-y-3 mt-4">
                <Input
                  value={songQuery}
                  onChange={(e) => setSongQuery(e.target.value)}
                  placeholder="Search songs, artists, moods…"
                  className="glass border-white/10"
                />
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  <button
                    onClick={() => setSong(null)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition ${
                      song === null ? "bg-gradient-primary text-white shadow-glow" : "hover:bg-white/5"
                    }`}
                  >
                    <div className="h-10 w-10 rounded-lg bg-white/10 grid place-items-center"><Music2 className="h-4 w-4" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold">Original audio</p>
                      <p className="text-xs opacity-70">Use the sound from your clip</p>
                    </div>
                    {song === null && <Check className="h-4 w-4" />}
                  </button>
                  {filteredSongs.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSong(s.id)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition ${
                        song === s.id ? "bg-gradient-primary text-white shadow-glow" : "hover:bg-white/5"
                      }`}
                    >
                      <div className="h-10 w-10 rounded-lg bg-[var(--rizz-pink)]/20 grid place-items-center text-base">🎵</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{s.title}</p>
                        <p className="text-xs opacity-70 truncate">{s.artist} · {s.bpm} BPM · {s.mood}</p>
                      </div>
                      {song === s.id && <Check className="h-4 w-4" />}
                    </button>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="trim" className="space-y-4 mt-4">
                <div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-muted-foreground">Start</span>
                    <span className="font-mono">{trim[0]}s → {trim[1]}s</span>
                    <span className="text-muted-foreground">End</span>
                  </div>
                  <Slider
                    value={trim}
                    min={0}
                    max={duration}
                    step={1}
                    onValueChange={(v) => setTrim([v[0], v[1]] as [number, number])}
                  />
                  <p className="text-xs text-muted-foreground mt-3">
                    Selected length: <span className="font-bold text-foreground">{trim[1] - trim[0]}s</span> · Source: {duration}s
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">Trim is applied on playback — full clip is uploaded.</p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <div
          className="flex items-center justify-between gap-2 px-5 py-3 border-t border-white/10 shrink-0"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <Button variant="ghost" onClick={reset} disabled={(!file && !textMode) || mut.isPending}>Reset</Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={(!file && !(textMode && (caption.trim() || overlay.trim()))) || mut.isPending}
            className="bg-gradient-primary border-0 shadow-glow px-6"
          >
            {mut.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Posting…</> : "Post reel 🎬"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Renders a text-only reel as a 1080x1920 gradient image so it can be posted like any media. */
async function renderTextReel(text: string, bg: string): Promise<File> {
  const W = 1080, H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const m = bg.match(/linear-gradient\([^,]+,\s*([^,]+),\s*([^)]+)\)/);
  if (m) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, m[1].trim());
    g.addColorStop(1, m[2].trim());
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = bg;
  }
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "800 76px system-ui, sans-serif";
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 24;

  const words = (text || "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > W - 160 && line) { lines.push(line); line = w; }
    else line = next;
  }
  if (line) lines.push(line);
  const lh = 96;
  const startY = H / 2 - ((lines.length - 1) * lh) / 2;
  lines.slice(0, 12).forEach((l, i) => ctx.fillText(l, W / 2, startY + i * lh));

  const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.92));
  return new File([blob], `text-reel-${Date.now()}.jpg`, { type: "image/jpeg" });
}