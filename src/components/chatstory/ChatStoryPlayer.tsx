import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronsRight, Play, Pause, Heart, RotateCcw, GitBranch } from "lucide-react";
import { FullScreenLayer } from "@/components/FullScreenLayer";

export type StoryLine = {
  idx: number;
  speaker: string;
  body: string;
  next_idx?: number | null;
  chapter?: string | null;
};
export type StoryChoice = {
  at_idx: number;
  position: number;
  label: string;
  reply_body: string;
  goto_idx: number;
};
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

type Bubble = { key: string; speaker: string; body: string };

/**
 * Tap-to-advance chat story reader with branching chapters.
 *
 * Playback walks a path of line indices rather than a simple counter: a line
 * may declare `next_idx` to jump to another chapter, and a story may offer
 * viewer replies at certain indices (`choices`). Picking a reply appends it as
 * your own bubble and continues from that branch's `goto_idx`.
 */
export function ChatStoryPlayer({
  story,
  lines,
  choices = [],
  liked,
  onLike,
  onClose,
}: {
  story: ChatStory;
  lines: StoryLine[];
  choices?: StoryChoice[];
  liked: boolean;
  onLike: () => void;
  onClose: () => void;
}) {
  const byIdx = useMemo(() => new Map(lines.map((l) => [l.idx, l])), [lines]);
  const sorted = useMemo(() => [...lines].sort((a, b) => a.idx - b.idx), [lines]);
  const first = sorted[0]?.idx;

  const choicesAt = useMemo(() => {
    const m = new Map<number, StoryChoice[]>();
    for (const c of choices) {
      const arr = m.get(c.at_idx) ?? [];
      arr.push(c);
      m.set(c.at_idx, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.position - b.position);
    return m;
  }, [choices]);

  /** Next index after `idx`: explicit jump, else the next line in the same chapter block. */
  const nextOf = (idx: number): number | null => {
    const line = byIdx.get(idx);
    if (line?.next_idx != null) return line.next_idx;
    const pos = sorted.findIndex((l) => l.idx === idx);
    const nxt = sorted[pos + 1];
    if (!nxt) return null;
    return Math.floor(nxt.idx / 100) === Math.floor(idx / 100) ? nxt.idx : null;
  };

  const [path, setPath] = useState<Bubble[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [typing, setTyping] = useState(false);
  const [auto, setAuto] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  const reset = () => {
    if (first == null) return;
    const l = byIdx.get(first)!;
    setPath([{ key: `l-${first}`, speaker: l.speaker, body: l.body }]);
    setCursor(first);
    setPicked(new Set());
  };

  useEffect(() => { reset(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [story.id, first]);

  const pending = cursor != null && !picked.has(cursor) ? (choicesAt.get(cursor) ?? []) : [];
  const nextIdx = cursor == null ? null : nextOf(cursor);
  const done = pending.length === 0 && nextIdx == null;
  const nextSpeaker = nextIdx != null ? byIdx.get(nextIdx)?.speaker : undefined;
  const total = sorted.length;

  const advance = () => {
    if (typing || done || pending.length > 0 || nextIdx == null) return;
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      const l = byIdx.get(nextIdx);
      if (!l) return;
      setPath((p) => [...p, { key: `l-${nextIdx}-${p.length}`, speaker: l.speaker, body: l.body }]);
      setCursor(nextIdx);
    }, 520);
  };

  const choose = (c: StoryChoice) => {
    if (cursor == null) return;
    setPicked((s) => new Set(s).add(cursor));
    const target = byIdx.get(c.goto_idx);
    setPath((p) => [
      ...p,
      { key: `r-${c.at_idx}-${c.position}-${p.length}`, speaker: "me", body: c.reply_body },
      ...(target ? [{ key: `l-${c.goto_idx}-${p.length + 1}`, speaker: target.speaker, body: target.body }] : []),
    ]);
    if (target) setCursor(c.goto_idx);
  };

  useEffect(() => {
    if (!auto || done || typing || pending.length > 0) return;
    const t = window.setTimeout(advance, 900);
    return () => window.clearTimeout(t);
  }, [auto, done, typing, cursor, pending.length]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [path.length, typing, pending.length]);

  const visible = path;
  const chapter = cursor != null ? byIdx.get(cursor)?.chapter : null;

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