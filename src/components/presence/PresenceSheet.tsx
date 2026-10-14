import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Check, CircleDashed, Circle as CircleIcon, Moon, PhoneOff, Smile, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
export function PresenceSheet({
  open,
  onOpenChange,
  initialCustomOpen = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCustomOpen?: boolean;
}) {
  const presence = useSelfPresence();
  const [saving, setSaving] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [emoji, setEmoji] = useState("");
  const [text, setText] = useState("");
  const [expiry, setExpiry] = useState<(typeof EXPIRY_OPTIONS)[number]["value"]>("1h");
  const [dragY, setDragY] = useState(0);
  const dragStartY = useRef<number | null>(null);

  // Prefill the form from the saved status whenever the sheet opens.
  useEffect(() => {
    setDragY(0);
    if (!open) return;
    setCustomOpen(initialCustomOpen);
    const current = presence.customStatus;
    setEmoji(current?.emoji ?? "");
    setText(current?.text ?? "");
  }, [open, presence.customStatus, initialCustomOpen]);

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

  const choose = async (status: PresenceStatus) => {
    try {
      await presence.chooseStatus(status);
      toast.success(`Status set to ${PRESENCE_STATUSES.find((entry) => entry.value === status)?.label}`);
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

  const isDnd = presence.status === "dnd";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="glass-strong rounded-t-3xl border-white/10 max-h-[88dvh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]"
        style={
          dragY
            ? { transform: `translateY(${dragY}px)`, transition: "none" }
            : { transition: "transform 200ms ease-out" }
        }
      >
        {/* The grabber and the title are the drag surface, so a swipe never
            fights the sheet's own scrolling. */}
        <div
          className="cursor-grab touch-none select-none active:cursor-grabbing"
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
        >
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted-foreground/40" aria-hidden />
          <SheetTitle className="font-display text-lg">Status</SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Choose how you appear, or add a short custom status.
          </SheetDescription>
        </div>

        <div className="mt-4 space-y-1">
          {PRESENCE_STATUSES.map((entry) => {
            const Icon = STATUS_ICONS[entry.value];
            const active = presence.status === entry.value;
            return (
              <button
                key={entry.value}
                type="button"
                onClick={() => void choose(entry.value)}
                className={`flex min-h-[52px] w-full items-center gap-3 rounded-2xl border px-3 text-left transition-colors ${
                  active ? "border-white/15 bg-white/[0.07]" : "border-transparent hover:bg-white/5"
                }`}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: `${entry.color}26` }}>
                  <Icon className="h-4 w-4" style={{ color: entry.color }} />
                </span>
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
                {active && <Check className="h-4 w-4 shrink-0 text-[var(--rizz-pink)]" />}
              </button>
            );
          })}
        </div>

        {presence.customStatus && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-white/5 glass px-3 py-2.5 text-sm">
            <Smile className="h-4 w-4 shrink-0 text-muted-foreground" />
            <CustomStatusLine status={presence.customStatus} className="min-w-0 flex-1 text-muted-foreground" />
          </div>
        )}

        {!customOpen ? (
          <button
            type="button"
            onClick={() => setCustomOpen(true)}
            className="mt-3 flex min-h-[52px] w-full items-center gap-3 rounded-2xl border border-white/5 glass px-3 text-left text-sm font-medium hover:bg-white/5"
          >
            <Smile className="h-4 w-4 text-muted-foreground" />
            Set a custom status
          </button>
        ) : (
          <div className="mt-3 space-y-3 rounded-2xl border border-white/5 glass p-3">
            <div className="flex items-center gap-2">
              <Input
                value={emoji}
                onChange={(event) => setEmoji(event.target.value)}
                maxLength={16}
                placeholder="🔥"
                aria-label="Status emoji"
                className="h-12 w-16 shrink-0 text-center text-lg"
              />
              <Input
                value={text}
                onChange={(event) => setText(event.target.value)}
                maxLength={60}
                placeholder="What's happening?"
                aria-label="Status text"
                className="h-12 flex-1"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {QUICK_EMOJI.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setEmoji(value)}
                  className="grid h-10 w-10 place-items-center rounded-xl border border-white/5 text-lg hover:bg-white/5"
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
              <Button disabled={saving} onClick={() => void saveCustom()} className="h-12 flex-1 bg-gradient-primary">
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
