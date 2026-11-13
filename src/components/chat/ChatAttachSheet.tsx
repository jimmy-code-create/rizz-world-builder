import { useState } from "react";
import { Camera, Plus, X, type LucideIcon } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * The composer's `+`.
 *
 * Every chat (DM, group, realm) opens this same sheet, and it opens on the
 * photo library: the pictures already shared in this conversation, newest
 * first, one tap to send again. The camera tile sits in front of them, so the
 * two ways people actually add a photo — take one, or reuse one — are the first
 * things in the sheet.
 *
 * The actions live in one floating bar underneath, icon over word: Photos,
 * Poll, Apps (GIF and stickers), Files, plus whatever the screen adds. The bar
 * is the same row at every width; the photo grid is what fills the sheet.
 */
export type ChatAttachAction = {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  onSelect: () => void;
  disabled?: boolean;
};

export type ChatAttachPhoto = {
  id: string;
  url: string;
};

export function ChatAttachButton({
  actions,
  photos,
  onPickPhoto,
  disabled,
  className,
  label = "Add to your message",
  appearance = "tile",
}: {
  actions: ChatAttachAction[];
  /** Photos already in this conversation, newest first. */
  photos?: ChatAttachPhoto[];
  /** Send one of them again: the sheet closes and the photo is attached. */
  onPickPhoto?: (url: string) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
  /** `circle` is the chat composer's 40px disc; `tile` is the squared frame. */
  appearance?: "tile" | "circle";
}) {
  const [open, setOpen] = useState(false);
  const cameraAction = actions.find((action) => action.id === "camera");

  const run = (action: ChatAttachAction) => {
    if (action.disabled) return;
    setOpen(false);
    // Let the sheet's exit animation start before a file dialog steals focus,
    // otherwise iOS drops the dialog and the picker never appears.
    window.setTimeout(action.onSelect, 60);
  };

  const pickPhoto = (url: string) => {
    if (!onPickPhoto) return;
    setOpen(false);
    window.setTimeout(() => onPickPhoto(url), 60);
  };

  const library = photos ?? [];
  const showGrid = Boolean(cameraAction || library.length);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-label={label}
        className={cn(
          appearance === "circle"
            ? "group grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[rgba(255,255,255,0.12)] bg-[#141414] text-[#cfcfcf] transition-colors hover:border-primary/40 hover:bg-[#1a1a1a] hover:text-primary disabled:opacity-40"
            : "group grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-muted-foreground transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-foreground disabled:opacity-40",
          className,
        )}
      >
        {appearance === "circle" ? (
          // The composer's attach is a plain disc: no nested frame, a plus with
          // rounded caps at the visual weight of the send arrow.
          <Plus className="h-[18px] w-[18px]" strokeWidth={2} strokeLinecap="round" />
        ) : (
          // A squared frame inside the squared button: the plus always sits in
          // a box, at 44px and at the 36px DM size alike.
          <span className="grid h-6 w-6 place-items-center rounded-md border border-white/10 bg-white/[0.06] transition-colors group-hover:border-white/20">
            <Plus className="h-4 w-4" />
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          hideClose
          className="glass-strong flex max-h-[82dvh] flex-col gap-0 overflow-hidden rounded-t-3xl border-white/10 p-0 pb-[max(env(safe-area-inset-bottom),0.5rem)]"
        >
          <SheetTitle className="sr-only">Add to your message</SheetTitle>
          <div className="mx-auto mb-2 mt-2 h-1 w-10 shrink-0 rounded-full bg-white/20" aria-hidden="true" />

          <div className="flex shrink-0 items-center justify-end px-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {showGrid && (
            <div className="rizz-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-2">
              <div className="grid grid-cols-3 gap-[3px] sm:grid-cols-4">
                {cameraAction && (
                  <button
                    type="button"
                    onClick={() => run(cameraAction)}
                    disabled={cameraAction.disabled}
                    className="grid aspect-square place-items-center rounded-[10px] bg-white/[0.07] text-muted-foreground transition-colors hover:bg-white/[0.12] hover:text-foreground disabled:opacity-40"
                    aria-label="Take a photo"
                  >
                    <Camera className="h-7 w-7" strokeWidth={1.6} />
                  </button>
                )}
                {library.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => pickPhoto(photo.url)}
                    className="group relative aspect-square overflow-hidden rounded-[10px] bg-white/[0.05] active:opacity-80"
                    aria-label="Send this photo"
                  >
                    <img
                      src={photo.url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.04]"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div
            className={cn(
              "mx-3 mb-1 flex shrink-0 items-stretch justify-around gap-1 rounded-3xl border border-white/[0.08] bg-[#0c0c0c]/90 p-1.5 backdrop-blur",
              !showGrid && "mt-2",
            )}
          >
            {actions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => run(action)}
                disabled={action.disabled}
                className="group flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground disabled:opacity-40"
              >
                <span className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.06] text-foreground transition-colors group-hover:border-white/20">
                  <action.icon className="h-[17px] w-[17px]" />
                </span>
                <span className="max-w-full truncate">{action.label}</span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
