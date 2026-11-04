import { useState } from "react";
import { Plus, X, type LucideIcon } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * The composer's `+`.
 *
 * Every chat (DM, group, realm) opens this same sheet: one square tile per
 * action — an icon, a word, and a one-line hint — so nothing is discoverable
 * only by guessing what a lone photo icon does.
 *
 * The tiles are square on purpose. The sheet is a row of equal choices, and a
 * square grid reads as a palette instead of a list of differently sized
 * buttons. The trigger is a squared tile too, so the `+` matches them.
 *
 * The Rizz library used to live here as a sub-view. It duplicated the sticker
 * pack the composer already has, and it hid the poll behind another tap, so it
 * is gone — the `+` is for things you attach or start.
 */
export type ChatAttachAction = {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  onSelect: () => void;
  disabled?: boolean;
};

export function ChatAttachButton({
  actions,
  disabled,
  className,
  label = "Add to your message",
  appearance = "tile",
}: {
  actions: ChatAttachAction[];
  disabled?: boolean;
  className?: string;
  label?: string;
  /** `circle` is the chat composer's 44px disc; `tile` is the squared frame. */
  appearance?: "tile" | "circle";
}) {
  const [open, setOpen] = useState(false);

  const run = (action: ChatAttachAction) => {
    if (action.disabled) return;
    setOpen(false);
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
          appearance === "circle"
            ? "group grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border bg-surface-2 text-muted-foreground transition-colors hover:border-foreground/25 hover:bg-surface-3 hover:text-foreground disabled:opacity-40"
            : "group grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-surface-2 text-muted-foreground transition-colors hover:border-foreground/20 hover:bg-surface-3 hover:text-foreground disabled:opacity-40",
          className,
        )}
      >
        {appearance === "circle" ? (
          // The composer's attach is a plain disc: no nested frame, a plus with
          // rounded caps at the visual weight of the send arrow.
          <Plus className="h-5 w-5" strokeWidth={2} strokeLinecap="round" />
        ) : (
          // A squared frame inside the squared button: the plus always sits in
          // a box, at 44px and at the 36px DM size alike.
          <span className="grid h-6 w-6 place-items-center rounded-md border border-border bg-surface-3 transition-colors group-hover:border-foreground/20">
            <Plus className="h-4 w-4" />
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          hideClose
          className="glass-strong max-h-[78dvh] rounded-t-3xl border-border pb-[max(env(safe-area-inset-bottom),0.75rem)]"
        >
          <SheetTitle className="sr-only">Attachments</SheetTitle>
          <div className="mx-auto mb-3 mt-1 h-1 w-10 rounded-full bg-border" aria-hidden="true" />

          <div className="px-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">Add to your message</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
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
                  className="group flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-surface-2 px-2 text-center transition-colors hover:border-foreground/20 hover:bg-surface-3 active:scale-[0.98] disabled:opacity-40"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-surface-3 text-foreground transition-colors group-hover:border-foreground/20">
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
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
