import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Maximize2, Minimize2, Pause, RotateCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

type RizzBrowserViewProps = {
  title: string;
  icon?: string;
  url: string;
  paused?: boolean;
  className?: string;
  onLoaded?: () => void;
  onReload?: () => void;
};

/** Icon is a real game logo URL when it looks like one, otherwise an emoji. */
function GameIcon({ icon, size }: { icon?: string; size: string }) {
  const [broken, setBroken] = useState(false);
  const isUrl = !!icon && /^https?:\/\//i.test(icon);
  return (
    <span className={`grid ${size} shrink-0 place-items-center overflow-hidden rounded-xl border border-primary/25 bg-primary/15`}>
      {isUrl && !broken ? (
        <img
          src={icon}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="text-base leading-none">{isUrl ? "🎮" : (icon ?? "🎮")}</span>
      )}
    </span>
  );
}

/**
 * RIZZ browser: the game stage used by the GAME BOT overlay.
 *
 * RIZZ chrome (lime dots, real game logo), cat-mark loader on near-black, a
 * paused overlay, a blocked-embed fallback, a **rotate** toggle (portrait
 * phones can turn landscape games 90° — with an orientation-lock attempt when
 * fullscreen), and Discord-style fullscreen that puts the game on the whole
 * screen while the chrome bar stays available to exit.
 */
export function RizzBrowserView({
  title,
  icon,
  url,
  paused = false,
  className = "",
  onLoaded,
  onReload,
}: RizzBrowserViewProps) {
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [rotated, setRotated] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Every new URL gets a fresh loading state. If the frame never fires `load`
  // (X-Frame-Options / CSP), fall back to an "open in new tab" card instead
  // of hanging on the spinner forever.
  useEffect(() => {
    setLoading(true);
    setBlocked(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setLoading((still) => {
        if (still) setBlocked(true);
        return false;
      });
    }, 15000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [url]);

  // Track real (browser) fullscreen so the chrome button flips back on Esc.
  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = async () => {
    const el = stageRef.current as (HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> }) | null;
    try {
      if (document.fullscreenElement) {
        const orientation = (screen as Screen & { orientation?: { unlock?: () => void } }).orientation;
        try {
          orientation?.unlock?.();
        } catch {
          /* not supported */
        }
        await document.exitFullscreen();
      } else if (el?.requestFullscreen) {
        await el.requestFullscreen();
      } else if (el?.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
      }
    } catch {
      // iOS Safari on iPhone has no element fullscreen; the in-app stage still works.
    }
  };

  // Auto-rotate: entering fullscreen on a portrait screen while playing turns
  // the game sideways and asks the OS to lock landscape (progressive; ignored
  // where unsupported).
  const toggleRotate = async () => {
    const next = !rotated;
    setRotated(next);
    try {
      const orientation = (screen as Screen & {
        orientation?: { lock?: (o: string) => Promise<void>; unlock?: () => void };
      }).orientation;
      if (next && document.fullscreenElement && orientation?.lock) {
        await orientation.lock("landscape");
      } else if (!next) {
        orientation?.unlock?.();
      }
    } catch {
      /* orientation lock is best-effort */
    }
  };

  const reload = () => {
    setLoading(true);
    setBlocked(false);
    if (iframeRef.current) iframeRef.current.src = url;
    onReload?.();
  };

  return (
    <div
      ref={stageRef}
      className={`flex flex-col overflow-hidden border border-primary/20 bg-black/70 ${
        fullscreen ? "h-dvh rounded-none border-0" : "h-full rounded-xl"
      } ${className}`}
    >
      {/* RIZZ browser chrome */}
      <div className="flex shrink-0 items-center gap-2 border-b border-primary/15 bg-[#0d0d10] px-3 py-2">
        <GameIcon icon={icon} size="h-7 w-7" />
        <p className="min-w-0 flex-1 truncate font-display text-xs font-bold tracking-wide text-foreground">
          {title}
        </p>
        <button
          type="button"
          onClick={() => void toggleRotate()}
          aria-label={rotated ? "Rotate back to portrait" : "Rotate to landscape"}
          aria-pressed={rotated}
          title={rotated ? "Rotate back" : "Rotate screen"}
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors hover:bg-white/10 ${
            rotated ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {rotated ? <RotateCcw className="h-3.5 w-3.5" /> : <RotateCw className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => void toggleFullscreen()}
          aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
        >
          {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
        <span className="flex shrink-0 items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-primary/25" />
          <span className="h-2 w-2 rounded-full bg-primary/25" />
          <span className="h-2 w-2 rounded-full bg-primary" />
        </span>
      </div>

      {/* Game area — a size container, so the rotated layer can swap cq units */}
      <div
        data-rizz-game-surface
        className="relative min-h-0 flex-1 overflow-hidden bg-[#0b0b0c] [container-type:size]"
      >
        <div
          className={
            rotated
              ? "absolute left-1/2 top-1/2 h-[100cqw] w-[100cqh] -translate-x-1/2 -translate-y-1/2 rotate-90"
              : "absolute inset-0"
          }
        >
          {/* The frame stays mounted while paused/minimized so resuming picks up
              the same session instead of reloading the game. */}
          {!blocked && (
            <iframe
              ref={iframeRef}
              src={url}
              title={title}
              className={`h-full w-full border-0 bg-[#0b0b0c] ${
                paused ? "pointer-events-none opacity-0" : ""
              }`}
              allow="fullscreen; clipboard-write; autoplay; gamepad; microphone; pointer-lock"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-pointer-lock"
              onLoad={() => {
                setLoading(false);
                if (timer.current) clearTimeout(timer.current);
                onLoaded?.();
              }}
            />
          )}
        </div>

        {/* RIZZ loading */}
        {loading && !blocked && !paused && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-[#0b0b0c]">
            <div className="flex flex-col items-center gap-3">
              <img
                src="/brand/rizz-cat-logo.svg"
                alt=""
                aria-hidden
                className="h-10 w-10 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <div aria-hidden className="h-1 w-32 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-1/2 animate-shimmer-sweep rounded-full bg-primary" />
              </div>
              <p className="font-display text-[11px] tracking-wide text-muted-foreground">
                Loading {title} in RIZZ browser…
              </p>
            </div>
          </div>
        )}

        {/* Paused overlay */}
        {paused && !blocked && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-black/75 backdrop-blur-[1px]">
            <div className="flex flex-col items-center gap-2 px-6 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-full border border-primary/40 bg-primary/15">
                <Pause className="h-5 w-5 text-primary" />
              </span>
              <p className="font-display text-sm font-bold">Game paused</p>
              <p className="text-[11px] text-muted-foreground">
                Resume from GAME BOT to keep playing together.
              </p>
            </div>
          </div>
        )}

        {/* Blocked embed */}
        {blocked && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-[#0b0b0c] p-6 text-center">
            <div className="flex max-w-xs flex-col items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-400/10 text-amber-200">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <p className="font-display text-sm font-bold">{title} blocks embedding</p>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                This one refuses to run inside an iframe right now. Open it in a new tab — the
                GAME BOT session stays in sync for everyone in the channel.
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
                  className="h-9 gap-2 bg-primary text-primary-foreground"
                >
                  Open in new tab
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={reload}
                  className="h-9 gap-2 border-white/10"
                >
                  <RotateCw className="h-3.5 w-3.5" /> Retry
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
