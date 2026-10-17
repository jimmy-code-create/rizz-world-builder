import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Maximize2, Minimize2, Pause, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type RizzBrowserViewProps = {
  title: string;
  icon?: string;
  url: string;
  paused?: boolean;
  onLoaded?: () => void;
  onReload?: () => void;
  compact?: boolean;
};

/**
 * RIZZ browser: an iframe stage with RIZZ-style loading (cat mark + lime
 * progress bar on near-black), a paused overlay, a graceful error state, and
 * Discord-style fullscreen that puts the game on the whole screen with the
 * chrome bar still available to exit.
 */
export function RizzBrowserView({
  title,
  icon,
  url,
  paused = false,
  onLoaded,
  onReload,
  compact = false,
}: RizzBrowserViewProps) {
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
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
    }, 12000);
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

  const reload = () => {
    setLoading(true);
    setBlocked(false);
    if (iframeRef.current) {
      iframeRef.current.src = url;
    }
    onReload?.();
  };

  return (
    <div
      ref={stageRef}
      className={`overflow-hidden rounded-xl border border-white/10 bg-black/60 ${
        fullscreen ? "flex h-dvh flex-col rounded-none border-0" : ""
      }`}
    >
      {/* Browser chrome */}
      <div className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-white/[0.03] px-3 py-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/15 text-base">
          {icon ?? "🎮"}
        </span>
        <p className="min-w-0 flex-1 truncate text-xs font-semibold">{title}</p>
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
          <span className="h-2 w-2 rounded-full bg-white/15" />
          <span className="h-2 w-2 rounded-full bg-white/15" />
          <span className="h-2 w-2 rounded-full bg-[#c8ff3d]/70" />
        </span>
      </div>

      <div
        className={`relative bg-[#0b0b0c] ${fullscreen ? "min-h-0 flex-1" : ""}`}
        style={fullscreen ? undefined : { paddingBottom: compact ? "56.25%" : "62%" }}
      >
        {/* RIZZ loading */}
        {loading && !blocked && (
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
                <div className="h-full w-1/2 rounded-full bg-[#c8ff3d] animate-shimmer-sweep" />
              </div>
              <p className="text-[11px] text-muted-foreground">Loading {title} in RIZZ browser…</p>
            </div>
          </div>
        )}

        {/* Paused overlay hides the frame so audio/visuals stop demanding attention */}
        {paused && !blocked && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-black/70 backdrop-blur-[1px]">
            <div className="flex flex-col items-center gap-2 px-6 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-full border border-primary/40 bg-primary/15">
                <Pause className="h-5 w-5 text-primary" />
              </span>
              <p className="text-sm font-bold">Game paused</p>
              <p className="text-[11px] text-muted-foreground">
                Resume from GAME BOT to keep playing together.
              </p>
            </div>
          </div>
        )}

        {blocked ? (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <div className="flex max-w-xs flex-col items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-400/10 text-amber-200">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <p className="text-sm font-bold">{title} blocks embedding</p>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Some games refuse to run inside an iframe. Open it in a new tab — the GAME BOT
                state stays in sync for everyone in the channel.
              </p>
              <Button
                type="button"
                size="sm"
                onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
                className="h-9 gap-2 bg-primary text-primary-foreground"
              >
                Open {title} in new tab
              </Button>
            </div>
          </div>
        ) : (
          !paused && (
            <iframe
              ref={iframeRef}
              src={url}
              title={title}
              className="absolute inset-0 h-full w-full"
              allow="fullscreen; clipboard-write; autoplay; gamepad; microphone"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-pointer-lock"
              onLoad={() => {
                setLoading(false);
                if (timer.current) clearTimeout(timer.current);
                onLoaded?.();
              }}
            />
          )
        )}

        {/* Paused keeps a lightweight frame parked so resume is instant */}
        {paused && !blocked && (
          <iframe
            ref={iframeRef}
            src="about:blank"
            title={`${title} (paused)`}
            className="absolute inset-0 h-full w-full opacity-0"
            tabIndex={-1}
            aria-hidden
          />
        )}
      </div>

      {blocked && (
        <div className="flex shrink-0 items-center justify-center border-t border-white/10 bg-white/[0.02] px-3 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={reload}
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCw className="h-3.5 w-3.5" /> Retry embed
          </Button>
        </div>
      )}
    </div>
  );
}
