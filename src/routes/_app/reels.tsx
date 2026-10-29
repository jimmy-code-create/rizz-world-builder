import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "framer-motion";
import {
  Heart, MessageCircle, Share2, Volume2, VolumeX, Music2, Pause, Play, ExternalLink,
  Plus, Upload, Link2, Scissors, Type as TypeIcon, Loader2, Check, Captions, Gauge, Palette, Bookmark, MoreVertical, Users,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ProfilePreviewTrigger } from "@/components/ProfilePreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GifContent } from "@/components/GifContent";
import { renderGifSegments } from "@/lib/gif-content";
import { ShareToChatSheet } from "@/components/share/ShareToChatSheet";
import { shareDraftForPost } from "@/lib/share-to-chat";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CloseButton } from "@/components/ui/close-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { fetchReels, createPost, toggleLike, fetchMyLikes } from "@/lib/posts";
import { CommentSection } from "@/components/comments/CommentSection";
import { REEL_COMMENT_MAX_LENGTH } from "@/lib/comment-thread";
import { toggleBookmark, fetchMyBookmarkIds } from "@/lib/bookmarks";
import { useAuth } from "@/lib/auth";
import { toast } from "@/lib/toast";
import { ExternalVideoEmbed } from "@/components/ExternalVideoEmbed";
import { VerifiedCreatorTag } from "@/components/VerifiedCreatorTag";
import { parseExternalReelLink } from "@/lib/external-reels";
import { renderCaptionWithTags } from "@/lib/hashtags";
import { formatCount } from "@/lib/utils";
import { ReelPartySheet } from "@/components/reels/ReelPartySheet";
import {
  normalizeReelPartyCode,
  reelPartyInviteUrl,
  useReelParty,
  type ReelPartySnapshot,
  type ReelPartySync,
} from "@/lib/reel-party";

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

const REEL_LIKE_EFFECTS = [
  "2319-whitebouncingcat.gif",
  "6770-pastelpinkbouncingkitty.gif",
  "8710-bluebouncingcat.gif",
  "2322-hellokittybounce.gif",
  "2870-bear-heartbounce.gif",
  "7770-catbounce.gif",
  "4478-hellokittypogostick.gif",
  "1326-pinkbouncingcat.gif",
  "4810-bounce-heart.gif",
  "5509_ablobcongarollbounce.gif",
  "2607_kirby_bounce.gif",
  "4964-trolltv-bounce.gif",
  "7918-twitchstreaming.gif",
  "3456-yellowbouncingcat.gif",
  "1394-pichubounce.gif",
  "2720-jumping-kitty.gif",
  "5046_bounce_pink.gif",
  "3339-mymelodybounce.gif",
  "5996-pastelbluebouncybunny.gif",
  "4744-witch.gif",
  "6146-lightpinkbouncingcat.gif",
  "7494_bounce_blue.gif",
  "8368-peachandmochiok.gif",
  "6842-orangebouncingcat.gif",
  "4393-bearbounce.gif",
  "3017-nookbounce.gif",
  "6770-pinkbouncybun.gif",
  "8188-bread-bounce.gif",
  "4880-treepupbounce.gif",
  "8847-blobcat-bounce.gif",
];

export const Route = createFileRoute("/_app/reels")({
  head: () => ({ meta: [{ title: "Reels · RIZZ" }] }),
  validateSearch: (search: Record<string, unknown>): { party?: string } => ({
    party: typeof search.party === "string" ? search.party : undefined,
  }),
  component: ReelsPage,
});

