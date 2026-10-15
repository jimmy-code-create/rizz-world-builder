import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, X } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { CloseButton } from "@/components/ui/close-button";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusIcon, StatusBubble } from "@/components/presence/StatusDot";
import { CatEmojiPicker } from "@/components/emoji/CatEmojiPicker";
import { StatusEmoji } from "@/lib/cat-emoji-text";
import {
  PRESENCE_STATUSES,
  customStatusExpiry,
  useSelfPresence,
  type PresenceStatus,
} from "@/lib/presence";

type ExpiryChoice = "1h" | "4h" | "today" | "never";

const EXPIRY_CHIPS: Array<{ value: ExpiryChoice; label: string }> = [
  { value: "1h", label: "1 hour" },
  { value: "4h", label: "4 hours" },
  { value: "today", label: "Today" },
  { value: "never", label: "Never" },
];

const QUICK_PICKS: Array<{ emoji: string; text: string }> = [
  { emoji: ":cat_music:", text: "Vibing" },
  { emoji: ":cat_think:", text: "Studying" },
  { emoji: ":cat_sleep:", text: "Sleeping" },
  { emoji: ":cat_hype:", text: "Hyped" },
  { emoji: ":cat_wave:", text: "Be right back" },
];

const LAST_EXPIRY_KEY = "rizz-status-expiry";

function loadLastExpiry(): ExpiryChoice {
  try {
    const v = localStorage.getItem(LAST_EXPIRY_KEY);
    if (v === "1h" || v === "4h" || v === "today" || v === "never") return v;
  } catch {}
  return "today";
}

const DESCRIPTIONS: Partial<Record<PresenceStatus, string>> = {
  dnd: "You won't get notifications",
  invisible: "You'll appear offline",
};

