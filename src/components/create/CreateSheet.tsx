import { Clapperboard, Mic, PenLine, Radio, Sparkles } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/**
 * One Create surface for the whole app.
 *
 * The bottom bar used to swap its center control by route (a live orb on Reels,
 * a plus everywhere else), so the primary action changed shape under the
 * thumb. These rows reuse the editors and rooms that already exist; this sheet
 * only chooses which one opens.
 */

const ROWS = [
  {
    id: "post",
    title: "Post",
    subtitle: "Share a thought, photo or link",
    icon: PenLine,
  },
  {
    id: "reel",
    title: "Reel",
    subtitle: "Upload or record a short video",
    icon: Clapperboard,
  },
  {
    id: "story",
    title: "Story",
    subtitle: "24 hours, then it's gone",
    icon: Sparkles,
  },
  {
    id: "live",
    title: "Go live",
    subtitle: "Camera, screen or both",
    icon: Radio,
  },
  {
    id: "voice",
    title: "Start a voice room",
    subtitle: "Pick a realm and open voice",
    icon: Mic,
  },
] as const;

export type CreateAction = (typeof ROWS)[number]["id"];

export function CreateSheet({
  open,
  onOpenChange,
  onAction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAction: (action: CreateAction) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-border bg-card px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-4"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-xl">Create</SheetTitle>
        </SheetHeader>
        <div className="mt-3 space-y-1">
          {ROWS.map((row) => {
            const Icon = row.icon;
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => onAction(row.id)}
                className="flex min-h-[56px] w-full items-center gap-3 rounded-xl px-2 text-left transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:bg-surface-3"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">
                    {row.title}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {row.subtitle}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