function ReelsPage() {
  const reels = useQuery({ queryKey: ["reels"], queryFn: () => fetchReels(40) });
  const { user, profile } = useAuth();
  const navigate = Route.useNavigate();
  const { party: partyParam } = Route.useSearch();
  const [muted, setMuted] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [partyOpen, setPartyOpen] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [captions, setCaptions] = useState(true);
  const [filter, setFilter] = useState<string>("none");
  const [autoplay, setAutoplay] = useState(true);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const activeIndexRef = useRef(-1);
  activeIndexRef.current = activeIndex;
  const partySyncTimers = useRef<number[]>([]);
  const autoJoinedParty = useRef(false);
  const invitePrompted = useRef(false);

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

  const readPartySnapshot = useCallback((): ReelPartySnapshot | null => {
    const scroller = scrollerRef.current;
    const index = activeIndexRef.current;
    if (!scroller || index < 0) return null;
    const video = scroller.querySelector<HTMLVideoElement>(
      `[data-reel-index="${index}"] video`,
    );
    // External (YouTube) reels have no <video> to seek, but the room should
    // still follow the host to the right slide.
    return {
      index,
      position: video?.currentTime ?? 0,
      playing: video ? !video.paused : false,
    };
  }, []);

  const applyPartySync = useCallback((sync: ReelPartySync) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const top = Math.max(0, sync.index) * scroller.clientHeight;
    if (Math.abs(scroller.scrollTop - top) > 4) {
      scroller.scrollTo({ top, behavior: "smooth" });
    }
    // Advance the host's playhead by the time the message spent in flight, so
    // a guest joins mid-reel instead of restarting it. Clamp the flight time:
    // a badly skewed device clock must not throw the guest decades ahead.
    const flight = sync.playing
      ? Math.min(5, Math.max(0, (Date.now() - sync.at) / 1000))
      : 0;
    const expected = Math.max(0, sync.position) + flight;
    const apply = () => {
      const video = scroller.querySelector<HTMLVideoElement>(
        `[data-reel-index="${sync.index}"] video`,
      );
      if (!video) return;
      if (Number.isFinite(expected) && Math.abs(video.currentTime - expected) > 1.1) {
        try {
          video.currentTime = expected;
        } catch {
          /* metadata is not ready yet; the retry below covers it */
        }
      }
      if (sync.playing) void video.play().catch(() => {});
      else video.pause();
    };
    apply();
    partySyncTimers.current.forEach((timer) => window.clearTimeout(timer));
    partySyncTimers.current = [
      window.setTimeout(apply, 160),
      window.setTimeout(apply, 520),
    ];
  }, []);

  const partyIdentity = useMemo(() => {
    if (!user) return null;
    return {
      name:
        profile?.display_name ||
        profile?.username ||
        user.email?.split("@")[0] ||
        "Someone",
      avatar: profile?.avatar_url ?? null,
      username: profile?.username ?? null,
    };
  }, [user, profile]);

  const party = useReelParty({
    userId: user?.id,
    identity: partyIdentity,
    onSync: applyPartySync,
    readSnapshot: readPartySnapshot,
  });
  const partyControlled = !!party.code && !party.isHost && party.hostPresent;

  const publishPartySnapshot = useCallback(() => {
    if (!party.code || !party.isHost) return;
    const snapshot = readPartySnapshot();
    if (snapshot) party.publish(snapshot);
  }, [party.code, party.isHost, party.publish, readPartySnapshot]);

  useEffect(() => () => {
    partySyncTimers.current.forEach((timer) => window.clearTimeout(timer));
  }, []);

  // A host's swipe is the room's next reel.
  useEffect(() => {
    publishPartySnapshot();
  }, [activeIndex, publishPartySnapshot]);

  // Play, pause and seek can happen without the index moving; the capture
  // listener sees them wherever they fire inside the feed.
  useEffect(() => {
    if (!party.code || !party.isHost) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const onPlayback = (event: Event) => {
      const video = event.target;
      if (!(video instanceof HTMLVideoElement)) return;
      const holder = video.closest<HTMLElement>("[data-reel-index]");
      if (!holder || Number(holder.dataset.reelIndex) !== activeIndexRef.current) return;
      publishPartySnapshot();
    };
    scroller.addEventListener("play", onPlayback, true);
    scroller.addEventListener("pause", onPlayback, true);
    scroller.addEventListener("seeked", onPlayback, true);
    return () => {
      scroller.removeEventListener("play", onPlayback, true);
      scroller.removeEventListener("pause", onPlayback, true);
      scroller.removeEventListener("seeked", onPlayback, true);
    };
  }, [party.code, party.isHost, publishPartySnapshot, reels.data?.length]);

  // Losing the session mid-party would leave a guest locked to a screen they
  // can no longer control; close the room instead.
  const signedOutInParty = !user && !!party.code;
  useEffect(() => {
    if (!signedOutInParty) return;
    party.leave();
    setPartyOpen(false);
    void navigate({ to: "/reels", search: {}, replace: true });
  }, [signedOutInParty, party.leave, navigate]);

  const normalizedPartyParam = normalizeReelPartyCode(partyParam);
  useEffect(() => {
    if (!normalizedPartyParam || !user || party.code || autoJoinedParty.current) return;
    autoJoinedParty.current = true;
    if (party.join(normalizedPartyParam)) {
      toast.success(`Joined reel party ${normalizedPartyParam}`);
    }
  }, [normalizedPartyParam, user, party.code, party.join]);

  // An invite opened signed-out should ask for the one thing it needs instead
  // of silently dropping the code.
  useEffect(() => {
    if (!normalizedPartyParam || user || party.code || invitePrompted.current) return;
    invitePrompted.current = true;
    setPartyOpen(true);
    toast.info("Sign in to join the reel party");
  }, [normalizedPartyParam, user, party.code]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const visibility = new Map<Element, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          visibility.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0);
        });
        const mostVisible = [...visibility.entries()].sort((a, b) => b[1] - a[1])[0];
        const index = mostVisible?.[1]
          ? Number((mostVisible[0] as HTMLElement).dataset.reelIndex)
          : -1;
        if (Number.isFinite(index)) setActiveIndex(index);
      },
      { root: scroller, threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] }
    );
    scroller.querySelectorAll<HTMLElement>("[data-reel-index]").forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [reels.data]);

  const advanceReel = (index: number) => {
    const next = scrollerRef.current?.querySelector<HTMLElement>(`[data-reel-index="${index + 1}"]`);
    next?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  function copyPartyInvite() {
    if (!party.code) return;
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      toast.error("Copy isn't available in this browser");
      return;
    }
    void navigator.clipboard.writeText(reelPartyInviteUrl(party.code)).then(
      () => toast.success("Invite link copied"),
      () => toast.error("Couldn't copy the invite link"),
    );
  }

  function startParty() {
    if (!user) {
      toast.error("Sign in to start a reel party");
      return;
    }
    const code = party.create();
    setPartyOpen(false);
    void navigate({ to: "/reels", search: { party: code }, replace: true });
    const copied = typeof navigator !== "undefined"
      ? navigator.clipboard?.writeText?.(reelPartyInviteUrl(code))
      : undefined;
    if (copied) {
      void copied.then(
        () => toast.success(`Party ${code} is live — invite link copied`),
        () => toast.success(`Party ${code} is live`),
      );
    } else {
      toast.success(`Party ${code} is live`);
    }
  }

  function joinParty(raw: string) {
    if (!user) {
      toast.error("Sign in to join a reel party");
      return;
    }
    const code = party.join(raw);
    if (!code) {
      toast.error("That party code isn't valid");
      return;
    }
    setPartyOpen(false);
    void navigate({ to: "/reels", search: { party: code }, replace: true });
    toast.success(`Joined party ${code}`);
  }

  function leaveParty() {
    party.leave();
    setPartyOpen(false);
    void navigate({ to: "/reels", search: {}, replace: true });
  }

  return (
    <div className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-black">
      <div className="absolute inset-x-3 top-3 z-30 flex items-center gap-2 pointer-events-none">
        <button
          onClick={() => setEditorOpen(true)}
          className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform active:scale-95"
          aria-label="Upload reel"
          title="Upload reel"
        >
          <Plus className="h-5 w-5 text-white" />
        </button>
        <button
          onClick={() => setPartyOpen(true)}
          className={`pointer-events-auto relative grid h-10 w-10 place-items-center rounded-full border shadow-md backdrop-blur-md transition-transform active:scale-95 ${
            party.code
              ? "border-primary/50 bg-primary/20 text-primary"
              : "border-white/15 bg-black/45 text-white"
          }`}
          aria-label={party.code ? "Reel party controls" : "Start a reel party"}
          title="Reel party"
        >
          <Users className="h-5 w-5" />
          {party.code && (
            <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-primary px-1 text-center text-[9px] font-black leading-4 text-primary-foreground">
              {party.watching}
            </span>
          )}
        </button>
      </div>

      <ReelEditor open={editorOpen} onClose={() => setEditorOpen(false)} />
      <ReelPartySheet
        open={partyOpen}
        onOpenChange={setPartyOpen}
        code={party.code}
        isHost={party.isHost}
        watching={party.watching}
        hostPresent={party.hostPresent}
        members={party.members}
        signedIn={!!user}
        onStart={startParty}
        onJoin={joinParty}
        onLeave={leaveParty}
        onCopyInvite={copyPartyInvite}
      />

      {reels.isLoading && <div className="grid min-h-0 flex-1 place-items-center text-muted-foreground">Loading reels…</div>}
      {reels.isError && (
        <div className="grid min-h-0 flex-1 place-items-center px-6 text-center">
          <div>
            <p className="mb-3 text-sm text-muted-foreground">Reels could not be loaded.</p>
            <Button variant="outline" onClick={() => void reels.refetch()}>Try again</Button>
          </div>
        </div>
      )}
      {reels.data?.length === 0 && (
        <div className="grid min-h-0 flex-1 place-items-center px-8 text-center">
          <div>
            <p className="text-muted-foreground mb-4">No reels yet — be the first to drop a vibe.</p>
            <Button onClick={() => setEditorOpen(true)} className="bg-primary text-primary-foreground border-0 shadow-md">
              <Upload className="h-4 w-4 mr-2" /> Upload a reel
            </Button>
          </div>
        </div>
      )}
      {!!reels.data?.length && (
        <div
          ref={scrollerRef}
          aria-label="Reels"
          className={`min-h-0 flex-1 overscroll-contain snap-y snap-mandatory no-scrollbar ${
            partyControlled ? "overflow-y-hidden" : "overflow-y-auto"
          }`}
        >
          {reels.data.map((r, index) => (
          <ReelItem
            key={r.id}
            post={r}
            reelIndex={index}
            muted={muted}
            partyControlled={partyControlled}
            toggleMute={() => setMuted((m) => !m)}
            speed={speed}
            captions={captions}
            filter={filter}
            setSpeed={setSpeed}
            setCaptions={setCaptions}
            setFilter={setFilter}
            isActive={activeIndex === index}
            // Load window: the reel on screen gets the connection, its
            // neighbours get their first frame so the next swipe is instant,
            // and everything else is left on the server. Without this every
            // reel in the list mounted a <video> at the browser's default
            // preload and started downloading at once, so the reel being
            // watched fought twenty others for bandwidth on a phone.
            preload={
              index === activeIndex
                ? "auto"
                : Math.abs(index - (activeIndex < 0 ? 0 : activeIndex)) <= 1
                  ? "metadata"
                  : "none"
            }
            autoplay={autoplay}
            setAutoplay={setAutoplay}
            onEnded={() => advanceReel(index)}
            initialLiked={!!likes.data?.has(r.id)}
            initialSaved={!!saved.data?.has(r.id)}
          />
          ))}
        </div>
      )}
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

function CaptionText({ caption }: { caption: string }) {
  return (
    <>
      {renderGifSegments(caption).map((segment, segmentIndex) => segment.isGif || segment.isSticker
        ? <GifContent key={`media-${segmentIndex}`}>{segment.marker ?? ""}</GifContent>
        : renderCaptionWithTags(segment.value).map((part, index) => {
        if (part.mention) {
          return (
            <ProfilePreviewTrigger key={index} username={part.mention} className="mention-highlight font-semibold underline underline-offset-2">
              {part.text}
            </ProfilePreviewTrigger>
          );
        }
        if (part.tag) {
          return <Link key={index} to="/tag/$tag" params={{ tag: part.tag }} onClick={(event) => event.stopPropagation()} className="font-semibold text-white underline decoration-white/60 underline-offset-2">{part.text}</Link>;
        }
        if (part.url) {
          return <a key={index} href={part.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="underline decoration-white/60 underline-offset-2">{part.text}</a>;
        }
        return <span key={index}>{part.text}</span>;
      }))}
    </>
  );
}

function ReelItem({
  post,
  reelIndex,
  muted,
  partyControlled,
  toggleMute,
  speed,
  captions,
  filter,
  setSpeed,
  setCaptions,
  setFilter,
  initialLiked,
  initialSaved,
  isActive,
  preload,
  autoplay,
  setAutoplay,
  onEnded,
}: {
  post: any;
  reelIndex: number;
  muted: boolean;
  /** A guest in a live room: the host owns play/pause and the playhead. */
  partyControlled: boolean;
  toggleMute: () => void;
  speed: number;
  captions: boolean;
  filter: string;
  setSpeed: React.Dispatch<React.SetStateAction<number>>;
  setCaptions: React.Dispatch<React.SetStateAction<boolean>>;
  setFilter: React.Dispatch<React.SetStateAction<string>>;
  initialLiked: boolean;
  initialSaved: boolean;
  isActive: boolean;
  /** "auto" on screen, "metadata" for the neighbour slides, "none" far away. */
  preload: "auto" | "metadata" | "none";
  autoplay: boolean;
  setAutoplay: React.Dispatch<React.SetStateAction<boolean>>;
  onEnded: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLVideoElement>(null);
  const externalLink =
    post.media_type === "video" && post.media_url
      ? parseExternalReelLink(post.media_url)
      : null;
  const isExternal = !!externalLink?.ok;
  const [progress, setProgress] = useState(0);
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState<number>(post.like_count ?? 0);
  const [saved, setSaved] = useState(initialSaved);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [stickerBurst, setStickerBurst] = useState<{ id: number; src: string; x: number; y: number; imageLoaded: boolean } | null>(null);
  const preparedStickerRef = useRef<{ src: string; loaded: boolean } | null>(null);
  const [staticLikeFeedback, setStaticLikeFeedback] = useState(false);
  const [paused, setPaused] = useState(true);
  const [playCue, setPlayCue] = useState<"play" | "pause" | null>(null);
  const cueTimer = useRef<number | null>(null);
  const tapTimer = useRef<number | null>(null);
  const stickerTimer = useRef<number | null>(null);
  const stickerId = useRef(0);
  const warmStickerEffect = useCallback(() => {
    const effect = REEL_LIKE_EFFECTS[Math.floor(Math.random() * REEL_LIKE_EFFECTS.length)];
    const src = `/reel-effects/${effect}`;
    const prepared = { src, loaded: false };
    const image = new Image();
    preparedStickerRef.current = prepared;
    image.onload = () => {
      if (preparedStickerRef.current === prepared) {
        preparedStickerRef.current = { ...prepared, loaded: true };
      }
    };
    image.onerror = () => {
      if (preparedStickerRef.current === prepared) preparedStickerRef.current = null;
    };
    image.src = src;
    return () => {
      image.onload = null;
      image.onerror = null;
      if (preparedStickerRef.current === prepared) preparedStickerRef.current = null;
    };
  }, []);

  useEffect(() => setLiked(initialLiked), [initialLiked]);
  useEffect(() => setSaved(initialSaved), [initialSaved]);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let cancelled = false;
    if (!isActive) {
      video.pause();
      setPaused(true);
      return () => { cancelled = true; };
    }
    if (partyControlled) {
      // The party sync owns this player. Trying to autoplay here would fight
      // the host's pause, so leave the decision to the incoming snapshot.
      return () => { cancelled = true; };
    }
    if (autoplay) {
      video.play()
        .then(() => {
          if (cancelled) {
            video.pause();
            return;
          }
          setPaused(false);
        })
        .catch(() => {
          if (!cancelled) setPaused(video.paused);
        });
    } else {
      video.pause();
      setPaused(true);
    }
    return () => { cancelled = true; };
  }, [isActive, autoplay, partyControlled]);
  useEffect(() => { if (ref.current) ref.current.playbackRate = speed; }, [speed]);
  useEffect(() => {
    if (!isActive) return;
    return warmStickerEffect();
  }, [isActive, warmStickerEffect]);
  useEffect(() => () => {
    if (cueTimer.current !== null) window.clearTimeout(cueTimer.current);
    if (tapTimer.current !== null) window.clearTimeout(tapTimer.current);
    if (stickerTimer.current !== null) window.clearTimeout(stickerTimer.current);
  }, []);

  async function doLike(force?: boolean) {
    if (!user) { toast.error("Sign in to like"); return; }
    const next = force ?? !liked;
    if (next === liked) return;
    setLiked(next);
    setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)));
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

  function showPlaybackCue(type: "play" | "pause") {
    setPlayCue(type);
    if (cueTimer.current !== null) window.clearTimeout(cueTimer.current);
    cueTimer.current = window.setTimeout(() => setPlayCue(null), 650);
  }

  async function togglePlayback() {
    const video = ref.current;
    if (!video || !isActive || partyControlled) return;
    if (video.paused) {
      try {
        await video.play();
        setPaused(false);
        showPlaybackCue("play");
      } catch {
        toast.error("Couldn't play this reel");
      }
    } else {
      video.pause();
      setPaused(true);
      showPlaybackCue("pause");
    }
  }

  function handleVideoTap(event: React.MouseEvent<HTMLVideoElement>) {
    event.preventDefault();
    if (tapTimer.current !== null) {
      window.clearTimeout(tapTimer.current);
      tapTimer.current = null;
      void doLike(true);
      if (stickerTimer.current !== null) window.clearTimeout(stickerTimer.current);
      setStaticLikeFeedback(false);
      if (reduceMotion) {
        setStickerBurst(null);
        setStaticLikeFeedback(true);
        stickerTimer.current = window.setTimeout(() => setStaticLikeFeedback(false), 700);
        return;
      }
      const bounds = event.currentTarget.getBoundingClientRect();
      const insetX = Math.min(12, (42 / bounds.width) * 100);
      const insetY = Math.min(12, (42 / bounds.height) * 100);
      const x = Math.max(insetX, Math.min(100 - insetX, ((event.clientX - bounds.left) / bounds.width) * 100));
      const y = Math.max(insetY, Math.min(100 - insetY, ((event.clientY - bounds.top) / bounds.height) * 100));
      const id = ++stickerId.current;
      const preparedSticker = preparedStickerRef.current;
      const effect = preparedSticker ?? {
        src: `/reel-effects/${REEL_LIKE_EFFECTS[Math.floor(Math.random() * REEL_LIKE_EFFECTS.length)]}`,
        loaded: false,
      };
      setStickerBurst({ id, src: effect.src, x, y, imageLoaded: effect.loaded });
      warmStickerEffect();
      if (stickerTimer.current !== null) window.clearTimeout(stickerTimer.current);
      stickerTimer.current = window.setTimeout(() => {
        setStickerBurst((current) => current?.id === id ? null : current);
      }, 900);
      return;
    }
    tapTimer.current = window.setTimeout(() => {
      tapTimer.current = null;
      if (!partyControlled) void togglePlayback();
    }, 260);
  }

  function viewOriginal() {
    if (!externalLink?.ok) return;
    window.open(externalLink.value.sourceUrl, "_blank", "noopener,noreferrer");
  }

  const remix = () => toast.success("Remix template saved to your drafts ✨");
  // A reel is shareable into any conversation; its permalink opens the reel
  // itself, not the author's profile.
  const shareDraft = shareDraftForPost({
    caption: post.caption,
    mediaUrl: post.media_url,
    mediaKind: post.media_type,
    permalink: `${window.location.origin}/p/${post.id}`,
    title: "Share reel",
  });

  return (
      <section data-reel-index={reelIndex} className={`relative h-full min-h-full w-full snap-start snap-always overflow-hidden bg-black ${isExternal ? "flex flex-col" : ""}`}>
      {!isExternal && (
        <>
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-36 bg-gradient-to-b from-black/45 via-black/15 to-transparent" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-44 bg-gradient-to-t from-black/55 via-black/20 to-transparent" />
        </>
      )}
      {isExternal ? (
        <>
          <ExternalVideoEmbed
            sourceUrl={post.media_url}
            className="min-h-0 flex-1 w-full"
            caption={captions ? post.caption : undefined}
            creator={post.author?.username}
            minimalControls
          />
          <div className="absolute right-3 top-3 z-20">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="grid h-10 w-10 place-items-center rounded-full glass-strong text-white"
                  aria-label="Reel options"
                >
                  <MoreVertical className="h-5 w-5" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-1.5 glass-strong border-white/10">
                <button
                  type="button"
                  role="switch"
                  aria-label="Autoplay uploaded videos"
                  aria-checked={autoplay}
                  onClick={() => setAutoplay((current) => !current)}
                  className="w-full flex min-h-10 items-center justify-between rounded-lg px-2.5 text-left text-sm font-medium hover:bg-white/10"
                >
                  Autoplay uploads
                  <span className="text-xs text-muted-foreground">{autoplay ? "On" : "Off"}</span>
                </button>
                <button
                  type="button"
                  onClick={viewOriginal}
                  className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm font-medium hover:bg-white/10"
                >
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  View original
                </button>
              </PopoverContent>
            </Popover>
          </div>
          <div className="shrink-0 px-4 py-3 text-white">
            <ProfilePreviewTrigger username={post.author?.username} className="mb-2 flex items-center gap-2 text-left">
              <Avatar className="h-9 w-9 ring-2 ring-white/40">
                <AvatarImage src={post.author?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">{(post.author?.username ?? "?").charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="font-bold text-sm">@{post.author?.username}</span>
              {post.author?.verified_creator && <VerifiedCreatorTag />}
            </ProfilePreviewTrigger>
            <div className="flex items-center justify-around gap-1">
              <ReelAction
                icon={<Heart className={`h-6 w-6 ${liked ? "fill-primary text-primary" : ""}`} />}
                label={formatCount(likeCount)}
                onClick={() => doLike()}
                active={liked}
              />
              <ReelAction icon={<MessageCircle className="h-6 w-6" />} label={formatCount(post.comment_count)} onClick={() => setCommentsOpen(true)} />
              <ReelAction
                icon={<Bookmark className={`h-6 w-6 ${saved ? "fill-white" : ""}`} />}
                label={saved ? "Saved" : "Save"}
                onClick={doSave}
                active={saved}
              />
              <ReelAction icon={<Share2 className="h-6 w-6" />} label="Share" onClick={() => setShareOpen(true)} />
              <Button onClick={remix} size="sm" variant="outline" className="rounded-full bg-white/10 border-white/30 text-white h-8 px-3 text-xs">Remix</Button>
            </div>
          </div>
          <CommentsSheet open={commentsOpen} onOpenChange={setCommentsOpen} postId={post.id} />
          <ShareToChatSheet open={shareOpen} onOpenChange={setShareOpen} draft={shareDraft} />
        </>
      ) : (
        <>
        <video
          ref={ref}
          src={post.media_url}
          preload={preload}
          muted={muted}
          playsInline
          onClick={handleVideoTap}
          onPlay={() => setPaused(false)}
          onPause={() => setPaused(true)}
          onEnded={() => { if (!partyControlled && autoplay && isActive) onEnded(); }}
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            if (v.duration) setProgress((v.currentTime / v.duration) * 100);
          }}
          className="absolute inset-0 h-full w-full object-cover transition-[filter] duration-300"
          style={{ filter: FILTER_CSS[filter] || "none" }}
        />
      {stickerBurst && (
        <span
          key={stickerBurst.id}
          className="pointer-events-none absolute z-[15] grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-black/35 shadow-[0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur-sm"
          style={{
            left: `${stickerBurst.x}%`,
            top: `${stickerBurst.y}%`,
            animation: "reel-sticker-pop 900ms cubic-bezier(0.2,0.7,0.2,1) forwards",
          }}
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 grid place-items-center text-4xl transition-opacity duration-100 ${
              stickerBurst.imageLoaded ? "opacity-0" : "opacity-100"
            }`}
          >
            💖
          </span>
          <img
            src={stickerBurst.src}
            alt=""
            aria-hidden="true"
            draggable={false}
            onLoad={() => setStickerBurst((current) =>
              current?.id === stickerBurst.id ? { ...current, imageLoaded: true } : current
            )}
            className={`h-11 w-11 select-none object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.35)] transition-opacity duration-100 ${
              stickerBurst.imageLoaded ? "opacity-100" : "opacity-0"
            }`}
          />
        </span>
      )}
      {staticLikeFeedback && (
        <span className="pointer-events-none absolute inset-0 z-[15] grid place-items-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/65 px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-md">
            <Heart className="h-3.5 w-3.5 fill-primary text-primary" />
            Liked
          </span>
        </span>
      )}
      {playCue && (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center" aria-live="polite">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm animate-in fade-in zoom-in-95 duration-150">
            {playCue === "play" ? <Play className="h-7 w-7 fill-current" /> : <Pause className="h-7 w-7 fill-current" />}
            <span className="sr-only">{playCue === "play" ? "Playing" : "Paused"}</span>
          </span>
        </div>
      )}
      {!isExternal && <div className="absolute top-0 inset-x-0 h-0.5 bg-white/10">
        <div className="h-full bg-primary text-primary-foreground shadow-md" style={{ width: `${progress}%` }} />
      </div>}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
        {!isExternal && !partyControlled && <button
          type="button"
          onClick={() => void togglePlayback()}
          className="h-10 w-10 rounded-full glass-strong grid place-items-center"
          aria-label={paused ? "Play reel" : "Pause reel"}
          aria-pressed={!paused}
        >
          {paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
        </button>}
        {!isExternal && <button
            onClick={toggleMute}
            className="h-10 w-10 rounded-full glass-strong grid place-items-center"
            aria-label={muted ? "Unmute reel" : "Mute reel"}
          >
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>}
        {!isExternal && <Popover>
          <PopoverTrigger asChild>
            <button
              className="h-10 w-10 rounded-full glass-strong grid place-items-center"
              aria-label="Reel settings"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-60 p-3 glass-strong border-white/10">
            <div className="space-y-3 text-foreground">
              <section>
                <button
                  type="button"
                  role="switch"
                  aria-label="Autoplay uploaded videos"
                  aria-checked={autoplay}
                  onClick={() => setAutoplay((current) => !current)}
                  className="w-full flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-white/10"
                >
                  <span className="flex items-center gap-2"><Play className="h-4 w-4 text-primary" /> Autoplay</span>
                  <span className={`relative h-5 w-9 rounded-full transition-colors ${autoplay ? "bg-primary" : "bg-white/25"}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${autoplay ? "translate-x-4" : "translate-x-0.5"}`} />
                  </span>
                </button>
              </section>
              <section className="border-t border-white/10 pt-3">
                <h3 className="flex items-center gap-2 text-xs font-semibold mb-2">
                  <Gauge className="h-3.5 w-3.5 text-primary" /> Playback speed
                </h3>
                <div className="grid grid-cols-4 gap-1">
                  {[0.5, 1, 1.5, 2].map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={speed === value}
                      onClick={() => setSpeed(value)}
                      className={`rounded-lg px-1.5 py-1.5 text-xs transition-colors ${speed === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-white/10 hover:text-foreground"}`}
                    >
                      {value}x
                    </button>
                  ))}
                </div>
              </section>
              <section className="border-t border-white/10 pt-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={captions}
                  onClick={() => setCaptions((current) => !current)}
                  className="w-full flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-white/10"
                >
                  <span className="flex items-center gap-2"><Captions className="h-4 w-4 text-primary" /> Captions</span>
                  <span className="text-xs text-muted-foreground">{captions ? "On" : "Off"}</span>
                </button>
              </section>
              <section className="border-t border-white/10 pt-3">
                <h3 className="flex items-center gap-2 text-xs font-semibold mb-2">
                  <Palette className="h-3.5 w-3.5 text-muted-foreground" /> Visual filter
                </h3>
                <div className="grid grid-cols-3 gap-1">
                  {(["none", "warm", "cool", "noir", "vivid"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={filter === value}
                      onClick={() => setFilter(value)}
                      className={`rounded-lg px-2 py-1.5 text-xs capitalize transition-colors ${filter === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-white/10 hover:text-foreground"}`}
                    >
                      {value === "none" ? "None" : value}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </PopoverContent>
        </Popover>}
      </div>
      <div className="absolute left-3 right-[5.5rem] bottom-3 z-10 text-white drop-shadow md:left-6 md:bottom-5">
        <ProfilePreviewTrigger username={post.author?.username} className="mb-2 flex items-center gap-2 text-left">
          <Avatar className="h-9 w-9 ring-2 ring-white/40">
            <AvatarImage src={post.author?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">{(post.author?.username ?? "?").charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="font-bold text-sm">@{post.author?.username}</span>
          {post.author?.verified_creator && <VerifiedCreatorTag />}
        </ProfilePreviewTrigger>
        {captions && post.caption && <p className="max-w-full text-[13px] leading-snug line-clamp-3 bg-black/55 backdrop-blur-sm rounded-lg px-2 py-1 inline-block break-words"><CaptionText caption={post.caption} /></p>}
        <div className="flex items-center gap-1.5 text-xs mt-2 opacity-80">
          <Music2 className="h-3.5 w-3.5" /> {isExternal ? "Linked video" : `Original audio · @${post.author?.username}`}
        </div>
      </div>
      <div className="absolute right-2 bottom-3 md:right-4 md:bottom-5 flex flex-col items-center gap-2 text-white z-10">
        <ReelAction
          icon={<Heart className={`h-6 w-6 ${liked ? "fill-primary text-primary" : ""}`} />}
          label={formatCount(likeCount)}
          onClick={() => doLike()}
          active={liked}
        />
        <ReelAction
          icon={<MessageCircle className="h-6 w-6" />}
          label={formatCount(post.comment_count)}
          onClick={() => setCommentsOpen(true)}
        />
        <ReelAction
          icon={<Bookmark className={`h-6 w-6 ${saved ? "fill-white" : ""}`} />}
          label={saved ? "Saved" : "Save"}
          onClick={doSave}
          active={saved}
        />
        <ReelAction icon={<Share2 className="h-6 w-6" />} label="Share" onClick={() => setShareOpen(true)} />
        <Button onClick={remix} size="sm" variant="outline" className="rounded-full bg-white/10 border-white/30 text-white h-8 px-3 text-xs">Remix</Button>
      </div>

      <CommentsSheet open={commentsOpen} onOpenChange={setCommentsOpen} postId={post.id} />
      <ShareToChatSheet open={shareOpen} onOpenChange={setShareOpen} draft={shareDraft} />
        </>
      )}

      <style>{`
        @keyframes reel-heart {
          0% { transform: scale(0.4); opacity: 0; }
          25% { transform: scale(1.2); opacity: 1; }
          70% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        @keyframes reel-sticker-pop {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.2) rotate(-14deg); }
          16% { opacity: 1; transform: translate(-50%, -60%) scale(1.08) rotate(5deg); }
          55% { opacity: 1; transform: translate(-50%, -88%) scale(1) rotate(-4deg); }
          100% { opacity: 0; transform: translate(-50%, -145%) scale(0.92) rotate(7deg); }
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

/**
 * Reel comments, on the shared thread.
 *
 * This used to be a flat, one-way list with no reply, vote, reaction or delete
 * — the reel had the least capable comments in the app. The thread is mounted
 * only while the sheet is open, so scrolling reels never fetches comments for
 * reel after reel in the background.
 */
function CommentsSheet({ open, onOpenChange, postId }: { open: boolean; onOpenChange: (o: boolean) => void; postId: string }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        hideClose
        className="glass-strong border-white/10 rounded-t-3xl h-[80dvh] max-h-[85dvh] flex flex-col p-0 pb-[max(env(safe-area-inset-bottom),0.5rem)]"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-2.5">
          <SheetTitle className="font-display text-lg">Comments</SheetTitle>
          <SheetClose asChild>
            <CloseButton />
          </SheetClose>
        </div>
        {open && (
          <CommentSection
            postId={postId}
            maxLength={REEL_COMMENT_MAX_LENGTH}
            className="min-h-0 flex-1"
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function ReelEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sourceMode, setSourceMode] = useState<"upload" | "link">("upload");
  const [sourceLink, setSourceLink] = useState("");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [caption, setCaption] = useState("");
  const [song, setSong] = useState<string | null>(null);
  const [songQuery, setSongQuery] = useState("");
  const [trim, setTrim] = useState<[number, number]>([0, 60]);
  const [duration, setDuration] = useState(60);
  const [overlay, setOverlay] = useState("");
  const previewRef = useRef<HTMLVideoElement>(null);
  const uploadToastId = useRef<string | number | undefined>(undefined);
  const sourceLinkResult = sourceLink.trim() ? parseExternalReelLink(sourceLink) : null;
  const canPublishLink =
    sourceLinkResult?.ok === true &&
    sourceLinkResult.value.platform === "youtube" &&
    rightsConfirmed;

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
     setFile(null); setSourceLink(""); setRightsConfirmed(false); setSourceMode("upload");
     setCaption(""); setSong(null); setOverlay("");
    setTrim([0, 60]); setDuration(60);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  const mut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in first");
      const parsedLink = sourceMode === "link" && sourceLinkResult?.ok ? sourceLinkResult.value : null;
      if (sourceMode === "upload" && !file) throw new Error("Pick a video to create a reel");
      if (sourceMode === "link" && !parsedLink) {
        throw new Error(sourceLinkResult && !sourceLinkResult.ok ? sourceLinkResult.error : "Paste a video link.");
      }
      if (sourceMode === "link" && parsedLink?.platform === "rednote") throw new Error("RedNote links aren't supported in Reels.");
      if (sourceMode === "link" && parsedLink?.platform === "instagram") throw new Error("This video link isn't supported here.");
      if (sourceMode === "link" && !rightsConfirmed) throw new Error("Confirm that you have permission to share this video.");
      const songTag = song ? SONG_LIBRARY.find((s) => s.id === song) : null;
      const songLine = sourceMode === "upload" && songTag ? `\n🎵 ${songTag.title} — ${songTag.artist}` : "";
      const overlayLine = sourceMode === "upload" && overlay ? `\n${overlay}` : "";
      const fullCaption = (caption + overlayLine + songLine).trim();
      uploadToastId.current = toast.loading(sourceMode === "link" ? "Publishing reel link…" : "Uploading your video…");
       return createPost({
         authorId: user.id,
         caption: fullCaption,
          file: sourceMode === "upload" ? file : null,
          externalSourceUrl: parsedLink?.sourceUrl,
         kind: "reel",
         onProgress: (stage) => {
            toast.loading(stage === "uploading" ? "Uploading your video…" : "Saving your reel…", {
             id: uploadToastId.current,
           });
         },
       });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reels"] });
      qc.invalidateQueries({ queryKey: ["feed"] });
       toast.success("Reel posted 🎬", { id: uploadToastId.current });
       uploadToastId.current = undefined;
      reset();
      onClose();
    },
     onError: (e: Error) => {
       if (uploadToastId.current !== undefined) {
         toast.error(e.message, { id: uploadToastId.current });
         uploadToastId.current = undefined;
       } else {
         toast.error(e.message);
       }
     },
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
          <DialogDescription className="sr-only">Upload a video file or add a YouTube video link, then write a caption.</DialogDescription>
          <span className="h-8 w-8" aria-hidden />
        </div>

        <div className="flex gap-2 px-4 pt-3 shrink-0" role="group" aria-label="Reel source">
          <Button type="button" variant={sourceMode === "upload" ? "default" : "outline"} onClick={() => setSourceMode("upload")} aria-pressed={sourceMode === "upload"}>
            <Upload className="mr-2 h-4 w-4" /> Video file
          </Button>
          <Button type="button" variant={sourceMode === "link" ? "default" : "outline"} onClick={() => setSourceMode("link")} aria-pressed={sourceMode === "link"}>
            <Link2 className="mr-2 h-4 w-4" /> Add a link
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-0 flex-1 min-h-0 overflow-y-auto md:overflow-hidden">
          <div className="bg-black grid place-items-center min-h-[240px] md:min-h-[440px] relative">
            {sourceMode === "link" && sourceLinkResult?.ok && sourceLinkResult.value.platform === "youtube" ? (
              <ExternalVideoEmbed sourceUrl={sourceLinkResult.value.sourceUrl} className="h-full w-full" />
            ) : sourceMode === "link" && sourceLinkResult?.ok ? (
              <div className="max-w-sm p-6 text-center text-sm text-white/75" role="status">
                {sourceLinkResult.value.platform === "rednote"
                  ? "RedNote links aren’t supported in Reels."
                  : "This link can’t be shown here. Try a YouTube video link."}
              </div>
            ) : sourceMode === "upload" && previewUrl ? (
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
            ) : (
              <div className="flex flex-col items-center gap-3 text-white/70 px-6 py-10 text-center">
                {sourceMode === "upload" ? (
                  <label className="cursor-pointer flex flex-col items-center gap-3">
                    <input type="file" accept="video/*" hidden onChange={(e) => pick(e.target.files?.[0] ?? null)} />
                    <div className="h-16 w-16 rounded-full bg-primary text-primary-foreground grid place-items-center shadow-md">
                      <Upload className="h-7 w-7 text-white" />
                    </div>
                    <p className="font-bold text-white">Tap to upload video</p>
                    <p className="text-xs">MP4, MOV · up to 50MB</p>
                  </label>
                ) : (
                  <div>
                    <Link2 className="mx-auto h-8 w-8" />
                    <p className="mt-2 text-sm">Paste a supported video link to preview it</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-4 overflow-y-auto">
            {sourceMode === "link" && (
              <div className="mb-4 space-y-2">
                <label htmlFor="reel-source-link" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Video link</label>
                <Input
                  id="reel-source-link"
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  value={sourceLink}
                  onChange={(e) => setSourceLink(e.target.value)}
                  placeholder="Paste a YouTube video link"
                  className="glass border-white/10"
                  aria-describedby="reel-source-help reel-source-status"
                />
                <p id="reel-source-status" className={`text-xs ${sourceLinkResult && (!sourceLinkResult.ok || (sourceLinkResult.ok && sourceLinkResult.value.platform !== "youtube")) ? "text-destructive" : "text-muted-foreground"}`} role="status">
                  {!sourceLinkResult ? "YouTube previews use the official player. RedNote and Instagram links aren’t supported in Reels." :
                    !sourceLinkResult.ok ? sourceLinkResult.error :
                      sourceLinkResult.value.platform === "instagram" ? "This link can’t be shared here. Try a YouTube video link." :
                        sourceLinkResult.value.platform === "rednote" ? "RedNote links aren’t supported in Reels." :
                          "YouTube link ready to preview."}
                </p>
                <p id="reel-source-help" className="text-[11px] leading-relaxed text-muted-foreground">
                  External videos stay on their original platform. RIZZ does not download or rehost them.
                </p>
                <label className="flex items-start gap-2 text-xs leading-relaxed">
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-primary"
                    checked={rightsConfirmed}
                    onChange={(e) => setRightsConfirmed(e.target.checked)}
                  />
                  <span>I have permission to share this link on RIZZ.</span>
                </label>
              </div>
            )}
            <Tabs key={sourceMode} defaultValue="caption">
              <TabsList className="w-full glass border border-white/10">
                <TabsTrigger value="caption" className="flex-1"><TypeIcon className="h-3.5 w-3.5 mr-1" /> Caption</TabsTrigger>
                {sourceMode === "upload" && <>
                  <TabsTrigger value="song" className="flex-1"><Music2 className="h-3.5 w-3.5 mr-1" /> Song</TabsTrigger>
                  <TabsTrigger value="trim" className="flex-1"><Scissors className="h-3.5 w-3.5 mr-1" /> Trim</TabsTrigger>
                </>}
              </TabsList>

              <TabsContent value="caption" className="space-y-3 mt-4">
                <Textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value.slice(0, 500))}
                  placeholder="Describe your reel… use #hashtags and @mentions"
                  className="glass border-white/10 min-h-[110px] resize-none"
                />
                <p className="text-xs text-muted-foreground text-right">{500 - caption.length} left</p>
                {sourceMode === "upload" && <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Sticker text</p>
                  <Input
                    value={overlay}
                    onChange={(e) => setOverlay(e.target.value.slice(0, 60))}
                    placeholder="POV: it's Friday"
                    className="glass border-white/10"
                  />
                </div>}
              </TabsContent>

              {sourceMode === "upload" && <TabsContent value="song" className="space-y-3 mt-4">
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
                      song === null ? "bg-primary text-primary-foreground shadow-md" : "hover:bg-white/5"
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
                        song === s.id ? "bg-primary text-primary-foreground shadow-md" : "hover:bg-white/5"
                      }`}
                    >
                      <div className="h-10 w-10 rounded-lg bg-primary/20 grid place-items-center text-base">🎵</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{s.title}</p>
                        <p className="text-xs opacity-70 truncate">{s.artist} · {s.bpm} BPM · {s.mood}</p>
                      </div>
                      {song === s.id && <Check className="h-4 w-4" />}
                    </button>
                  ))}
                </div>
              </TabsContent>}

              {sourceMode === "upload" && <TabsContent value="trim" className="space-y-4 mt-4">
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
              </TabsContent>}
            </Tabs>
          </div>
        </div>

        <div
          className="flex items-center justify-between gap-2 px-5 py-3 border-t border-white/10 shrink-0"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
           <Button variant="ghost" onClick={reset} disabled={(!file && !sourceLink) || mut.isPending}>Reset</Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || (sourceMode === "upload" ? !file : !canPublishLink)}
            className="bg-primary text-primary-foreground border-0 shadow-md px-6"
          >
            {mut.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Posting…</> : "Post reel 🎬"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
