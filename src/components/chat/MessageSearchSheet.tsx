import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Hash, Loader2, Search } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { searchRealmMessages, searchReady, type SearchResult } from "@/lib/realm-search";

type MessageSearchSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  realmId: string;
  /** null searches every channel the caller may read. */
  roomId: string | null;
  onJump: (messageId: string) => void;
};

/**
 * Search runs inside `search_realm_messages`, which hides private channels the
 * caller cannot see and returns the thread root so a hit inside a thread still
 * lands somewhere sensible.
 */
export function MessageSearchSheet({ open, onOpenChange, realmId, roomId, onJump }: MessageSearchSheetProps) {
  const [term, setTerm] = useState("");

  useEffect(() => {
    if (!open) setTerm("");
  }, [open]);

  const query = term.trim();
  const results = useQuery({
    queryKey: ["realm-search", realmId, roomId ?? "", query],
    enabled: open && searchReady(query),
    staleTime: 15_000,
    queryFn: (): Promise<SearchResult[]> =>
      searchRealmMessages({ realmId, query, roomId, limit: 30 }),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="glass-strong flex w-full flex-col gap-0 border-white/10 p-0 sm:max-w-md">
        <SheetHeader className="shrink-0 border-b border-white/10 px-4 py-3 text-left">
          <SheetTitle className="flex items-center gap-2 font-display text-base">
            <Search className="h-4 w-4 text-primary" /> Search messages
          </SheetTitle>
        </SheetHeader>

        <div className="shrink-0 border-b border-white/10 px-4 py-3">
          <Input
            autoFocus
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search this realm…"
            className="glass border-white/10"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {query.length === 1 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Type at least two characters.</p>
          )}
          {searchReady(query) && results.isLoading && (
            <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching…
            </p>
          )}
          {searchReady(query) && !results.isLoading && (results.data ?? []).length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Nothing matched that.</p>
          )}
          <div className="space-y-2">
            {(results.data ?? []).map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => { onJump(row.id); onOpenChange(false); }}
                className="block w-full rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left transition-colors hover:bg-white/[0.07]"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-semibold">
                    {row.bot_name || row.author_name || "Member"}
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                    <Hash className="h-3 w-3" />
                    {row.room_name ?? "general"}
                  </span>
                </span>
                <span className="mt-1 line-clamp-3 block whitespace-pre-wrap break-words text-sm">
                  {row.body}
                </span>
                <span className="mt-1 block text-[10px] text-muted-foreground">
                  {new Date(row.created_at).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  {row.reply_count > 0 ? ` · ${row.reply_count} replies` : ""}
                </span>
              </button>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
