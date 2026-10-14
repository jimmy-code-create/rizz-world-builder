import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchBlocked } from "@/lib/social";
import { Heart, Sparkles, X, User } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export type PostReactionUser = {
  emoji: string;
  user_id: string;
  created_at?: string;
  user?: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    bio?: string | null;
  };
};

export function PostReactionsSheet({
  postId,
  open,
  onOpenChange,
  initialEmoji,
}: {
  postId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEmoji?: string | null;
}) {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { t } = useI18n();
  const [selectedTab, setSelectedTab] = useState<string>(initialEmoji || "all");

  const query = useQuery({
    queryKey: ["post-reactors-sheet", postId, user?.id],
    enabled: open && !!postId,
    staleTime: 10_000,
    queryFn: async (): Promise<PostReactionUser[]> => {
      const { data: rows, error } = await supabase
        .from("post_reactions")
        .select("emoji, user_id, created_at")
        .eq("post_id", postId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!rows || rows.length === 0) return [];

      const blockedRows = user ? await fetchBlocked(user.id) : [];
      const blocked = new Set(blockedRows.map((r: { blocked_id: string }) => r.blocked_id));
      const filtered = rows.filter((r) => !blocked.has(r.user_id));

      const userIds = [...new Set(filtered.map((r) => r.user_id))];
      if (userIds.length === 0) return [];

      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio")
        .in("id", userIds);

      if (pErr) throw pErr;
      const pMap = new Map((profiles ?? []).map((p) => [p.id, p]));

      return filtered.map((r) => ({
        emoji: r.emoji,
        user_id: r.user_id,
        created_at: r.created_at,
        user: pMap.get(r.user_id) || {
          id: r.user_id,
          username: "user",
          display_name: null,
          avatar_url: null,
        },
      }));
    },
  });

  const reactions = query.data ?? [];

  // Group by emoji
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of reactions) {
      counts[r.emoji] = (counts[r.emoji] || 0) + 1;
    }
    return counts;
  }, [reactions]);

  const uniqueEmojis = Object.keys(tabCounts);

  const displayedList = useMemo(() => {
    if (selectedTab === "all") return reactions;
    return reactions.filter((r) => r.emoji === selectedTab);
  }, [reactions, selectedTab]);

  const content = (
    <div className="flex flex-col h-full max-h-[80vh] overflow-hidden">
      {/* Tabs bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-white/10 px-4 py-2.5 shrink-0">
        <button
          type="button"
          onClick={() => setSelectedTab("all")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
            selectedTab === "all"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "glass border-white/10 text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>{t("all_reactions")}</span>
          <span className="font-mono text-[10px] opacity-80">{reactions.length}</span>
        </button>

        {uniqueEmojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => setSelectedTab(emoji)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              selectedTab === emoji
                ? "bg-primary text-primary-foreground shadow-sm"
                : "glass border-white/10 text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>{emoji}</span>
            <span className="font-mono text-[10px] opacity-80">{tabCounts[emoji]}</span>
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {query.isLoading && (
          <div className="py-12 text-center text-xs text-muted-foreground">
            Loading reactions…
          </div>
        )}

        {!query.isLoading && displayedList.length === 0 && (
          <div className="py-12 text-center text-xs text-muted-foreground">
            No reactions found for this tab.
          </div>
        )}

        {displayedList.map((item, idx) => {
          const u = item.user;
          const uName = u?.display_name || u?.username || "user";
          return (
            <div
              key={`${item.user_id}-${item.emoji}-${idx}`}
              className="flex items-center justify-between gap-3 p-2 rounded-2xl hover:bg-white/[0.04] transition-colors"
            >
              <Link
                to="/u/$username"
                params={{ username: u?.username ?? "" }}
                onClick={() => onOpenChange(false)}
                className="flex items-center gap-3 min-w-0 flex-1"
              >
                <div className="relative shrink-0">
                  <Avatar className="h-10 w-10 ring-1 ring-white/15">
                    <AvatarImage src={u?.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-primary/20 text-primary font-bold text-xs">
                      {uName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute -bottom-1 -right-1 text-base leading-none drop-shadow-sm select-none">
                    {item.emoji}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate hover:underline">
                    {uName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    @{u?.username}
                  </p>
                </div>
              </Link>

              <Link
                to="/u/$username"
                params={{ username: u?.username ?? "" }}
                onClick={() => onOpenChange(false)}
                className="text-xs font-semibold px-3 py-1.5 rounded-full border border-white/10 hover:bg-white/10 text-muted-foreground hover:text-foreground shrink-0"
              >
                Profile
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="glass-strong z-[100] rounded-t-3xl border-white/10 p-0 pb-[max(env(safe-area-inset-bottom),1rem)]">
          <SheetHeader className="p-4 border-b border-white/10 flex flex-row items-center justify-between">
            <SheetTitle className="font-display text-base font-bold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> {t("reactions")} ({reactions.length})
            </SheetTitle>
            <button
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 rounded-full grid place-items-center text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-white/10 max-w-md w-full p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b border-white/10">
          <DialogTitle className="font-display text-base font-bold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> {t("reactions")} ({reactions.length})
          </DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
