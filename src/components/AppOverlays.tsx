import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowUp, WifiOff, Wifi } from "lucide-react";
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
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); if (timer) window.clearTimeout(timer); };
  }, [nav]);

  // Scroll-to-top button
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
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

  return (
    <>
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