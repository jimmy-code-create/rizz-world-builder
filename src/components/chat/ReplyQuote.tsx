import { CornerUpLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { replyPreviewText } from "@/lib/chat-reply";
import { EmojiText } from "@/components/emoji/EmojiText";

type ReplyQuoteProps = {
  author?: string | null;
  body?: string | null;
  attachmentUrl?: string | null;
  audioUrl?: string | null;
  /** The original is gone (or could not be loaded). */
  deleted?: boolean;
  onJump?: () => void;
  className?: string;
};

/**
 * The quoted block that sits above a message's text in every chat surface.
 * Tapping it jumps to (and flashes) the original.
 */
export function ReplyQuote({
  author,
  body,
  attachmentUrl,
  audioUrl,
  deleted = false,
  onJump,
  className,
}: ReplyQuoteProps) {
  return (
    <button
      type="button"
      data-interactive="true"
      disabled={!onJump}
      onClick={(event) => {
        event.stopPropagation();
        onJump?.();
      }}
      className={cn(
        "mb-1 flex w-full max-w-full items-center gap-1.5 overflow-hidden rounded-md border-l-2 px-2 py-1 text-left",
        deleted
          ? "border-white/20 bg-white/[0.03]"
          : "border-primary/70 bg-white/[0.04] hover:bg-white/[0.07]",
        className,
      )}
    >
      <CornerUpLeft
        className={cn("h-3.5 w-3.5 shrink-0", deleted ? "text-muted-foreground" : "text-primary")}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1 truncate text-[11px] leading-tight">
        {author ? <span className="mr-1 font-bold text-primary">{author}</span> : null}
        <span className={deleted ? "italic text-muted-foreground" : "text-muted-foreground"}>
          {deleted ? (
            "Original message deleted"
          ) : (
            <EmojiText
              text={replyPreviewText({ body, attachmentUrl, audioUrl })}
              className="whitespace-nowrap"
            />
          )}
        </span>
      </span>
    </button>
  );
}
