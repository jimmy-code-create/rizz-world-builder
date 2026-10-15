import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Smile, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { IconTile } from "@/components/ui/icon-tile";
import { ChoiceMark } from "@/components/ui/choice-mark";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { CloseButton } from "@/components/ui/close-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CAT_EMOJIS, isCatEmoji } from "@/lib/cat-emojis";
import { CatEmoji } from "@/components/CatEmoji";
import { CustomStatusLine, StatusDot, StatusIcon, ThoughtBubble } from "@/components/presence/StatusDot";
import {
  PRESENCE_STATUSES,
  customStatusExpiry,
  useSelfPresence,
  type PresenceStatus,
} from "@/lib/presence";

const EXPIRY_OPTIONS = [
  { value: "30m", label: "30 minutes" },
  { value: "1h", label: "1 hour" },
  { value: "4h", label: "4 hours" },
  { value: "today", label: "Today" },
  { value: "never", label: "Never" },
] as const;

const EMOJI_CATEGORIES = [
  {
    name: "RIZZ Vibes",
    emojis: ["🔥", "✨", "⚡", "👑", "💯", "💀", "🤙", "😎", "🐱", "💖", "🏆", "👾", "💫", "🚀", "🍕", "☕", "🌿", "🎉"],
  },
  {
    name: "Cats & Rizz",
    emojis: ["🐱", "🐈", "🐾", "😸", "😹", "😻", "😽", "😼", "🙀", "😿", "😾", "🦁", "🦊", "🐼", "🐸", "🦄"],
  },
  {
    name: "Moods",
    emojis: ["😊", "😎", "🥳", "😴", "🤔", "🥹", "😤", "🤯", "🤩", "🫡", "🫠", "👀", "🤐", "😇", "😈", "🥶", "😴", "🤤"],
  },
  {
    name: "Activity",
    emojis: ["🎧", "🎮", "💻", "📚", "⚽", "🏋️", "🛹", "🎨", "🍿", "🍕", "☕", "🏖️", "🚲", "🎤", "🎬", "🎸", "🥊", "🏊"],
  },
];

const QUICK_EMOJI = ["🔥", "🎧", "💤", "🍿", "💪", "📚", "🎮", "✨", "👑", "🐱", "💀", "⚡"];

