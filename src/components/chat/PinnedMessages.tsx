import { Pin, PinOff, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { pinnedPreview, type PinnedMessageDetails } from "@/lib/pins";

/**
 * Slim pinned bar that sits under the channel tabs. Tapping it jumps to the
 * current pin and moves on to the next one; the counter opens the full list.
 */
export function PinnedBar({
  pins,
  index,
  onJump,
  onOpenList,
}: {
  pins: PinnedMessageDetails[];
  index: number;
  onJump: (pin: PinnedMessageDetails) => void;
  onOpenList: () => void;
}) {
  if (!pins.length) return null;
  const current = pins[index % pins.length];
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-white/5 bg-white/[0.03] px-3 py-1.5">
      <button
        type="button"
        onClick={() => onJump(current)}
        className="flex min-h-[48px] min-w-0 flex-1 items-center gap-2 text-left"
        aria-label="Jump to pinned message"
      >
        <Pin className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {pinnedPreview(current.message?.body, current.message?.attachment_url)}
        </span>
      </button>
      <button
        type="button"
        onClick={onOpenList}
        className="shrink-0 rounded-full bg-white/[0.06] px-3 py-2 text-[11px] font-semibold text-muted-foreground hover:bg-white/10"
        aria-label="Show all pinned messages"
      >
        {index + 1} of {pins.length}
      </button>
    </div>
  );
}

/** Small pin marker shown on a pinned message in the chat. */
export function PinBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary"
      title="Pinned message"
    >
      <Pin className="h-2.5 w-2.5" />
    </span>
  );
}

/** The "@user pinned a message" system line. */
export function SystemLine({ text }: { text: string }) {
  return (
    <div className="flex justify-center py-1">
      <span className="flex items-center gap-1.5 rounded-full bg-black/20 px-3 py-1 text-[10px] font-medium text-muted-foreground">
        <Pin className="h-3 w-3" />
        {text}
      </span>
    </div>
  );
}

/** Full pinned list: sender, time and a preview per row, with Unpin for mods. */
export function PinnedListSheet({
  open,
  onOpenChange,
  pins,
  canModerate,
  onJump,
  onUnpin,
  unpinningId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pins: PinnedMessageDetails[];
  canModerate: boolean;
  onJump: (pin: PinnedMessageDetails) => void;
  onUnpin: (pin: PinnedMessageDetails) => void;
  unpinningId?: string | null;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="glass-strong rounded-t-3xl border-white/10 max-h-[85dvh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]"
      >
        <SheetTitle className="font-display text-lg">Pinned messages</SheetTitle>
        <SheetDescription className="text-xs text-muted-foreground">
          {pins.length === 0 ? "Nothing pinned in this channel yet." : `${pins.length} pinned in this channel.`}
        </SheetDescription>

        <div className="mt-4 space-y-2">
          {pins.map((pin) => (
            <div key={pin.id} className="flex items-start gap-3 rounded-2xl border border-white/5 glass p-3">
              <button
                type="button"
                onClick={() => onJump(pin)}
                className="flex min-h-[48px] min-w-0 flex-1 items-start gap-3 text-left"
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={pin.message?.sender?.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-bold">
                    {(pin.message?.sender?.username ?? "?").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold">
                    {pin.message?.sender?.display_name || pin.message?.sender?.username || "Member"}
                    <span className="ml-2 font-normal text-muted-foreground">
                      {new Date(pin.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {pinnedPreview(pin.message?.body, pin.message?.attachment_url)}
                  </span>
                </span>
              </button>
              {canModerate && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={unpinningId === pin.message_id}
                  onClick={() => onUnpin(pin)}
                  className="h-12 shrink-0 gap-1.5 glass border-white/10 text-destructive"
                >
                  <PinOff className="h-3.5 w-3.5" /> Unpin
                </Button>
              )}
            </div>
          ))}
          {pins.length === 0 && (
            <div className="rounded-2xl border border-white/5 glass p-6 text-center text-sm text-muted-foreground">
              <Pin className="mx-auto mb-2 h-5 w-5" />
              Pinned messages show up here for everyone in the realm.
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="mt-4 flex min-h-[44px] w-full items-center justify-center rounded-xl glass border border-white/10 text-sm font-medium hover:bg-white/5 active:scale-[0.99] transition-all"
        >
          Close
        </button>
      </SheetContent>
    </Sheet>
  );
}
