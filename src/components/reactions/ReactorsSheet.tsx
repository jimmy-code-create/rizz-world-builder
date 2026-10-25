import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldQuestion } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "@/lib/toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ProfilePreviewTrigger } from "@/components/ProfilePreview";
import { CatEmoji } from "@/components/emoji/CatEmoji";
import { catNameForShortcode } from "@/components/emoji/cat-emoji-manifest";
import {
  fetchItemReactors,
  reactionSourceKey,
  reactionSourceTable,
  type ReactionItemSource,
  type ReactorPerson,
} from "@/lib/reactions";

const PAGE_SIZE = 30;

/** Emoji glyph shared by chips, tabs and rows. */
export function ReactionGlyph({ emoji, size = 20 }: { emoji: string; size?: number }) {
  const cat = catNameForShortcode(emoji);
  if (cat) return <CatEmoji name={cat} size={size} animate="hover" />;
  return (
    <span
      aria-hidden
      className="inline-grid place-items-center leading-none"
      style={{ fontSize: size, lineHeight: 1 }}
    >
      {emoji}
    </span>
  );
}

/**
 * Who reacted — one sheet for posts, comments, realm chat, groups and DMs.
 *
 * Phones get a bottom sheet capped at 70dvh; desktop gets a 360px dialog. Both
 * ship exactly one close button (from the primitive), sticky emoji tabs, 52px
 * rows and a 30-row page that grows as you scroll.
 */