/** Tapping your avatar opens this: the four statuses and a custom status row. */
export function PresenceSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const presence = useSelfPresence();
  const [saving, setSaving] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [optimisticStatus, setOptimisticStatus] = useState<PresenceStatus | null>(null);
  /* Feedback for a local control belongs next to that control, so it renders in
     the row that changed instead of as a toast at the bottom of the window. */
  const [feedback, setFeedback] = useState<{
    kind: "saved" | "error";
    status: PresenceStatus;
    text?: string;
  } | null>(null);

  // Inline feedback fades on its own; no intervention needed.
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 2400);
    return () => window.clearTimeout(timer);
  }, [feedback]);
  const [emoji, setEmoji] = useState("");
  const [text, setText] = useState("");
  const [expiry, setExpiry] = useState<(typeof EXPIRY_OPTIONS)[number]["value"]>("1h");
  const [showAllEmojis, setShowAllEmojis] = useState(false);
  const [activeCategory, setActiveCategory] = useState(0);
  const [dragY, setDragY] = useState(0);
  const dragStartY = useRef<number | null>(null);

  // Prefill the form from the saved status whenever the sheet opens.
  useEffect(() => {
    setDragY(0);
    if (!open) return;
    const current = presence.customStatus;
    setEmoji(current?.emoji ?? "");
    setText(current?.text ?? "");
  }, [open, presence.customStatus]);

  // Swipe down on the handle to dismiss.
  const onDragStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragStartY.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onDragMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStartY.current === null) return;
    setDragY(Math.max(0, event.clientY - dragStartY.current));
  };
  const onDragEnd = () => {
    if (dragStartY.current === null) return;
    const shouldClose = dragY > SWIPE_CLOSE_PX;
    dragStartY.current = null;
    setDragY(0);
    if (shouldClose) onOpenChange(false);
  };

  // Back (Android gesture or browser button) closes the sheet rather than
  // leaving the page: one history entry is pushed while it is open and stepped
  // back over when it closes some other way, so the next Back still goes where
  // the user expects.
  useEffect(() => {
    if (!open) return;
    const marker = "rizzStatusSheet";
    let closedByBack = false;
    window.history.pushState({ ...(window.history.state ?? {}), [marker]: true }, "");
    const onPop = () => {
      closedByBack = true;
      onOpenChange(false);
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      const state = window.history.state as Record<string, unknown> | null;
      if (!closedByBack && state?.[marker]) window.history.back();
    };
  }, [open, onOpenChange]);

  const activeStatus = optimisticStatus ?? presence.status;

  const choose = async (status: PresenceStatus) => {
    setOptimisticStatus(status);
    try {
      await presence.chooseStatus(status);
      setFeedback({ kind: "saved", status });
    } catch (error) {
      setOptimisticStatus(null);
      setFeedback({
        kind: "error",
        status,
        text: error instanceof Error ? error.message : "Couldn't save your status, try again",
      });
    }
  };

  const saveCustom = async () => {
    if (!emoji.trim() && !text.trim()) {
      toast.error("Add an emoji or a few words first");
      return;
    }
    setSaving(true);
    try {
      await presence.saveCustomStatus(
        emoji.trim() || null,
        text.trim() || null,
        customStatusExpiry(expiry),
      );
      toast.success("Custom status saved");
      setCustomOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save your status, try again");
    } finally {
      setSaving(false);
    }
  };

  const clearCustom = async () => {
    setSaving(true);
    try {
      await presence.clearCustomStatus();
      setEmoji("");
      setText("");
      toast.success("Custom status cleared");
      setCustomOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't clear your status, try again");
    } finally {
      setSaving(false);
    }
  };

  const isDnd = activeStatus === "dnd";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        hideClose
        className="glass-strong rounded-t-3xl border-white/10 max-h-[88dvh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]"
      >
        <div className="sheet-drag-handle mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted-foreground/40" aria-hidden />
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <SheetTitle className="font-display text-lg">Status</SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              Choose how you appear, or add a short custom status.
            </SheetDescription>
          </div>
          <SheetClose asChild>
            <CloseButton />
          </SheetClose>
        </div>

        <div className="mt-4 space-y-1" role="radiogroup" aria-label="Status">
          {PRESENCE_STATUSES.map((entry) => {
            const active = activeStatus === entry.value;
            return (
              <button
                key={entry.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => void choose(entry.value)}
                className={`flex min-h-[52px] w-full items-center gap-3 rounded-[10px] border px-3 text-left transition-colors ${
                  active ? "border-border bg-secondary" : "border-transparent hover:bg-secondary"
                }`}
              >
                {/* Fixed square, centred glyph with Discord-style custom status icon */}
                <IconTile
                  size="md"
                  radius="9999px"
                  style={{ background: `${entry.color}20` }}
                >
                  <StatusIcon status={entry.value} size={20} />
                </IconTile>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    {entry.label}
                    {entry.value === "dnd" && isDnd && (
                      <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-300">
                        Do not disturb
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">{entry.hint}</span>
                </span>
                {/* Inline confirmation, right where the change happened. */}
                {feedback && feedback.status === entry.value && (
                  <span
                    role="status"
                    className={`shrink-0 text-[11px] font-medium ${
                      feedback.kind === "error" ? "text-destructive" : "text-[var(--brand-signal)]"
                    }`}
                  >
                    {feedback.kind === "error" ? feedback.text ?? "Couldn't save" : "Saved"}
                  </span>
                )}
                {/* Box and tick in one element, so they can never drift apart. */}
                <ChoiceMark checked={active} />
              </button>
            );
          })}
        </div>

        {presence.customStatus && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl border border-white/10 glass px-3 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <ThoughtBubble
                emoji={presence.customStatus.emoji}
                text={presence.customStatus.text}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCustomOpen(true)}
              className="text-xs text-primary hover:text-primary/80 shrink-0 h-8 px-2"
            >
              Edit
            </Button>
          </div>
        )}

        {!customOpen ? (
          <button
            type="button"
            onClick={() => setCustomOpen(true)}
            className="mt-3 flex min-h-[52px] w-full items-center gap-3 rounded-[10px] border border-border bg-card px-3 text-left text-sm font-medium hover:bg-secondary"
          >
            <Smile className="h-4 w-4 text-muted-foreground" />
            Set a custom status
          </button>
        ) : (
          <div className="mt-3 space-y-3 rounded-[10px] border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAllEmojis((prev) => !prev)}
                aria-label="Pick emoji"
                title="Pick emoji"
                className={`grid h-12 w-14 shrink-0 place-items-center rounded-xl border transition-all text-xl ${
                  showAllEmojis
                    ? "border-primary bg-primary/15 shadow-sm"
                    : "border-white/10 glass hover:border-white/20"
                }`}
              >
                {isCatEmoji(emoji) ? (
                  <CatEmoji name={emoji} size={28} />
                ) : (
                  emoji || "🔥"
                )}
              </button>
              <Input
                value={text}
                onChange={(event) => setText(event.target.value)}
                maxLength={60}
                placeholder="What's happening?"
                aria-label="Status text"
                className="h-12 flex-1"
              />
            </div>

            {/* Cat Emojis Strip */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-0.5">
                <span>Cat Emojis</span>
                <span className="text-[10px] lowercase text-primary">animated</span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {CAT_EMOJIS.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => {
                      setEmoji(item.token);
                    }}
                    title={item.label}
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition-all ${
                      emoji === item.token || emoji === item.name
                        ? "border-primary bg-primary/25 scale-105"
                        : "border-white/5 hover:bg-white/10"
                    }`}
                    aria-label={item.label}
                  >
                    <CatEmoji name={item.name} size={22} />
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Emojis strip */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {QUICK_EMOJI.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setEmoji(value);
                  }}
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border text-base transition-colors ${
                    emoji === value
                      ? "border-primary bg-primary/20 scale-105"
                      : "border-white/5 hover:bg-white/10"
                  }`}
                  aria-label={`Use ${value}`}
                >
                  {value}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowAllEmojis((s) => !s)}
                className={`h-9 px-2.5 shrink-0 rounded-xl border text-xs font-semibold transition-colors flex items-center gap-1 ${
                  showAllEmojis ? "border-primary bg-primary text-primary-foreground" : "border-white/10 glass text-muted-foreground hover:text-foreground"
                }`}
              >
                <Smile className="h-3.5 w-3.5" />
                <span>More</span>
              </button>
            </div>

            {/* Expanded Emoji Drawer with RIZZ categories */}
            {showAllEmojis && (
              <div className="rounded-2xl border border-white/10 bg-black/40 p-3 space-y-2.5 animate-in fade-in-0 duration-150">
                <div className="flex gap-1 overflow-x-auto no-scrollbar border-b border-white/10 pb-1.5">
                  {EMOJI_CATEGORIES.map((cat, idx) => (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() => setActiveCategory(idx)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                        activeCategory === idx
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-6 gap-1 max-h-36 overflow-y-auto pr-0.5">
                  {EMOJI_CATEGORIES[activeCategory].emojis.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => {
                        setEmoji(em);
                        setShowAllEmojis(false);
                      }}
                      className={`grid h-10 w-full place-items-center rounded-xl text-lg hover:bg-white/10 active:scale-95 transition-transform ${
                        emoji === em ? "bg-primary/20 ring-1 ring-primary" : ""
                      }`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[11px] text-muted-foreground">
                  <span>Tap any emoji to set</span>
                  {emoji && (
                    <button
                      type="button"
                      onClick={() => setEmoji("")}
                      className="text-destructive hover:underline font-medium"
                    >
                      Clear emoji
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs text-muted-foreground">{text.length}/60</Label>
              <select
                value={expiry}
                onChange={(event) => setExpiry(event.target.value as typeof expiry)}
                aria-label="Status expiry"
                className="h-10 rounded-xl border border-white/10 glass bg-transparent px-3 text-sm"
              >
                {EXPIRY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    Clear after {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" className="h-12 flex-1 glass border-white/10" onClick={() => setCustomOpen(false)}>
                Cancel
              </Button>
              {presence.customStatus && (
                <Button
                  variant="ghost"
                  disabled={saving}
                  onClick={() => void clearCustom()}
                  className="h-12 gap-1.5 glass border-white/10 text-destructive"
                >
                  <Trash2 className="h-4 w-4" /> Clear
                </Button>
              )}
              <Button disabled={saving} onClick={() => void saveCustom()} className="h-12 flex-1 bg-primary text-primary-foreground">
                Save
              </Button>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
          <StatusDot status={presence.status} />
          <span>
            {presence.status === "invisible"
              ? "You appear offline to everyone, but you can use RIZZ as usual."
              : "Idle kicks in after 5 minutes away, unless you pick a status yourself."}
          </span>
        </div>
      </SheetContent>
    </Sheet>
  );
}
