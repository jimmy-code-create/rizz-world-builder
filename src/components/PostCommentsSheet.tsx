import { useState } from "react";
import { Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CloseButton } from "@/components/ui/close-button";
import { CommentSection } from "@/components/comments/CommentSection";

/**
 * The full-screen comment page.
 *
 * The thread itself is `CommentSection`, the same component the feed card, the
 * desktop discussion pane and reel comments use — this file only supplies the
 * roomy dialog chrome around it, so replies, votes, reactions and deletes are
 * identical everywhere by construction.
 */
export function PostCommentsSheet({
  postId,
  open,
  onOpenChange,
}: {
  postId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="flex h-[92dvh] w-[min(100vw-1rem,44rem)] max-w-none flex-col gap-0 overflow-hidden rounded-3xl border-white/10 glass-strong p-0 sm:h-[86dvh]"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5">
          <DialogTitle className="min-w-0 truncate font-display text-base font-bold">
            Comments
          </DialogTitle>
          <DialogClose asChild>
            <CloseButton />
          </DialogClose>
        </div>
        <CommentSection postId={postId} className="min-h-0 flex-1" />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Small launcher that owns its own open state, so a post card can offer the
 * full-screen page without threading another piece of state through it.
 */
export function PostCommentsButton({ postId }: { postId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label="Open the full-screen comments page"
        className="h-8 w-8 text-muted-foreground rounded-full relative touch-manipulation before:absolute before:-inset-y-1.5 before:-inset-x-1"
      >
        <Maximize2 className="h-4 w-4" />
      </Button>
      <PostCommentsSheet postId={postId} open={open} onOpenChange={setOpen} />
    </>
  );
}
