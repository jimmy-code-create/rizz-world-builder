import { useMemo, useRef, useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { customReactionId, emojiMapOf, emojiReactionKey, useEmojiLookup } from "@/lib/emoji-shared";
import { EmojiGlyph, UnicodeGlyph } from "@/components/emoji/EmojiGlyph";
import { EmojiPicker, type EmojiPick } from "@/components/emoji/EmojiPicker";
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
 * One pill row for the whole app.
 *
 * Posts, comments, chats and reels all end up here: a unicode pill draws its
 * glyph, a `ce:<id>` pill draws the custom image, and both show the same count
 * and the same "mine" ring. Long-press opens who reacted.
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
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {groups.map((group) => {
        const id = customReactionId(group.key);
        const emoji = id ? map.get(id) : undefined;
        const superCount = group.superCount ?? 0;
        const isSuper = superCount > 0;
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
            className={cn(
              "inline-flex items-center rounded-full border transition-all duration-150 active:scale-90",
              compact
                ? "h-5 gap-0.5 px-1 text-[10px]"
                : isSuper
                  ? "h-8 gap-1 px-2.5 text-[12px]"
                  : "h-7 gap-1 px-2 text-[12px]",
              isSuper
                ? "border-[#cfaeff]/70 bg-[linear-gradient(120deg,rgba(180,124,255,0.32),rgba(124,77,255,0.18)_48%,rgba(236,72,153,0.22))] text-foreground shadow-[0_0_20px_rgba(180,124,255,0.4)] ring-1 ring-inset ring-white/10"
                : group.mine
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-white/10 bg-white/[0.05] text-muted-foreground hover:border-white/20 hover:text-foreground",
              isSuper && group.mine && "ring-primary/50",
              isSuper && !compact && "super-reaction-in",
            )}
          >
            {id ? (
              <EmojiGlyph
                emoji={emoji}
                shortcode={emoji?.shortcode ?? "emoji"}
                className={
                  compact
                    ? "h-3.5 w-3.5"
                    : isSuper
                      ? "h-5 w-5"
                      : "h-4 w-4"
                }
              />
            ) : (
              <UnicodeGlyph
                value={group.key}
                className={
                  compact ? "text-[14px]" : isSuper ? "text-[20px]" : "text-[16px]"
                }
              />
            )}
            {isSuper ? (
              <Sparkles
                className={compact ? "h-2.5 w-2.5 text-[#e6d4ff]" : "h-3 w-3 text-[#e6d4ff]"}
                aria-hidden="true"
              />
            ) : null}
            <span
              className={cn("tabular-nums", isSuper ? "font-bold text-[#f3e9ff]" : "font-semibold")}
            >
              {group.count}
            </span>
          </button>
        );
      })}
    </div>
  );
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
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-[#141414]/95 px-1.5 py-1 shadow-xl backdrop-blur">
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
