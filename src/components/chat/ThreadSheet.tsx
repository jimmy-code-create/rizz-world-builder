import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessagesSquare, Send } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { fetchThread, sendThreadReply, threadKey, type ThreadMessage } from "@/lib/realm-threads";
import { toast } from "sonner";

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

  const replies = useQuery({
    queryKey: threadKey(root?.id),
    enabled: open && !!root,
    queryFn: () => fetchThread(root!.id),
  });

  useEffect(() => {
    if (!open) setDraft("");
  }, [open]);

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
      });
      setDraft("");
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
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {root.author ?? "Member"}
            </p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm">{root.body}</p>
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
            const name = reply.bot?.name || reply.sender?.display_name || reply.sender?.username || "Member";
            return (
              <div
                key={reply.id}
                className={`max-w-[92%] rounded-2xl px-3 py-2 ${mine ? "ml-auto message-bubble--outgoing" : "message-bubble--incoming"}`}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{name}</p>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">{reply.body}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {new Date(reply.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
            );
          })}
          {!replies.isLoading && (replies.data ?? []).length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No replies yet. Start the thread.
            </p>
          )}
        </div>

        <form
          className="flex shrink-0 items-center gap-2 border-t border-white/10 px-3 py-3"
          onSubmit={(event) => { event.preventDefault(); void send(); }}
        >
          <Input
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
