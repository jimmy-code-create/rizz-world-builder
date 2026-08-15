import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronsRight, Play, Pause, Heart, RotateCcw } from "lucide-react";
import { FullScreenLayer } from "@/components/FullScreenLayer";

export type StoryLine = { idx: number; speaker: string; body: string };
export type ChatStory = {
  id: string;
  title: string;
  hook: string;
  emoji: string;
  category: string;
  gradient: string;
  them_name: string;
  me_name: string;
};

/**
 * Tap-to-advance chat story reader: messages land one by one with a typing
 * bubble in between, like reading someone else's conversation.
 */
export function ChatStoryPlayer({
  story,
  lines,
  liked,
  onLike,
  onClose,
}: {
  story: ChatStory;
  lines: StoryLine[];
  liked: boolean;
  onLike: () => void;
  onClose: () => void;
}) {
  const [shown, setShown] = useState(1);
  const [typing, setTyping] = useState(false);
  const [auto, setAuto] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  const done = shown >= lines.length;

  const advance = () => {
    if (typing || done) return;
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      setShown((s) => Math.min(s + 1, lines.length));
    }, 520);
  };

  useEffect(() => {
    if (!auto || done || typing) return;
    const t = window.setTimeout(advance, 900);
    return () => window.clearTimeout(t);
  }, [auto, done, typing, shown]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [shown, typing]);

  const visible = lines.slice(0, shown);

  return (
    <FullScreenLayer open>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[130] flex flex-col bg-background"
      >
        {/* Header */}
        <div
          className="relative shrink-0 px-4 pb-4"
          style={{ background: story.gradient, paddingTop: "calc(env(safe-area-inset-top,0px) + 14px)" }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              aria-label="Close story"
              className="h-9 w-9 rounded-full glass-strong flex items-center justify-center shrink-0"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="h-10 w-10 rounded-full bg-background/25 backdrop-blur flex items-center justify-center text-xl shrink-0">
              {story.emoji}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold truncate">{story.them_name}</p>
              <p className="text-[11px] opacity-80 truncate">{story.title}</p>
            </div>
            <button
              onClick={() => setAuto((a) => !a)}
              aria-label={auto ? "Pause autoplay" : "Play autoplay"}
              className="h-9 w-9 rounded-full glass-strong flex items-center justify-center shrink-0"
            >
              {auto ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
          </div>
          <div className="mt-3 h-1 rounded-full bg-background/25 overflow-hidden">
            <div
              className="h-full bg-background/90 transition-all duration-300"
              style={{ width: `${Math.round((shown / Math.max(lines.length, 1)) * 100)}%` }}
            />
          </div>
        </div>

        {/* Transcript — tap anywhere to advance */}
        <button
          onClick={advance}
          className="flex-1 overflow-y-auto text-left px-3 py-4 space-y-2 cursor-pointer"
        >
          <AnimatePresence initial={false}>
            {visible.map((l) => (
              <motion.div
                key={l.idx}
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 420, damping: 30 }}
                className={
                  l.speaker === "narrator"
                    ? "flex justify-center"
                    : l.speaker === "me"
                      ? "flex justify-end"
                      : "flex justify-start"
                }
              >
                {l.speaker === "narrator" ? (
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground px-3 py-1 rounded-full glass">
                    {l.body}
                  </span>
                ) : (
                  <div
                    className={`max-w-[82%] px-3.5 py-2 text-[15px] leading-snug whitespace-pre-wrap break-words rounded-2xl ${
                      l.speaker === "me"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "glass-strong rounded-bl-md"
                    }`}
                  >
                    {l.body}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {typing && (
            <div className={lines[shown]?.speaker === "me" ? "flex justify-end" : "flex justify-start"}>
              <div className="glass-strong rounded-2xl px-4 py-3 flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce"
                    style={{ animationDelay: `${i * 120}ms` }}
                  />
                ))}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </button>

        {/* Footer */}
        <div
          className="shrink-0 border-t border-white/5 glass-strong px-4 pt-3 flex items-center gap-2"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom,0px) + 12px)" }}
        >
          {done ? (
            <>
              <button
                onClick={() => setShown(1)}
                className="h-11 flex-1 rounded-full glass flex items-center justify-center gap-2 text-sm font-semibold"
              >
                <RotateCcw className="h-4 w-4" /> Replay
              </button>
              <button
                onClick={onLike}
                className={`h-11 flex-1 rounded-full flex items-center justify-center gap-2 text-sm font-semibold ${
                  liked ? "bg-primary text-primary-foreground" : "glass"
                }`}
              >
                <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} /> {liked ? "Liked" : "Like"}
              </button>
            </>
          ) : (
            <button
              onClick={advance}
              className="h-11 w-full rounded-full bg-gradient-primary flex items-center justify-center gap-2 text-sm font-bold"
            >
              Tap for next <ChevronsRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </motion.div>
    </FullScreenLayer>
  );
}