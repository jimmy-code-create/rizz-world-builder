import { useEffect, type RefObject } from "react";
import { Link } from "@tanstack/react-router";
import { CornerDownRight, Loader2, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { GifPicker } from "@/components/GifPicker";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

/**
 * The comment box, shared by every comment surface.
 *
 * It always says who is being answered (with a way out of that state), keeps
 * the draft when a send fails, sends on Enter and breaks the line on
 * Shift+Enter, and only grows as tall as the reader needs — one line at rest,
 * capped so a wall of text never swallows the thread.
 */
export function CommentComposer({
  value,
  onChange,
  onSend,
  pending,
  replyTo,
  onCancelReply,
  maxLength,
  compact = false,
  textareaRef,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  pending: boolean;
  replyTo: { id: string; username: string } | null;
  onCancelReply: () => void;
  maxLength: number;
  compact?: boolean;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  placeholder?: string;
}) {
  const { user, profile } = useAuth();
  const signedIn = Boolean(user);
  const nearLimit = value.length > maxLength * 0.8;

  // Grow with the draft, up to 8rem, then scroll inside the box.
  useEffect(() => {
    const node = textareaRef?.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 128)}px`;
  }, [value, textareaRef]);

  return (
    <div
      className={cn(
        "shrink-0 border-t border-white/10 bg-black/15",
        compact ? "px-3 py-2" : "p-3",
      )}
    >
      {replyTo && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/[0.07] px-2 py-1.5 text-[11px] text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1.5">
            <CornerDownRight className="h-3 w-3 shrink-0 text-primary" />
            <span className="truncate">
              Replying to <span className="font-semibold text-foreground">@{replyTo.username}</span>
            </span>
          </span>
          <button
            type="button"
            onClick={onCancelReply}
            aria-label="Cancel reply"
            className="grid h-5 w-5 shrink-0 place-items-center rounded transition-colors hover:bg-white/10 hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {signedIn ? (
        <>
          <div className="flex items-end gap-2">
            <GifPicker
              onSelect={(marker) =>
                onChange(`${value}${value ? " " : ""}${marker}`.slice(0, maxLength))
              }
            />
            <div className="flex min-w-0 flex-1 items-end rounded-xl border border-white/10 bg-black/25 px-2.5">
              <span
                aria-hidden="true"
                className="mb-2.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground"
              >
                {(profile?.display_name || profile?.username || "?").charAt(0).toUpperCase()}
              </span>
              <Textarea
                ref={textareaRef}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    if (value.trim() && !pending) onSend();
                  }
                }}
                rows={1}
                maxLength={maxLength}
                placeholder={
                  placeholder ?? (replyTo ? `Reply to @${replyTo.username}…` : "Add a comment…")
                }
                aria-label={replyTo ? `Reply to ${replyTo.username}` : "Write a comment"}
                className={cn(
                  "min-h-9 flex-1 resize-none border-0 bg-transparent px-2 py-2 shadow-none focus-visible:ring-0",
                  compact ? "text-[13px]" : "text-sm",
                )}
              />
            </div>
            <Button
              type="button"
              size="icon"
              disabled={!value.trim() || pending}
              onClick={onSend}
              className={cn(
                "shrink-0 border-0 bg-primary text-primary-foreground shadow-md",
                compact ? "h-9 w-9" : "h-10 w-10",
              )}
              aria-label="Send comment"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
              )}
            </Button>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
            <span className="hidden sm:inline">Enter to send · Shift + Enter for a new line</span>
            <span className={cn("tabular-nums", nearLimit ? "text-amber-300" : "opacity-70")}>
              {nearLimit ? `${value.length}/${maxLength}` : ""}
            </span>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between gap-3 px-1 py-1.5">
          <p className="text-xs text-muted-foreground">Sign in to join the conversation.</p>
          <Button asChild size="sm" className="h-8 shrink-0 border-0 bg-primary text-primary-foreground">
            <Link to="/login">Sign in</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
