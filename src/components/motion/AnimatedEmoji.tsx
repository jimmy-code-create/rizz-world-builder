import { CatEmoji } from "@/components/emoji/CatEmoji";
import { catNameForShortcode } from "@/components/emoji/cat-emoji-manifest";
import { FluentEmoji } from "@/components/emoji/FluentEmoji";
import { cn } from "@/lib/utils";

/**
 * One emoji, with a little life in it.
 *
 * Unicode emoji and the app's cat emoji both come through here, so a reaction
 * looks the same in chat, under a post and in a comment thread. The motion is
 * CSS-only — a wobble on hover, a spring pop when a reaction appears, a slow
 * bob when someone asks for it — so there is no animation library in the
 * bundle and nothing to decode.
 *
 * `popKey` remounts the glyph, which is what replays the `pop` animation when
 * the same reaction is tapped again. Reduced motion (system or the app's own
 * switch) turns every keyframe off in `styles.css`.
 */
export type EmojiMotion = "none" | "hover" | "pop" | "loop";

export function AnimatedEmoji({
  emoji,
  size = 18,
  motion = "hover",
  className,
  label,
  popKey,
}: {
  emoji: string;
  /** Glyph size in px. Cat emoji are drawn at this size; unicode is font-size. */
  size?: number;
  motion?: EmojiMotion;
  className?: string;
  /** Give this when the emoji carries meaning on its own; omit inside labelled buttons. */
  label?: string;
  /** Change this to replay the pop. */
  popKey?: string | number;
}) {
  const cat = emoji.startsWith(":") ? catNameForShortcode(emoji) : null;
  const catMotion =
    motion === "loop" ? "loop" : motion === "hover" ? "hover" : motion === "pop" ? "once" : "static";

  return (
    <span
      className={cn("motion-emoji", `motion-emoji--${motion}`, className)}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <span key={popKey} className="motion-emoji__body">
        {cat ? (
          <CatEmoji name={cat} size={size} animate={catMotion} />
        ) : (
          <FluentEmoji glyph={emoji} size={size} className="motion-emoji__glyph" />
        )}
      </span>
    </span>
  );
}
