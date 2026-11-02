import { useEffect, useMemo, useRef } from "react";
import { Sparkles } from "lucide-react";
import { CatEmoji } from "@/components/emoji/CatEmoji";
import { catNameForShortcode, type CatEmojiName } from "@/components/emoji/cat-emoji-manifest";
import { EmojiGlyph, UnicodeGlyph } from "@/components/emoji/EmojiGlyph";
import { customReactionId, useEmojiLookup, type EmojiRow } from "@/lib/emoji-shared";

/**
 * The super-reaction celebration: when someone sends a super reaction the RIZZ
 * cat leaps in over the post, wiggles, fires the emoji outward as sparks and
 * dashes off. Pure transform/opacity keyframes, ~2.3s, one-shot — no JS loop,
 * no timers past the unmount timeout, and it never blocks a tap
 * (pointer-events: none).
 */
export type SuperBurst = { key: string; seq: number };

const LIFETIME_MS = 2300;

/** Pick the sticker that matches the reaction's mood. */
function catForKey(key: string): CatEmojiName {
  // A pack shortcode (`:cat_happy:`) is the reaction itself — draw it.
  const direct = key.startsWith(":") ? catNameForShortcode(key) : null;
  if (direct) return direct;
  const k = key.toLowerCase();
  if (/[❤🩷💜🥰😍💔]/.test(k)) return "cat_happy";
  if (/[😂🤣😆]/.test(k)) return "cat_happy";
  if (/[🔥🚀😤]/.test(k)) return "cat_angry";
  if (/[😮😲😱]/.test(k)) return "cat_surprise";
  if (/[😎🆒]/.test(k)) return "cat_hm";
  if (/[😴🛌]/.test(k)) return "cat_sleepy";
  if (/[🤨🧐]/.test(k)) return "cat_hm";
  if (/[🎵🎶🎧]/.test(k)) return "cat_hm";
  if (/[🎮🏆]/.test(k)) return "cat_clap";
  if (/[😢😭]/.test(k)) return "cat_cry";
  if (/[👋✋]/.test(k)) return "cat_happy";
  if (/[🤔💭]/.test(k)) return "cat_hm";
  return "cat_hm";
}

type Spark = {
  x: number;
  y: number;
  size: number;
  delay: number;
  kind: "reaction" | "star";
};

function buildSparks(reactionCount: number): Spark[] {
  const total = 14;
  const sparks: Spark[] = [];
  for (let i = 0; i < total; i += 1) {
    const angle = (i / total) * Math.PI * 2 + Math.random() * 0.5;
    const distance = 96 + Math.random() * 84;
    sparks.push({
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance - 12,
      size: 14 + Math.random() * 12,
      delay: 60 + Math.random() * 420,
      kind: i < reactionCount ? "reaction" : "star",
    });
  }
  return sparks;
}

function BurstScene({ reactionKey }: { reactionKey: string }) {
  const id = customReactionId(reactionKey);
  const lookup = useEmojiLookup(id ? [id] : []);
  const emoji = id ? lookup.data?.find((row: EmojiRow) => row.id === id) : undefined;
  const sparks = useMemo(() => buildSparks(6), []);
  const cat = useMemo(() => catForKey(reactionKey), [reactionKey]);

  return (
    <div className="super-burst-scene pointer-events-none fixed inset-0 z-[90] grid place-items-center overflow-hidden">
      {/* Ambient glow */}
      <div
        className="super-burst-glow absolute h-64 w-64 rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, rgba(180,124,255,0.5), rgba(200,255,61,0.18) 55%, transparent 75%)",
        }}
      />
      {/* Expanding ring */}
      <div className="super-burst-ring absolute h-40 w-40 rounded-full border-2 border-[var(--super-violet)]" />
      {/* The RIZZ cat: the face keeps playing its own expression loop while the
          body bobs and the whole cat leaps in and out. Two transform layers,
          so the entrance/exit never fights the idle motion. */}
      <div className="super-burst-cat relative grid place-items-center">
        <div className="super-burst-cat-body relative grid place-items-center">
          <span className="super-burst-streak super-burst-streak--left" aria-hidden="true" />
          <span className="super-burst-streak super-burst-streak--right" aria-hidden="true" />
          {/* A super reaction is already a Purify-only send, so the celebration
              itself stays animated for every viewer. */}
          <CatEmoji name={cat} size={132} animate="loop" label="Super reaction" preview />
          <span className="absolute -bottom-3 grid h-11 w-11 place-items-center rounded-full border border-[var(--super-edge)] bg-[var(--super-ink)] shadow-[0_0_18px_var(--super-shadow)] backdrop-blur">
            {emoji ? (
              <EmojiGlyph emoji={emoji} shortcode={emoji.shortcode} className="h-7 w-7" />
            ) : (
              <UnicodeGlyph value={reactionKey} className="text-[26px]" size={26} />
            )}
          </span>
        </div>
      </div>
      {/* Label */}
      <span className="super-burst-label absolute top-[calc(50%+96px)] rounded-full border border-[var(--super-edge-soft)] bg-[var(--super-ink-soft)] px-3 py-1 text-[11px] font-semibold text-[var(--super-paper)] backdrop-blur">
        Super
      </span>
      {/* Sparks */}
      {sparks.map((spark, index) => (
        <span
          key={index}
          className="super-burst-spark absolute grid place-items-center"
          style={
            {
              "--sx": `${spark.x}px`,
              "--sy": `${spark.y}px`,
              animationDelay: `${spark.delay}ms`,
              fontSize: `${spark.size}px`,
            } as React.CSSProperties
          }
        >
          {spark.kind === "star" ? (
            <Sparkles className="h-[1em] w-[1em]" aria-hidden="true" />
          ) : emoji ? null : (
            <UnicodeGlyph value={reactionKey} className="text-[1.2em]" size={20} />
          )}
          {spark.kind === "reaction" && emoji ? (
            <EmojiGlyph emoji={emoji} shortcode={emoji.shortcode} className="h-[1.2em] w-[1.2em]" />
          ) : null}
        </span>
      ))}
    </div>
  );
}

export function SuperReactionBurst({
  burst,
  onDone,
}: {
  burst: SuperBurst | null;
  onDone: () => void;
}) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (!burst) return;
    const timer = window.setTimeout(() => doneRef.current(), LIFETIME_MS);
    return () => window.clearTimeout(timer);
  }, [burst?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!burst) return null;
  return <BurstScene key={burst.seq} reactionKey={burst.key} />;
}
