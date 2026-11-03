import { useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { customReactionId, emojiMapOf, emojiReactionKey, useEmojiLookup } from "@/lib/emoji-shared";
import { EmojiGlyph, UnicodeGlyph } from "@/components/emoji/EmojiGlyph";
import { EmojiPicker, type EmojiPick } from "@/components/emoji/EmojiPicker";
import { AnimatedCount } from "@/components/ui/animated-count";
import type { SharedEmoji } from "@/lib/emoji-shared";

export type SharedReactionGroup = {
  /** A unicode glyph, or `ce:<emoji id>`. */
  key: string;
  count: number;
  mine: boolean;
  /** How many of the count were sent as Purify super reactions. */
  superCount?: number;
  mineSuper?: boolean;
};

/**
 * Every super reaction wears its own colour.
 *
 * The hue comes from the reaction key, so one cat is always aqua and another
 * always rose — the same way a chat tag keeps its colour — and a row of two
 * supers reads as two different reactions instead of one violet block.
 */
function superHue(key: string) {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) % 360;
  }
  return hash;
}

/**
 * One pill row for the whole app.
 *
 * Posts, comments, chats and reels all end up here: a unicode pill draws its
 * glyph, a `ce:<id>` pill draws the custom image, and both show the same count
 * and the same "mine" fill. The row is a single line that scrolls sideways
 * instead of wrapping, so a popular post never pushes its own caption down.
 *
 * Order is fixed: supers first, then the biggest reaction, then the rest.
 * A super pill is still just a pill — its glyph, its count and its own colour.
 * No sparkle, no label, no trailing plus: reactions are added from the picker
 * that each surface already owns. Long-press opens who reacted.
 */
