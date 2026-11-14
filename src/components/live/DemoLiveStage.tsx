/**
 * The viewer stage for a demo live.
 *
 * A real live room is a WebRTC call with an opt-in camera, so it cannot show a
 * game unless someone is actually streaming. This stage is honest about that:
 * it draws the screen-share frame, keeps the clock and the chat moving so the
 * surface can be tested end to end, and labels itself DEMO everywhere. No
 * network calls, no fake participants, nothing to mistake for a real broadcast.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, Flag, Send, Share2, Signal, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatLiveClock, formatViewers, type DemoLive } from "@/components/live/demo-lives";
import { RizzLiveIcon } from "@/components/live/RizzLiveIcon";

type ChatLine = { id: number; user: string; text: string; tint: string; own?: boolean };

/** Pull a video id out of any of YouTube's share shapes, live ones included. */
export function youtubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com|youtube-nocookie\.com)\/(?:live|embed|shorts|watch)\/(?:v=)?([\w-]{11})/i,
    /[?&]v=([\w-]{11})/i,
    /youtu\.be\/([\w-]{11})/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(url);
    if (match) return match[1];
  }
  return null;
}

function screenKey(id: string) {
  return `rizz:demo-screen:${id}`;
}

/** A URL this browser was told to use wins over the fixture's own screen. */
function readStoredScreen(id: string): string {
  try {
    return window.localStorage.getItem(screenKey(id)) ?? "";
  } catch {
    return "";
  }
}

