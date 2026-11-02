import { useEffect, useRef, useState } from "react";
import { usePurify } from "@/lib/purify";
import { catImageForName, type CatEmojiName } from "./cat-emoji-manifest";

/**
 * <CatEmoji name size animate preview />
 *
 * The RIZZ cat pack: nine stickers served from `/emoji/rizz/`. Every face is
 * one PNG, so the same sticker draws in a reaction row, a badge, a game card,
 * a status bubble and a super-reaction burst without being re-drawn by hand.
 *
 * animate:
 * - false / "static": a still sticker (also what free accounts get)
 * - "hover": animates only on hover/press/focus (picker grids)
 * - "once": plays once 600ms (reaction just added)
 * - "loop": continuous loop (budgeted: max 3 running at a time, paused
 *   offscreen — and only that mode pays for an observer)
 *
 * `preview` forces the animation through for demo surfaces (the Purify page
 * shows what a member gets). Without it, animated faces are a Purify perk:
 * free accounts keep the same nine stickers, still.
 */

// Global loop budget: at most 3 looping emojis on screen.
let liveLoops = 0;
const loopWaiters = new Set<() => void>();
function claimLoopSlot(): boolean {
  if (liveLoops < 3) {
    liveLoops += 1;
    return true;
  }
  return false;
}
function releaseLoopSlot() {
  liveLoops = Math.max(0, liveLoops - 1);
  const next = [...loopWaiters][0];
  if (next) {
    loopWaiters.delete(next);
    next();
  }
}

export function CatEmoji({
  name,
  size = 20,
  animate = false,
  className = "",
  label,
  preview = false,
}: {
  name: CatEmojiName;
  size?: 16 | 20 | 24 | 32 | number;
  animate?: boolean | "hover" | "once" | "loop" | "static";
  className?: string;
  label?: string;
  /** Draw the animation even when the viewer has no active Purify. */
  preview?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(true);
  const [loopOn, setLoopOn] = useState(false);
  const { active } = usePurify();
  const entitled = preview || active;
  const requested: "static" | "hover" | "once" | "loop" =
    animate === true ? "loop" : animate === false ? "static" : animate;
  // Animated faces are the Purify perk; everyone keeps the still pack.
  const mode: "static" | "hover" | "once" | "loop" = entitled ? requested : "static";
  const src = catImageForName(name);

  // Only a running loop is worth watching for visibility: a hover or one-shot
  // animation is paused or finished anyway, and a picker of nine stickers used
  // to cost nine observers for nothing.
  useEffect(() => {
    const el = ref.current;
    if (!el || mode !== "loop") return;
    const io = new IntersectionObserver(
      (entries) => setVisible(entries[0]?.isIntersecting ?? true),
      { threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mode]);

  // Loop budget.
  useEffect(() => {
    if (mode !== "loop" || !visible) {
      setLoopOn(false);
      return;
    }
    let claimed = false;
    let cancelled = false;
    const tryClaim = () => {
      if (cancelled) return;
      if (claimLoopSlot()) {
        claimed = true;
        setLoopOn(true);
      } else {
        const retry = () => tryClaim();
        loopWaiters.add(retry);
        return () => loopWaiters.delete(retry);
      }
    };
    const cleanup = tryClaim();
    return () => {
      cancelled = true;
      if (typeof cleanup === "function") cleanup();
      if (claimed) {
        releaseLoopSlot();
        setLoopOn(false);
      }
    };
  }, [mode, visible]);

  const cls = [
    "cat-emoji",
    `cat-emoji--${name}`,
    mode !== "static" ? "cat-emoji--anim" : "",
    mode === "hover" ? "cat-emoji--hover" : "",
    mode === "once" ? "cat-emoji--once" : "",
    mode === "loop" && loopOn && visible ? "cat-emoji--loop" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      ref={ref}
      role="img"
      aria-label={label ?? name.replace(/_/g, " ")}
      className={cls}
      style={{ width: size, height: size, display: "inline-grid", placeItems: "center", flex: "none" }}
    >
      <img
        src={src}
        alt=""
        draggable={false}
        decoding="async"
        className="cat-emoji__img"
      />
    </span>
  );
}