export function ReactionPills({
  groups,
  onToggle,
  onShowReactors,
  className,
  compact = false,
}: {
  groups: SharedReactionGroup[];
  onToggle: (key: string) => void;
  onShowReactors?: (key: string) => void;
  className?: string;
  compact?: boolean;
}) {
  const ids = useMemo(
    () => groups.map((group) => customReactionId(group.key)).filter(Boolean) as string[],
    [groups],
  );
  const lookup = useEmojiLookup(ids);
  const map = useMemo(() => emojiMapOf(lookup.data), [lookup.data]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Supers lead, then the loudest. Sorted here too, so a caller that hands over
  // rows in query order still gets one predictable row.
  const ordered = useMemo(
    () =>
      [...groups].sort(
        (a, b) =>
          Number((b.superCount ?? 0) > 0) - Number((a.superCount ?? 0) > 0) || b.count - a.count,
      ),
    [groups],
  );

  if (!groups.length) return null;

  const start = (key: string) => {
    if (!onShowReactors) return;
    timer.current = setTimeout(() => onShowReactors(key), 450);
  };
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  return (
    <div
      className={cn(
        "reaction-pill-row flex items-center gap-1.5 overflow-x-auto pb-0.5",
        compact ? "py-0" : "py-0.5",
        className,
      )}
    >
      {ordered.map((group) => {
        const id = customReactionId(group.key);
        const emoji = id ? map.get(id) : undefined;
        const isSuper = (group.superCount ?? 0) > 0;
        const hue = isSuper ? superHue(group.key) : 0;
        return (
          <button
            key={group.key}
            type="button"
            onClick={() => onToggle(group.key)}
            onPointerDown={() => start(group.key)}
            onPointerUp={stop}
            onPointerLeave={stop}
            onContextMenu={(event) => {
              event.preventDefault();
              onShowReactors?.(group.key);
            }}
            aria-pressed={group.mine}
            aria-label={`${group.count} ${group.key}${isSuper ? " super" : ""} reaction${group.mine ? ", yours" : ""}`}
            title={isSuper ? `Super reaction · ${group.count}` : undefined}
            style={
              isSuper
                ? {
                    borderColor: `hsl(${hue} 85% 66% / ${group.mine ? 0.92 : 0.68})`,
                    backgroundColor: `hsl(${hue} 72% ${group.mine ? 24 : 17}%)`,
                    color: `hsl(${hue} 92% 84%)`,
                    boxShadow: `inset 0 0 0 1px hsl(${hue} 85% 80% / 0.16), 0 0 18px hsl(${hue} 90% 60% / 0.2)`,
                  }
                : undefined
            }
            className={cn(
              "inline-flex shrink-0 items-center rounded-full border transition-[transform,background-color,border-color,color] duration-[250ms] ease-out active:scale-95 motion-reduce:transition-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              compact ? "h-6 gap-1 px-2 text-[11px]" : "h-[30px] gap-1.5 px-2.5 text-[12px]",
              isSuper
                ? "font-bold super-reaction-in"
                : group.mine
                  ? "border-primary/80 bg-primary/[0.12] font-semibold text-primary hover:bg-primary/[0.18]"
                  : "border-white/[0.14] bg-[#1a1a1a] font-semibold text-[#dcdcdc] hover:border-white/25 hover:bg-[#202020]",
            )}
          >
            {id ? (
              <EmojiGlyph
                emoji={emoji}
                shortcode={emoji?.shortcode ?? "emoji"}
                className={compact ? "h-3.5 w-3.5" : "h-4 w-4"}
              />
            ) : (
              <UnicodeGlyph
                value={group.key}
                className={compact ? "text-[13px]" : "text-[15px]"}
                size={compact ? 13 : 15}
              />
            )}
            <AnimatedCount
              value={group.count}
              format={(next) => formatReactionCount(next)}
              className="text-[11px] font-bold leading-none"
            />
          </button>
        );
      })}
    </div>
  );
}

/** The count never shows more than four digits inside a pill. */
function formatReactionCount(value: number) {
  if (value < 1000) return String(value);
  if (value < 10_000) return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${Math.round(value / 1000)}K`;
}

/**
 * The tray: the quick row plus the picker. `quick` is configurable per surface
 * (reels, chat, comments), which is the point of one component.
 */
export function ReactionTray({
  open,
  onOpenChange,
  quick,
  realmId,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quick: readonly string[];
  realmId?: string | null;
  onPick: (key: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const choosePick = (pick: EmojiPick) => {
    if (pick.kind === "unicode") onPick(pick.value);
    else onPick(emojiReactionKey(pick.emoji.id));
    onOpenChange(false);
  };

  return (
    <>
      {open ? (
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-card px-1.5 py-1 shadow-xl backdrop-blur">
          {quick.map((glyph) => (
            <button
              key={glyph}
              type="button"
              onClick={() => {
                onPick(glyph);
                onOpenChange(false);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full text-lg transition-transform hover:scale-110 active:scale-95"
              aria-label={glyph}
            >
              {glyph}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            aria-label="More reactions"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <EmojiPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        realmId={realmId}
        title="React with"
        onPick={choosePick}
      />
    </>
  );
}

/** Groups raw rows into the shape the pills want. */
export function groupReactions(
  rows: Array<{ emoji: string; user_id: string; kind?: "normal" | "super" }>,
  userId?: string | null,
): SharedReactionGroup[] {
  const map = new Map<string, SharedReactionGroup>();
  for (const row of rows) {
    const group = map.get(row.emoji) ?? { key: row.emoji, count: 0, mine: false, superCount: 0 };
    const isSuper = row.kind === "super";
    group.count += 1;
    if (isSuper) group.superCount = (group.superCount ?? 0) + 1;
    if (userId && row.user_id === userId) {
      group.mine = true;
      if (isSuper) group.mineSuper = true;
    }
    map.set(row.emoji, group);
  }
  // A super reaction is the loudest thing on the row, so it leads.
  return [...map.values()].sort(
    (a, b) => Number((b.superCount ?? 0) > 0) - Number((a.superCount ?? 0) > 0) || b.count - a.count,
  );
}

export type { SharedEmoji };