export function ReactorsSheet({
  open,
  onOpenChange,
  source,
  groups = [],
  initialEmoji = null,
  onToggle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: ReactionItemSource;
  /** Chips already on screen, so the tabs paint before the list arrives. */
  groups?: { emoji: string; count: number }[];
  initialEmoji?: string | null;
  /** Toggles MY reaction; powers "Tap to remove" and its Undo. */
  onToggle?: (emoji: string) => Promise<boolean | void> | void;
}) {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = reactionSourceKey(source);
  const [tab, setTab] = useState<string>(initialEmoji ?? "all");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [removing, setRemoving] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setTab(initialEmoji ?? "all");
    setLimit(PAGE_SIZE);
  }, [open, initialEmoji]);

  const query = useQuery({
    queryKey: ["reaction-people", key],
    queryFn: () => fetchItemReactors(source, { viewerId: user?.id ?? null }),
    enabled: open && !!source.id,
    staleTime: 60_000,
  });

  // Realtime: the sheet is the one place where a stale list is obvious.
  useEffect(() => {
    if (!open) return;
    const { table, column } = reactionSourceTable(source);
    const channel = supabase
      .channel(`reactors-sheet-${key}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `${column}=eq.${source.id}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: ["reaction-people", key] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // `type` only narrows the server filter for messages; the channel is still
    // scoped to one item, so no cross-talk between chats.
  }, [open, key, source.id, qc]);

  const people = query.data ?? [];

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const group of groups) map.set(group.emoji, group.count);
    if (query.data) {
      map.clear();
      for (const person of query.data) map.set(person.emoji, (map.get(person.emoji) ?? 0) + 1);
    }
    return map;
  }, [groups, query.data]);

  const tabs = useMemo(
    () => [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    [counts],
  );

  const total = query.data?.length ?? [...counts.values()].reduce((sum, count) => sum + count, 0);

  const filtered = tab === "all" ? people : people.filter((person) => person.emoji === tab);
  const page = filtered.slice(0, limit);

  const hasMore = filtered.length > page.length;
  useEffect(() => {
    if (!open || !hasMore) return;
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setLimit((current) => current + PAGE_SIZE);
      },
      { rootMargin: "120px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [open, hasMore, page.length]);

  const removeMine = async (person: ReactorPerson) => {
    if (!onToggle) return;
    setRemoving(person.emoji);
    try {
      const result = await onToggle(person.emoji);
      if (result === false) return;
      toast("Reaction removed", {
        duration: 5000,
        action: { label: "Undo", onClick: () => void onToggle(person.emoji) },
      });
    } finally {
      setRemoving(null);
    }
  };

  const body = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-1.5 overflow-x-auto border-b border-border bg-popover px-4 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => setTab("all")}
          aria-pressed={tab === "all"}
          className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
            tab === "all" ? "text-primary" : "text-muted-foreground hover:text-foreground"
          }`}
          style={tab === "all" ? { background: "var(--overlay-selected)" } : undefined}
        >
          All
          <span className="text-xs tabular-nums opacity-80">{total}</span>
        </button>
        {tabs.map(([emoji, count]) => (
          <button
            key={emoji}
            type="button"
            onClick={() => setTab(emoji)}
            aria-pressed={tab === emoji}
            aria-label={`${emoji} ${count}`}
            className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
              tab === emoji ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
            style={tab === emoji ? { background: "var(--overlay-selected)" } : undefined}
          >
            <ReactionGlyph emoji={emoji} size={18} />
            <span className="text-xs tabular-nums opacity-80">{count}</span>
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-1">
        {query.isLoading &&
          Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex min-h-[52px] items-center gap-3 px-2">
              <span className="skeleton-shimmer h-9 w-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <span className="skeleton-shimmer block h-3 w-28 rounded-full" />
                <span className="skeleton-shimmer block h-2.5 w-16 rounded-full" />
              </div>
            </div>
          ))}

        {!query.isLoading && page.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
            <ShieldQuestion className="h-6 w-6 text-muted-foreground" aria-hidden />
            <p className="text-sm font-semibold">No reactions yet</p>
            <p className="text-xs text-muted-foreground">Be the first to react.</p>
          </div>
        )}

        {page.map((person) => {
          const mine = person.userId === user?.id;
          const initial = person.name.charAt(0).toUpperCase();
          const content = (
            <>
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage src={person.avatarUrl ?? undefined} />
                <AvatarFallback className="bg-secondary text-[11px] font-semibold">
                  {initial}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-semibold">
                  {mine ? "You" : person.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {mine ? "Tap to remove" : person.username ? `@${person.username}` : "Member"}
                </span>
              </span>
              {tab === "all" && <ReactionGlyph emoji={person.emoji} size={20} />}
            </>
          );

          if (!mine) {
            return (
              <ProfilePreviewTrigger
                key={`${person.userId}-${person.emoji}`}
                username={person.username}
                className="flex min-h-[52px] w-full items-center gap-3 rounded-xl px-2 text-left transition-colors hover:bg-[var(--overlay-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {content}
              </ProfilePreviewTrigger>
            );
          }

          return (
            <button
              key={`${person.userId}-${person.emoji}`}
              type="button"
              onClick={() => void removeMine(person)}
              disabled={removing === person.emoji || !onToggle}
              aria-label="Tap to remove your reaction"
              className="flex min-h-[52px] w-full items-center gap-3 rounded-xl px-2 text-left transition-colors hover:bg-[var(--overlay-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
            >
              {content}
            </button>
          );
        })}

        {hasMore && (
          <div ref={sentinelRef} className="flex h-10 items-center justify-center">
            <span className="text-[11px] text-muted-foreground">Loading…</span>
          </div>
        )}
      </div>
    </div>
  );

  const header = (
    <div className="flex items-baseline gap-2 border-b border-border px-4 pb-2.5 pt-1">
      <h2 className="font-display text-base font-bold">Reactions</h2>
      <span className="text-xs tabular-nums text-muted-foreground">{total}</span>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          hideClose={false}
          className="z-[110] flex max-h-[70dvh] flex-col overflow-hidden rounded-t-3xl border-border bg-popover pb-[max(env(safe-area-inset-bottom),0.5rem)]"
        >
          <SheetTitle className="sr-only">Reactions</SheetTitle>
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border" aria-hidden />
          {header}
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[70dvh] w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden border-border bg-popover p-0">
        <DialogTitle className="sr-only">Reactions</DialogTitle>
        {header}
        {body}
      </DialogContent>
    </Dialog>
  );
}

export default ReactorsSheet;
