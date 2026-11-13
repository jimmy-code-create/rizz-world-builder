import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CornerUpLeft, Loader2, MessagesSquare, Send, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { fetchThread, sendThreadReply, threadKey, type ThreadMessage } from "@/lib/realm-threads";
import { SwipeableMessage } from "@/components/chat/SwipeToReply";
import { ReplyQuote } from "@/components/chat/ReplyQuote";
import { replyPreviewText } from "@/lib/chat-reply";
import { EmojiText } from "@/components/emoji/EmojiText";
import { toast } from "@/lib/toast";

type ThreadSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The message the thread hangs off. */
  root: { id: string; body: string; author: string | null } | null;
  realmId: string;
  roomId: string | null;
};

/**
 * Threads are the existing messages table with `thread_root` set, so the sheet
 * only loads that slice and posts replies with the same insert the composer
 * uses — no second message store to keep in sync.
 */
export function ThreadSheet({ open, onOpenChange, root, realmId, roomId }: ThreadSheetProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<{
    id: string;
    body: string;
    author: string | null;
    attachmentUrl?: string | null;
  } | null>(null);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const replies = useQuery({
    queryKey: threadKey(root?.id),
    enabled: open && !!root,
    queryFn: () => fetchThread(root!.id),
  });

  useEffect(() => {
    if (!open) {
      setDraft("");
      setReplyTo(null);
    }
  }, [open]);

  // A different thread must not inherit the last one's quote.
  useEffect(() => {
    setReplyTo(null);
  }, [root?.id]);

  /** Scroll to the quoted message (the root counts) and flash it. */
  const jumpTo = (messageId: string) => {
    const element =
      messageId === root?.id
        ? document.getElementById("thread-root")
        : document.getElementById(`thread-msg-${messageId}`);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlighted(messageId);
    window.setTimeout(
      () => setHighlighted((current) => (current === messageId ? null : current)),
      2200,
    );
  };

  if (!root) return null;

  const send = async () => {
    if (!user || !draft.trim() || sending) return;
    setSending(true);
    try {
      const list = replies.data ?? [];
      await sendThreadReply({
        realmId,
        roomId,
        senderId: user.id,
        rootId: root.id,
        parentId: list[list.length - 1]?.id ?? root.id,
        body: draft.trim(),
        replyToId: replyTo?.id ?? null,
      });
      setDraft("");
      setReplyTo(null);
      await qc.invalidateQueries({ queryKey: threadKey(root.id) });
      await qc.invalidateQueries({ queryKey: ["realm-messages", realmId] });
      if (roomId) await qc.invalidateQueries({ queryKey: ["realm-room-messages", roomId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't send that reply");
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="glass-strong flex w-full flex-col gap-0 border-white/10 p-0 sm:max-w-md"
      >
        <SheetHeader className="shrink-0 border-b border-white/10 px-4 py-3 text-left">
          <SheetTitle className="flex items-center gap-2 font-display text-base">
            <MessagesSquare className="h-4 w-4 text-primary" /> Thread
          </SheetTitle>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          <div
            id="thread-root"
            className={`rounded-2xl border border-white/10 bg-white/[0.04] p-3 ${
              highlighted === root.id ? "chat-jump-highlight" : ""
            }`}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {root.author ?? "Member"}
            </p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm">
              <EmojiText text={root.body} />
            </p>
          </div>

          {replies.isLoading && (
            <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading replies…
            </p>
          )}
          {replies.isError && (
            <p className="py-6 text-sm text-destructive">Couldn't load this thread.</p>
          )}
          {(replies.data ?? []).map((reply: ThreadMessage) => {
            const mine = reply.sender_id === user?.id;
            const name =
              reply.bot?.name || reply.sender?.display_name || reply.sender?.username || "Member";
            const source =
              reply.reply_to && reply.reply_to !== root.id
                ? (replies.data ?? []).find((row) => row.id === reply.reply_to)
                : null;
            const sourceAuthor =
              reply.reply_to === root.id
                ? root.author
                : source?.bot?.name ||
                  source?.sender?.display_name ||
                  source?.sender?.username ||
                  null;
            return (
              <SwipeableMessage
                key={reply.id}
                className={mine ? "ml-auto w-[92%]" : "w-[92%]"}
                onReply={() => {
                  setReplyTo({
                    id: reply.id,
                    body: reply.body,
                    author: name,
                    attachmentUrl: reply.attachment_url ?? null,
                  });
                  requestAnimationFrame(() => inputRef.current?.focus());
                }}
              >
                <div
                  id={`thread-msg-${reply.id}`}
                  className={`group relative rounded-2xl px-3 py-2 ${mine ? "message-bubble--outgoing" : "message-bubble--incoming"} ${
                    highlighted === reply.id ? "chat-jump-highlight" : ""
                  }`}
                >
                  <button
                    type="button"
                    aria-label="Reply"
                    title="Reply"
                    onClick={(event) => {
                      event.stopPropagation();
                      setReplyTo({
                        id: reply.id,
                        body: reply.body,
                        author: name,
                        attachmentUrl: reply.attachment_url ?? null,
                      });
                      inputRef.current?.focus();
                    }}
                    className="absolute right-1.5 top-1.5 hidden h-6 w-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground group-hover:grid"
                  >
                    <CornerUpLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {name}
                  </p>
                  {reply.reply_to ? (
                    <ReplyQuote
                      author={sourceAuthor}
                      body={reply.reply_to === root.id ? root.body : (source?.body ?? null)}
                      attachmentUrl={source?.attachment_url ?? null}
                      deleted={reply.reply_to !== root.id && !source}
                      onJump={
                        reply.reply_to === root.id || source
                          ? () => jumpTo(reply.reply_to as string)
                          : undefined
                      }
                    />
                  ) : null}
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">
                    <EmojiText text={reply.body} />
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {new Date(reply.created_at).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </SwipeableMessage>
            );
          })}
          {!replies.isLoading && (replies.data ?? []).length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No replies yet. Start the thread.
            </p>
          )}
        </div>

        {replyTo && (
          <div className="flex shrink-0 items-center gap-2 border-t border-white/10 px-3 py-2">
            <CornerUpLeft className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-bold uppercase tracking-wider text-primary">
                Replying to {replyTo.author ?? "Member"}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {replyPreviewText({ body: replyTo.body, attachmentUrl: replyTo.attachmentUrl })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setReplyTo(null);
                inputRef.current?.focus();
              }}
              aria-label="Cancel reply"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <form
          className="flex shrink-0 items-center gap-2 border-t border-white/10 px-3 py-3"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <Input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Reply in thread"
            maxLength={500}
            className="glass border-white/10"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!draft.trim() || sending}
            className="shrink-0 bg-primary text-primary-foreground border-0 shadow-md"
            aria-label="Send reply"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
