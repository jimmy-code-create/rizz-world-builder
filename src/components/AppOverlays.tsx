import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowUp, WifiOff, Wifi, Download, X, Focus } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const ROUTES: Record<string, string> = {
  f: "/feed", r: "/reels", e: "/explore", d: "/dms", n: "/notifications",
  b: "/bookmarks", g: "/groups", c: "/channels", p: "/effects", t: "/leaderboard",
  s: "/settings",
};

const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: "⌘K  /  /", label: "Open command palette" },
  { keys: "?", label: "Show this help" },
  { keys: "shift + F", label: "Toggle focus mode" },
  { keys: "g then f", label: "Go to Feed" },
  { keys: "g then r", label: "Go to Reels" },
  { keys: "g then e", label: "Go to Explore" },
  { keys: "g then d", label: "Go to Messages" },
  { keys: "g then n", label: "Go to Notifications" },
  { keys: "g then b", label: "Go to Saved" },
  { keys: "g then g", label: "Go to Groups" },
  { keys: "g then s", label: "Go to Settings" },
  { keys: ".", label: "Scroll to top" },
  { keys: "esc", label: "Close dialogs" },
];

export function AppOverlays() {
  const nav = useNavigate();
  const [helpOpen, setHelpOpen] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [progress, setProgress] = useState(0);
  const [installEvt, setInstallEvt] = useState<any>(null);
  const [installDismissed, setInstallDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("rizz:install-dismissed") === "1";
  });
  const [focusMode, setFocusMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("rizz:focus-mode") === "1";
  });

  // Apply focus mode class + persist
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("focus-mode", focusMode);
    localStorage.setItem("rizz:focus-mode", focusMode ? "1" : "0");
  }, [focusMode]);

  // Vim-style "g then x" navigation + ? help + . scroll-to-top
  useEffect(() => {
    let waitingG = false;
    let timer: number | null = null;
    const isTypingTarget = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      const k = e.key.toLowerCase();
      if (waitingG && ROUTES[k]) {
        e.preventDefault();
        waitingG = false;
        if (timer) window.clearTimeout(timer);
        nav({ to: ROUTES[k] });
        return;
      }
      if (k === "g") {
        waitingG = true;
        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(() => { waitingG = false; }, 1200);
        return;
      }
      if (e.key === "?") { e.preventDefault(); setHelpOpen(true); return; }
      if (k === ".") { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
      if (e.shiftKey && k === "f") {
        e.preventDefault();
        setFocusMode((v) => {
          const next = !v;
          toast.success(next ? "Focus mode on" : "Focus mode off", { icon: <Focus className="h-4 w-4" /> });
          return next;
        });
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); if (timer) window.clearTimeout(timer); };
  }, [nav]);

  // Scroll-to-top button
  useEffect(() => {
    const onScroll = () => {
      setShowTop(window.scrollY > 600);
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setProgress(max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Online/offline indicator
  useEffect(() => {
    const goOnline = () => { setOnline(true); toast.success("Back online", { icon: <Wifi className="h-4 w-4" /> }); };
    const goOffline = () => { setOnline(false); toast.error("You're offline", { icon: <WifiOff className="h-4 w-4" /> }); };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => { window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); };
  }, []);

  // PWA install prompt capture
  useEffect(() => {
    const onPrompt = (e: any) => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener("beforeinstallprompt", onPrompt as any);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt as any);
  }, []);

  return (
    <>
      {/* Scroll progress bar */}
      <div
        className="fixed top-0 left-0 right-0 h-0.5 z-50 pointer-events-none bg-gradient-primary origin-left transition-transform duration-100"
        style={{ transform: `scaleX(${progress / 100})` }}
        aria-hidden
      />

      <AnimatePresence>
        {!online && (
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            className="fixed top-2 left-1/2 -translate-x-1/2 z-50 glass-strong border border-amber-500/30 rounded-full px-3 py-1.5 text-xs font-medium flex items-center gap-2 shadow-glow"
          >
            <WifiOff className="h-3.5 w-3.5 text-amber-400" /> You're offline
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {installEvt && !installDismissed && (
          <motion.div
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
            className="fixed bottom-24 md:bottom-6 right-4 z-40 glass-strong border border-white/10 rounded-2xl p-3 pr-2 shadow-glow flex items-center gap-3 max-w-xs"
          >
            <div className="h-9 w-9 rounded-xl bg-gradient-primary grid place-items-center"><Download className="h-4 w-4" /></div>
            <div className="text-xs flex-1">
              <p className="font-semibold">Install RIZZ</p>
              <p className="text-muted-foreground">Get the app on your device.</p>
            </div>
            <button
              onClick={async () => { await installEvt.prompt?.(); setInstallEvt(null); }}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-gradient-primary"
            >Install</button>
            <button
              onClick={() => { setInstallDismissed(true); localStorage.setItem("rizz:install-dismissed","1"); }}
              className="h-7 w-7 grid place-items-center rounded-full hover:bg-white/5" aria-label="Dismiss"
            ><X className="h-3.5 w-3.5" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed bottom-24 md:bottom-6 left-4 md:left-72 z-30 h-10 w-10 rounded-full glass-strong border border-white/10 grid place-items-center shadow-glow active:scale-95"
            aria-label="Scroll to top"
          >
            <ArrowUp className="h-4 w-4" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Focus mode toggle — bottom right on desktop */}
      <button
        onClick={() => setFocusMode((v) => !v)}
        className={`hidden md:grid fixed bottom-6 right-6 z-30 h-10 w-10 rounded-full glass-strong border place-items-center shadow-glow active:scale-95 transition-colors ${focusMode ? "border-[var(--rizz-pink)] text-[var(--rizz-pink)]" : "border-white/10"}`}
        aria-label="Toggle focus mode"
        title="Focus mode (shift+F)"
      >
        <Focus className="h-4 w-4" />
      </button>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="glass-strong border-white/10 max-w-md">
          <DialogTitle className="font-display text-xl">Keyboard shortcuts</DialogTitle>
          <DialogDescription>Move around RIZZ at the speed of thought.</DialogDescription>
          <ul className="divide-y divide-white/5 text-sm mt-2">
            {SHORTCUTS.map((s) => (
              <li key={s.label} className="flex items-center justify-between py-2">
                <span className="text-muted-foreground">{s.label}</span>
                <kbd className="font-mono text-[11px] glass border border-white/10 rounded px-2 py-0.5">{s.keys}</kbd>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}