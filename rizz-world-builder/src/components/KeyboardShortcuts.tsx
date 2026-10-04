import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: "g f", label: "Go to Feed" },
  { keys: "g r", label: "Go to Reels" },
  { keys: "g e", label: "Go to Explore" },
  { keys: "g d", label: "Go to DMs" },
  { keys: "g n", label: "Go to Notifications" },
  { keys: "g p", label: "Go to my Profile" },
  { keys: "g s", label: "Go to Settings" },
  { keys: "n", label: "Compose new post (open dialog)" },
  { keys: "/", label: "Open search" },
  { keys: "⌘K", label: "Command palette" },
  { keys: "?", label: "Show this help" },
  { keys: "Esc", label: "Close dialogs" },
];

function isTyping(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}

export function KeyboardShortcuts({ profileUsername }: { profileUsername?: string | null }) {
  const nav = useNavigate();
  const [helpOpen, setHelpOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    let pendingTimer: number | null = null;
    const onKey = (e: KeyboardEvent) => {
      if (isTyping()) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen(true);
        return;
      }
      if (e.key === "n" && !pending) {
        e.preventDefault();
        // Trigger a global event the AppShell composer can listen to
        window.dispatchEvent(new CustomEvent("rizz:new-post"));
        return;
      }
      if (e.key === "g") {
        setPending("g");
        if (pendingTimer) window.clearTimeout(pendingTimer);
        pendingTimer = window.setTimeout(() => setPending(null), 900);
        return;
      }
      if (pending === "g") {
        setPending(null);
        if (pendingTimer) window.clearTimeout(pendingTimer);
        switch (e.key) {
          case "f": nav({ to: "/feed" }); break;
          case "r": nav({ to: "/reels" }); break;
          case "e": nav({ to: "/explore" }); break;
          case "d": nav({ to: "/dms" }); break;
          case "n": nav({ to: "/notifications" }); break;
          case "s": nav({ to: "/settings" }); break;
          case "p":
            if (profileUsername) nav({ to: "/u/$username", params: { username: profileUsername } });
            break;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (pendingTimer) window.clearTimeout(pendingTimer);
    };
  }, [nav, pending, profileUsername]);

  return (
    <>
      {pending === "g" && (
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 glass-strong border border-white/10 rounded-xl px-3 py-1.5 text-xs font-medium pointer-events-none shadow-glow">
          <kbd className="font-mono">g</kbd> + …
        </div>
      )}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="glass-strong border-white/10 max-w-md">
          <DialogTitle className="font-display">Keyboard shortcuts</DialogTitle>
          <DialogDescription>Move around faster.</DialogDescription>
          <ul className="divide-y divide-white/5">
            {SHORTCUTS.map((s) => (
              <li key={s.keys} className="flex items-center justify-between py-2 text-sm">
                <span>{s.label}</span>
                <kbd className="px-2 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-xs">{s.keys}</kbd>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}