import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Check, CircleDashed, Circle as CircleIcon, Moon, PhoneOff, Smile, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/IconTile";
import { CustomStatusLine, StatusDot } from "@/components/presence/StatusDot";
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

const QUICK_EMOJI = ["🔥", "🎧", "💤", "🍿", "💪", "📚", "🎮", "✨"];

// Online = dot, Idle = moon, Do not disturb = crossed-out phone (it mutes the
// ping and the ringer), Invisible = grey ring.
const STATUS_ICONS = { online: CircleIcon, idle: Moon, dnd: PhoneOff, invisible: CircleDashed } as const;

/** Drag the handle this far down and the sheet closes. */
const SWIPE_CLOSE_PX = 96;

/** Tapping your avatar opens this: the four statuses and a custom status row. */
export function PresenceSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const presence = useSelfPresence();
  const [saving, setSaving] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [emoji, setEmoji] = useState("");
  const [text, setText] = useState("");
  const [expiry, setExpiry] = useState<(typeof EXPIRY_OPTIONS)[number]["value"]>("1h");
  const [dragY, setDragY] = useState(0);
  const [inlineFeedback, setInlineFeedback] = useState<string | null>(null);
  const dragStartY = useRef<number | null>(null);

  // Prefill the form from the saved status whenever the sheet opens.
  useEffect(() => {
    setDragY(0);
    setInlineFeedback(null);
    if (!open) return;
    const current = presence.customStatus;
    setEmoji(current?.emoji ?? "");
    setText(current?.text ?? "");
  }, [open, presence.customStatus]);

  // Swipe down on the handle to dismiss (mobile only).
  const onDragStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (window.innerWidth >= 640) return;
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

  const choose = async (status: PresenceStatus) => {
    try {
      await presence.chooseStatus(status);
      const label = PRESENCE_STATUSES.find((entry) => entry.value === status)?.label ?? "Saved";
      setInlineFeedback(`Status updated to ${label}`);
      setTimeout(() => setInlineFeedback(null), 3000);
      toast.success(`Status set to ${label}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save your status, try again");
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
      setInlineFeedback("Custom status saved");
      setTimeout(() => setInlineFeedback(null), 3000);
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
      setInlineFeedback("Custom status cleared");
      setTimeout(() => setInlineFeedback(null), 3000);
      toast.success("Custom status cleared");
      setCustomOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't clear your status, try again");
    } finally {
      setSaving(false);
    }
  };

  const isDnd = presence.status === "dnd";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="bg-card text-card-foreground border-border rounded-t-3xl border-t max-h-[88dvh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-[400px] sm:w-full sm:rounded-2xl sm:border sm:border-border sm:p-6 sm:shadow-2xl sm:pb-6"
        style={
          dragY
            ? { transform: `translateY(${dragY}px)`, transition: "none" }
            : { transition: "transform 200ms ease-out" }
        }
      >
        {/* Grabber for touch devices; hidden on desktop dialog */}
        <div
          className="cursor-grab touch-none select-none active:cursor-grabbing sm:hidden"
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
        >
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted-foreground/30" aria-hidden />
        </div>

        <div>
          <SheetTitle className="font-display text-lg font-bold">Status</SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Choose how you appear, or add a short custom status.
          </SheetDescription>
        </div>

        {inlineFeedback && (
          <div
            role="status"
            aria-live="polite"
            className="mt-3 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition-all"
          >
            <Check className="h-4 w-4 shrink-0" />
            <span>{inlineFeedback}</span>
          </div>
        )}

        <div className="mt-4 space-y-1.5">
          {PRESENCE_STATUSES.map((entry) => {
            const Icon = STATUS_ICONS[entry.value];
            const active = presence.status === entry.value;
            return (
              <button
                key={entry.value}
                type="button"
                onClick={() => void choose(entry.value)}
                className={`flex min-h-[50px] w-full items-center gap-3 rounded-xl border px-3 text-left transition-colors ${
                  active ? "border-primary/40 bg-accent text-accent-foreground" : "border-border/60 hover:bg-muted/50 text-foreground"
                }`}
              >
                <IconTile size="md" shape="circle" style={{ background: `${entry.color}20` }}>
                  <Icon className="h-4 w-4" style={{ color: entry.color }} />
                </IconTile>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    {entry.label}
                    {entry.value === "dnd" && isDnd && (
                      <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-400">
                        Do not disturb
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">{entry.hint}</span>
                </span>
                {active && (
                  <IconTile size="sm" shape="square" className="text-primary">
                    <Check className="h-4 w-4" />
                  </IconTile>
                )}
              </button>
            );
          })}
        </div>

        {presence.customStatus && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm">
            <Smile className="h-4 w-4 shrink-0 text-muted-foreground" />
            <CustomStatusLine status={presence.customStatus} className="min-w-0 flex-1 text-muted-foreground" />
          </div>
        )}

        {!customOpen ? (
          <button
            type="button"
            onClick={() => setCustomOpen(true)}
            className="mt-3 flex min-h-[46px] w-full items-center gap-3 rounded-xl border border-border bg-card px-3 text-left text-sm font-medium hover:bg-muted/50"
          >
            <Smile className="h-4 w-4 text-muted-foreground" />
            Set a custom status
          </button>
        ) : (
          <div className="mt-3 space-y-3 rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <Input
                value={emoji}
                onChange={(event) => setEmoji(event.target.value)}
                maxLength={16}
                placeholder="🔥"
                aria-label="Status emoji"
                className="h-11 w-14 shrink-0 text-center text-lg"
              />
              <Input
                value={text}
                onChange={(event) => setText(event.target.value)}
                maxLength={60}
                placeholder="What's happening?"
                aria-label="Status text"
                className="h-11 flex-1"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {QUICK_EMOJI.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setEmoji(value)}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-border text-lg hover:bg-muted"
                  aria-label={`Use ${value}`}
                >
                  {value}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs text-muted-foreground">{text.length}/60</Label>
              <select
                value={expiry}
                onChange={(event) => setExpiry(event.target.value as typeof expiry)}
                aria-label="Status expiry"
                className="h-9 rounded-lg border border-border bg-card px-3 text-xs"
              >
                {EXPIRY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    Clear after {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button variant="outline" className="h-10 flex-1 border-border" onClick={() => setCustomOpen(false)}>
                Cancel
              </Button>
              {presence.customStatus && (
                <Button
                  variant="outline"
                  disabled={saving}
                  onClick={() => void clearCustom()}
                  className="h-10 gap-1.5 border-border text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" /> Clear
                </Button>
              )}
              <Button disabled={saving} onClick={() => void saveCustom()} className="h-10 flex-1 bg-primary text-primary-foreground font-semibold">
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