/** Compact Discord-style presence + custom status. Phone = bottom sheet (max 60dvh). */
export function PresenceSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const presence = useSelfPresence();
  const [editorOpen, setEditorOpen] = useState(false);
  const [emoji, setEmoji] = useState("");
  const [text, setText] = useState("");
  const [expiry, setExpiry] = useState<ExpiryChoice>(() => loadLastExpiry());
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Prefill whenever the sheet opens.
  useEffect(() => {
    if (!open) return;
    setEditorOpen(false);
    setEmojiOpen(false);
    setError(null);
    setSavedTick(false);
    const current = presence.customStatus;
    setEmoji(current?.emoji ?? "");
    setText(current?.text ?? "");
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Expired statuses disappear without a refresh: re-render at expiry.
  useEffect(() => {
    const raw = (presence.row as { custom_status_expires_at?: string | null } | null)?.custom_status_expires_at;
    if (!raw) return;
    const ms = new Date(raw).getTime() - Date.now();
    if (ms <= 0) {
      void presence.refresh();
      return;
    }
    const t = window.setTimeout(() => void presence.refresh(), Math.min(ms + 500, 2_147_483_647));
    return () => window.clearTimeout(t);
  }, [presence.row, presence.refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (editorOpen && open) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 60);
      return () => window.clearTimeout(t);
    }
  }, [editorOpen, open]);

  useEffect(() => {
    try {
      localStorage.setItem(LAST_EXPIRY_KEY, expiry);
    } catch {}
  }, [expiry]);

  const choose = async (status: PresenceStatus) => {
    try {
      await presence.chooseStatus(status);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save, try again");
    }
  };

  const doSave = async (e?: string, t?: string, exp?: ExpiryChoice) => {
    const nextEmoji = (e ?? emoji).trim();
    const nextText = (t ?? text).trim();
    const nextExpiry = exp ?? expiry;
    if (!nextEmoji && !nextText) {
      setError("Add an emoji or a few words first");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await presence.saveCustomStatus(nextEmoji || null, nextText || null, customStatusExpiry(nextExpiry));
      setSavedTick(true);
      window.setTimeout(() => {
        setSavedTick(false);
        onOpenChange(false);
      }, 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save, try again");
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
      setEditorOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't clear, try again");
    } finally {
      setSaving(false);
    }
  };

  const activeStatus = presence.status;
  const custom = presence.customStatus;
  const showCounter = text.length > 45;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        hideClose
        className="mx-auto max-h-[60dvh] w-full overflow-y-auto rounded-t-3xl border-white/10 glass-strong pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] sm:max-w-sm sm:rounded-3xl sm:mb-4"
      >
        <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-muted-foreground/40" aria-hidden />
        <div className="flex items-center gap-3">
          {editorOpen && (
            <button
              type="button"
              onClick={() => setEditorOpen(false)}
              aria-label="Back to status"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[#f2efe6]/70 hover:bg-white/10 hover:text-[#f2efe6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d]"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <SheetTitle className="font-display text-lg">{editorOpen ? "Custom status" : "Status"}</SheetTitle>
            {!editorOpen && (
              <SheetDescription className="text-xs text-muted-foreground">
                Choose how you appear.
              </SheetDescription>
            )}
          </div>
          <SheetClose asChild>
            <CloseButton />
          </SheetClose>
        </div>

        {!editorOpen ? (
          <>
            <div className="mt-3 space-y-0.5" role="radiogroup" aria-label="Presence">
              {PRESENCE_STATUSES.map((entry) => {
                const selected = activeStatus === entry.value;
                return (
                  <button
                    key={entry.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => void choose(entry.value)}
                    className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d]"
                  >
                    <StatusIcon status={entry.value} size={18} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-[#f2efe6]">{entry.label}</span>
                      {DESCRIPTIONS[entry.value] && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {DESCRIPTIONS[entry.value]}
                        </span>
                      )}
                    </span>
                    {selected && <Check className="h-4 w-4 shrink-0 text-[#c8ff3d]" aria-label="Selected" />}
                  </button>
                );
              })}
            </div>
            {error && (
              <p role="alert" className="mt-2 text-xs text-destructive">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={() => setEditorOpen(true)}
              className="mt-2 flex min-h-[44px] w-full items-center gap-3 rounded-xl border border-[#2a2a2e] bg-[#141416] px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d]"
            >
              {custom && (custom.emoji || custom.text) ? (
                <>
                  <span className="min-w-0 flex-1">
                    <StatusBubble emoji={custom.emoji} text={custom.text} />
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label="Clear status"
                    onClick={(e) => {
                      e.stopPropagation();
                      void clearCustom();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation();
                        void clearCustom();
                      }
                    }}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">Set a custom status</span>
              )}
            </button>
          </>
        ) : (
          <div
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void doSave();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setEditorOpen(false);
              }
            }}
          >
            <div className="mt-3 flex items-center gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setEmojiOpen((v) => !v)}
                  aria-label="Pick status emoji"
                  aria-expanded={emojiOpen}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#2a2a2e] bg-[#141416] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d]"
                >
                  {emoji ? <StatusEmoji emoji={emoji} size={22} /> : <span className="text-xl">😊</span>}
                </button>
                {emojiOpen && (
                  <div className="absolute bottom-full left-0 z-50 mb-2 w-[19rem] rounded-2xl border border-[#2a2a2e] bg-[#141416] p-2 shadow-2xl">
                    <CatEmojiPicker
                      value={emoji}
                      size={28}
                      onPick={(code) => {
                        setEmoji(code);
                        setEmojiOpen(false);
                        inputRef.current?.focus();
                      }}
                    />
                  </div>
                )}
              </div>
              <Input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={60}
                placeholder="What's happening?"
                aria-label="Status text"
                className="h-11 flex-1"
              />
            </div>
            {showCounter && <p className="mt-1 text-right text-[11px] text-muted-foreground">{text.length}/60</p>}

            <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Quick picks">
              {QUICK_PICKS.map((q) => (
                <button
                  key={q.text}
                  type="button"
                  onClick={() => {
                    setEmoji(q.emoji);
                    setText(q.text);
                    void doSave(q.emoji, q.text, expiry);
                  }}
                  className="flex min-h-[44px] items-center gap-1.5 rounded-full border border-[#2a2a2e] bg-[#1c1c1f] px-3 text-[13px] text-[#f2efe6] transition-colors hover:border-[#c8ff3d]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d]"
                >
                  <StatusEmoji emoji={q.emoji} size={16} />
                  {q.text}
                </button>
              ))}
            </div>

            <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Clear after
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Clear after">
              {EXPIRY_CHIPS.map((o) => {
                const selected = expiry === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setExpiry(o.value)}
                    className={`min-h-[44px] rounded-full border px-3 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d] ${
                      selected
                        ? "border-[#c8ff3d] bg-[#c8ff3d]/15 text-[#c8ff3d]"
                        : "border-[#2a2a2e] text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>

            {error && (
              <p role="alert" className="mt-2 text-xs text-destructive">
                {error}
              </p>
            )}

            <div className="mt-3 flex items-center gap-2">
              {custom && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={saving}
                  onClick={() => void clearCustom()}
                  className="h-11 flex-1"
                >
                  Clear status
                </Button>
              )}
              <Button type="button" variant="ghost" onClick={() => setEditorOpen(false)} className="h-11 flex-1">
                Cancel
              </Button>
              <Button
                type="button"
                disabled={saving}
                onClick={() => void doSave()}
                className="h-11 flex-1 bg-[#c8ff3d] text-[#0b0b0c] hover:bg-[#c8ff3d]/90"
              >
                {savedTick ? (
                  <span className="flex items-center gap-1.5">
                    <Check className="h-4 w-4" /> Saved
                  </span>
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
