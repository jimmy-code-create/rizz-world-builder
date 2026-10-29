import { useMemo, useState } from "react";
import { ArrowLeft, Plus, Search, X, type LucideIcon } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { RIZZ_PACKS, insertRizzItem, searchRizzLibrary } from "@/lib/rizz-library";
import { cn } from "@/lib/utils";

/**
 * The composer's `+`, Discord-style.
 *
 * A lone photo icon hid everything the composer could do behind one guess:
 * people found the camera but never the poll, the GIF library or the scheduler.
 * One `+` opens a sheet with the whole menu spelled out — an icon, a word and a
 * one-line hint each — so nothing is discoverable only by trying it.
 *
 * The Rizz library lives inside the same sheet rather than in a second modal:
 * picking an emoji or a kaomoji is one tap from the `+`, and there is no stack
 * of dialogs to back out of.
 */
export type ChatAttachAction = {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  onSelect: () => void;
  disabled?: boolean;
};

/** An emoji is short; a kaomoji is a word-shaped sticker. */
function isGlyph(item: string) {
  return [...item].length <= 3;
}

function LibraryView({
  onPick,
  onBack,
}: {
  onPick: (item: string) => void;
  onBack: () => void;
}) {
  const [query, setQuery] = useState("");
  const [packId, setPackId] = useState<string>(RIZZ_PACKS[0].id);
  const results = useMemo(() => searchRizzLibrary(query), [query]);
  const searching = query.trim().length > 0;
  const visible = searching ? results : results.filter((entry) => entry.pack.id === packId);

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-center gap-2 px-4 pb-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to attachments"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold">Rizz library</p>
      </div>

      <div className="px-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search emoji and stickers"
            aria-label="Search the Rizz library"
            className="h-9 border-white/10 bg-black/25 pl-8 text-xs"
          />
        </div>
      </div>

      {!searching && (
        <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto px-4 pb-1">
          {RIZZ_PACKS.map((pack) => (
            <button
              key={pack.id}
              type="button"
              onClick={() => setPackId(pack.id)}
              aria-pressed={pack.id === packId}
              className={cn(
                "flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold transition-colors",
                pack.id === packId
                  ? "border-primary/50 bg-primary/15 text-foreground"
                  : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground",
              )}
            >
              <span aria-hidden="true" className="text-[13px] leading-none">
                {isGlyph(pack.glyph) ? pack.glyph : "✳"}
              </span>
              {pack.label}
            </button>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-2">
        {visible.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            Nothing matches “{query.trim()}”.
          </p>
        ) : (
          <div className="grid grid-cols-6 gap-1">
            {visible.map((entry) => (
              <button
                key={`${entry.pack.id}-${entry.item}`}
                type="button"
                onClick={() => onPick(entry.item)}
                aria-label={`Insert ${entry.item}`}
                className={cn(
                  "grid place-items-center rounded-lg border border-transparent transition-colors hover:border-white/10 hover:bg-white/[0.06] focus-visible:border-primary/60 focus-visible:outline-none",
                  isGlyph(entry.item) ? "h-10 text-2xl" : "col-span-2 h-12 px-1 font-mono text-[10px]",
                )}
              >
                {entry.item}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatAttachButton({
  actions,
  disabled,
  onInsertSticker,
  className,
  label = "Add photos, a poll or a sticker",
}: {
  actions: ChatAttachAction[];
  disabled?: boolean;
  /** Presence of this callback adds the Rizz library view to the sheet. */
  onInsertSticker?: (item: string) => void;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);

  const close = () => {
    setOpen(false);
    // The library is a view, not a state of mind: reopening starts on the menu.
    window.setTimeout(() => setShowLibrary(false), 200);
  };

  const run = (action: ChatAttachAction) => {
    if (action.disabled) return;
    close();
    // Let the sheet's exit animation start before a file dialog steals focus,
    // otherwise iOS drops the dialog and the picker never appears.
    window.setTimeout(action.onSelect, 60);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-label={label}
        className={cn(
          "grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-muted-foreground transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-foreground disabled:opacity-40",
          className,
        )}
      >
        <Plus className="h-5 w-5" />
      </button>

      <Sheet open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <SheetContent
          side="bottom"
          hideClose
          className="glass-strong max-h-[78dvh] rounded-t-3xl border-white/10 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
        >
          <SheetTitle className="sr-only">Attachments</SheetTitle>
          <div className="mx-auto mb-3 mt-1 h-1 w-10 rounded-full bg-white/20" aria-hidden="true" />

          {showLibrary && onInsertSticker ? (
            <LibraryView
              onBack={() => setShowLibrary(false)}
              onPick={(item) => {
                onInsertSticker(item);
                close();
              }}
            />
          ) : (
            <div className="px-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold">Add to your message</p>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close"
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {actions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => run(action)}
                    disabled={action.disabled}
                    className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/[0.07] bg-white/[0.035] px-2 py-3 text-center transition-colors hover:border-white/15 hover:bg-white/[0.07] active:scale-[0.98] disabled:opacity-40"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.07] text-foreground">
                      <action.icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="text-[11px] font-semibold leading-tight">{action.label}</span>
                    {action.hint && (
                      <span className="text-[9px] leading-tight text-muted-foreground">
                        {action.hint}
                      </span>
                    )}
                  </button>
                ))}

                {onInsertSticker && (
                  <button
                    type="button"
                    onClick={() => setShowLibrary(true)}
                    className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/[0.07] bg-white/[0.035] px-2 py-3 text-center transition-colors hover:border-white/15 hover:bg-white/[0.07] active:scale-[0.98]"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.07]">
                      <span aria-hidden="true" className="text-lg leading-none">
                        ✨
                      </span>
                    </span>
                    <span className="text-[11px] font-semibold leading-tight">Rizz library</span>
                    <span className="text-[9px] leading-tight text-muted-foreground">
                      Emoji · stickers
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