export function DemoLiveStage({ live, onClose }: { live: DemoLive; onClose: () => void }) {
  const [elapsed, setElapsed] = useState(live.startedSecondsAgo);
  const [viewers, setViewers] = useState(live.viewers);
  const [draft, setDraft] = useState("");
  const [lines, setLines] = useState<ChatLine[]>(() =>
    live.chat.slice(0, 3).map((line, index) => ({ id: index, ...line })),
  );
  // Where the screen share comes from: the fixture, or a clip this browser was
  // given at runtime. Local only — nothing is uploaded anywhere.
  const [screenUrl, setScreenUrl] = useState(() => readStoredScreen(live.id) || live.screen?.src || "");
  const [screenDraft, setScreenDraft] = useState("");
  const [screenFormOpen, setScreenFormOpen] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const screenYoutubeId = useMemo(() => (screenUrl ? youtubeId(screenUrl) : null), [screenUrl]);
  const nextId = useRef(live.chat.length);
  const scroller = useRef<HTMLDivElement>(null);
  const reducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true,
    [],
  );

  // The clock and the audience move on their own, slowly enough to stay cheap.
  useEffect(() => {
    const clock = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const drift = window.setInterval(() => {
      setViewers((value) => Math.max(1, value + (Math.random() > 0.45 ? 1 : -1)));
    }, 4200);
    return () => window.clearInterval(drift);
  }, [reducedMotion]);

  // Chat keeps trickling so the composer and the scroll behave like a live room.
  useEffect(() => {
    const feed = window.setInterval(() => {
      const line = live.chat[nextId.current % live.chat.length];
      nextId.current += 1;
      setLines((current) => [...current.slice(-23), { id: nextId.current, ...line }]);
    }, 5200);
    return () => window.clearInterval(feed);
  }, [live.chat]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const send = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    nextId.current += 1;
    setLines((current) => [
      ...current.slice(-23),
      { id: nextId.current, user: "you", text, tint: "#c9ff3d", own: true },
    ]);
    setDraft("");
    setElapsed((value) => value + 1);
  }, [draft]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${live.name} is live — ${live.title}`}
      className="fixed inset-0 z-[140] flex flex-col bg-[#07070a]/97 backdrop-blur-xl"
    >
      {/* Header: who is on air, for how long, and how many are watching. */}
      <header className="flex shrink-0 items-center gap-2.5 border-b border-white/10 px-3 py-2.5 sm:px-5">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close live"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-foreground transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          autoFocus
        >
          <X className="h-5 w-5" />
        </button>
        <span
          className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-[14px] text-sm font-bold text-[#08080a] ring-1 ring-white/15"
          style={{ background: live.avatarTint }}
          aria-hidden="true"
        >
          {live.initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold leading-tight">
            {live.name} <span className="font-medium text-muted-foreground">@{live.handle}</span>
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
            <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-foreground/80">
              Demo
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" /> {formatViewers(viewers)} watching
            </span>
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#ff5d68]/40 bg-[#ff5d68]/12 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#ff5d68]">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-[#ff5d68]" />
          Live {formatLiveClock(elapsed)}
        </span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-3 py-3 lg:flex-row lg:px-5">
        {/* Screen share. */}
        <section className="flex shrink-0 flex-col gap-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          <div className="relative aspect-video w-full overflow-hidden rounded-[20px] border border-white/10 bg-[#0b0b10]">
            <div
              aria-hidden="true"
              className="absolute inset-0"
              style={{
                background: `radial-gradient(120% 110% at 18% 0%, ${live.stageTint}33, transparent 58%), radial-gradient(90% 80% at 90% 100%, ${live.stageTint}22, transparent 62%), linear-gradient(160deg, #101018, #07070b)`,
              }}
            />
            {!reducedMotion && (
              <div aria-hidden="true" className="demo-scan absolute inset-0 opacity-60" />
            )}
            {screenUrl && screenYoutubeId ? (
              <iframe
                key={screenYoutubeId}
                src={`https://www.youtube-nocookie.com/embed/${screenYoutubeId}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1`}
                title={`${live.name} screen share`}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                className="absolute inset-0 h-full w-full border-0"
              />
            ) : screenUrl && !mediaError ? (
              <video
                key={screenUrl}
                src={screenUrl}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                onError={() => setMediaError(true)}
                className="absolute inset-0 h-full w-full bg-black object-cover"
              />
            ) : (
              <div className="relative flex h-full w-full items-center justify-center">
                <span
                  className="text-[74px] leading-none drop-shadow-[0_10px_30px_rgba(0,0,0,0.55)] sm:text-[104px]"
                  aria-hidden="true"
                >
                  {live.posterGlyph}
                </span>
              </div>
            )}

            <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/55 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-white/85 backdrop-blur">
              <Signal className="h-3 w-3 text-primary" />
              {live.gameLabel} · screen share
            </span>
            <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/55 px-2.5 py-1 text-[10px] font-semibold text-white/80 backdrop-blur">
              <Eye className="h-3 w-3" /> {formatViewers(viewers)}
            </span>
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 py-2.5">
              <span className="truncate text-[12px] font-semibold text-white/90">{live.title}</span>
              <span className="shrink-0 rounded-full border border-primary/40 bg-primary/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-primary">
                1080p demo
              </span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {live.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/10 bg-surface-1 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground"
              >
                #{tag}
              </span>
            ))}
          </div>

          {/* Where the picture comes from, and a way to drop in a real one. */}
          {screenFormOpen ? (
            <form
              className="flex flex-col gap-2 rounded-[16px] border border-white/10 bg-surface-1 p-2.5 sm:flex-row sm:items-center"
              onSubmit={(event) => {
                event.preventDefault();
                const next = screenDraft.trim();
                setMediaError(false);
                setScreenUrl(next);
                setScreenFormOpen(false);
                try {
                  if (next) window.localStorage.setItem(screenKey(live.id), next);
                  else window.localStorage.removeItem(screenKey(live.id));
                } catch {
                  /* private mode: the clip still plays for this visit */
                }
              }}
            >
              <input
                value={screenDraft}
                onChange={(event) => setScreenDraft(event.target.value)}
                placeholder="Paste an .mp4 / .webm link or a YouTube live URL"
                aria-label="Screen share source"
                className="h-9 min-w-0 flex-1 rounded-full border border-white/10 bg-black/30 px-3 text-[12px] text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-primary/50"
              />
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="submit"
                  className="h-9 rounded-full bg-primary px-3.5 text-[12px] font-bold text-primary-foreground"
                >
                  Use this
                </button>
                <button
                  type="button"
                  onClick={() => setScreenFormOpen(false)}
                  className="h-9 rounded-full border border-white/10 px-3 text-[12px] font-semibold text-muted-foreground"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center gap-2 rounded-[14px] border border-white/10 bg-surface-1 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                {screenUrl
                  ? live.screen?.credit ?? (screenYoutubeId ? "Your YouTube live" : "Your clip")
                  : "No screen source — the frame below is a placeholder"}
              </span>
              {screenUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setScreenUrl("");
                    setMediaError(false);
                    try {
                      window.localStorage.removeItem(screenKey(live.id));
                    } catch {
                      /* ignore */
                    }
                  }}
                  className="shrink-0 text-[11px] font-semibold text-muted-foreground underline-offset-2 hover:underline"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setScreenDraft(screenUrl);
                  setScreenFormOpen(true);
                }}
                className="shrink-0 rounded-full border border-white/15 px-2.5 py-1 text-[11px] font-semibold text-foreground"
              >
                {screenUrl ? "Change" : "Add real screen"}
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 rounded-[16px] border border-white/10 bg-surface-1 p-2.5">
            <button
              type="button"
              onClick={() => {
                nextId.current += 1;
                setLines((current) => [
                  ...current.slice(-23),
                  { id: nextId.current, user: "you", text: "say hi 👋", tint: "#c9ff3d", own: true },
                ]);
              }}
              className="h-10 flex-1 rounded-full bg-primary text-[13px] font-bold text-primary-foreground transition-transform duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            >
              Say hi to {live.name}
            </button>
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              aria-label="Share this live"
            >
              <Share2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              aria-label="Report this live"
            >
              <Flag className="h-4 w-4" />
            </button>
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Demo live — the clip is libre gameplay footage standing in for a real host, and the
            clock and chat are local. Point it at your own recording (or a live URL) with{" "}
            <span className="text-foreground/80">Add real screen</span>; it is kept in this browser
            and never uploaded.
          </p>
        </section>

        {/* Chat. */}
        <aside className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[18px] border border-white/10 bg-surface-1 lg:w-[300px] lg:flex-none">
          <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5">
            <RizzLiveIcon className="h-3.5 w-3.5 text-primary" />
            <span className="text-[12px] font-bold">Live chat</span>
            <span className="ml-auto text-[10px] font-semibold text-muted-foreground">
              {formatViewers(viewers)} here
            </span>
          </div>
          <div ref={scroller} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-2.5">
            {lines.map((line) => (
              <p key={line.id} className="text-[12px] leading-snug">
                <span
                  className={cn("font-semibold", line.own && "text-primary")}
                  style={line.own ? undefined : { color: line.tint }}
                >
                  {line.user}
                </span>
                <span className="text-muted-foreground">: </span>
                <span className="text-foreground/90">{line.text}</span>
              </p>
            ))}
          </div>
          <form
            className="flex items-center gap-1.5 border-t border-white/10 p-2"
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Say something…"
              maxLength={140}
              aria-label="Chat message"
              className="h-9 min-w-0 flex-1 rounded-full border border-white/10 bg-black/30 px-3 text-[12px] text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-primary/50"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              aria-label="Send message"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-transform duration-150 active:scale-95 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}
