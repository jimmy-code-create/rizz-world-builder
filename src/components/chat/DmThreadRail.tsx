import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/**
 * Desktop two-pane messages: the conversation list beside the open chat.
 *
 * It reuses the exact `["dm-threads", user.id]` query the `/dms` page uses, so
 * React Query serves both from one cache entry and the list never disagrees with
 * the mobile page. Hidden below `lg` (the phone layout keeps its own list page).
 */
type Thread = {
  other: { id: string; username: string | null; display_name: string | null; avatar_url: string | null };
  last: { body: string | null; attachment_url: string | null; created_at: string; sender_id: string };
  unread: number;
};

function timeLabel(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function DmThreadRail({ activeId }: { activeId: string }) {
  const { user } = useAuth();

  const threads = useQuery({
    queryKey: ["dm-threads", user?.id],
    queryFn: async (): Promise<Thread[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("direct_messages")
        .select("*, sender:profiles!direct_messages_sender_id_fkey(id,username,display_name,avatar_url), recipient:profiles!direct_messages_recipient_id_fkey(id,username,display_name,avatar_url)")
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const map = new Map<string, Thread>();
      for (const message of data ?? []) {
        const other = message.sender_id === user.id ? message.recipient : message.sender;
        if (!other) continue;
        const existing = map.get(other.id);
        const isUnread = message.recipient_id === user.id && !message.read;
        if (!existing) {
          map.set(other.id, {
            other,
            last: {
              body: message.body,
              attachment_url: message.attachment_url,
              created_at: message.created_at,
              sender_id: message.sender_id,
            },
            unread: isUnread ? 1 : 0,
          });
        } else if (isUnread) {
          existing.unread += 1;
        }
      }
      return Array.from(map.values());
    },
    enabled: !!user,
    retry: false,
  });

  return (
    <aside className="hidden h-full w-[320px] shrink-0 flex-col border-r border-white/10 bg-[var(--surface)]/60 lg:flex">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <p className="font-display text-sm font-bold tracking-tight">Messages</p>
        <Link to="/dms" className="text-[11px] font-semibold text-[var(--rizz-pink)] hover:underline">
          New
        </Link>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {threads.isLoading && (
          <div className="space-y-2 p-3">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="h-14 animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
        )}
        {!threads.isLoading && (threads.data ?? []).length === 0 && (
          <div className="grid place-items-center gap-2 p-6 text-center text-xs text-muted-foreground">
            <MessageCircle className="h-5 w-5" />
            No conversations yet
          </div>
        )}
        {(threads.data ?? []).map((thread) => {
          const active = thread.other.id === activeId;
          const preview = thread.last.attachment_url
            ? "Photo"
            : (thread.last.body ?? "").replace(/\s+/g, " ").trim() || "Message";
          return (
            <Link
              key={thread.other.id}
              to="/dm/$userId"
              params={{ userId: thread.other.id }}
              className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${
                active ? "bg-white/10" : "hover:bg-white/5"
              }`}
            >
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={thread.other.avatar_url ?? undefined} />
                <AvatarFallback className="bg-gradient-primary text-xs font-bold">
                  {(thread.other.username ?? "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <p className="truncate text-sm font-semibold">
                    {thread.other.display_name || thread.other.username}
                  </p>
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                    {timeLabel(thread.last.created_at)}
                  </span>
                </div>
                <p className={`truncate text-xs ${thread.unread > 0 ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                  {thread.last.sender_id === user?.id ? "You: " : ""}
                  {preview}
                </p>
              </div>
              {thread.unread > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[var(--rizz-pink)] px-1.5 text-[10px] font-bold text-white">
                  {thread.unread}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
