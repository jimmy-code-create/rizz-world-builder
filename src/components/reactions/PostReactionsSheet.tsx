import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchBlocked } from "@/lib/social";
import { Smile, UserPlus, Check, Undo2 } from "lucide-react";
import { toast } from "sonner";
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
  const qc = useQueryClient();
  const [selectedTab, setSelectedTab] = useState<string>(initialEmoji || "all");
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (initialEmoji) setSelectedTab(initialEmoji);
  }, [initialEmoji]);

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

  // Query following state
  useQuery({
    queryKey: ["my-follows", user?.id],
    enabled: open && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user!.id);
      const set = new Set((data ?? []).map((r: { following_id: string }) => r.following_id));
      setFollowingSet(set);
      return set;
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

  const handleToggleFollow = async (targetId: string) => {
    if (!user) {
      toast.error("Sign in to follow creators");
      return;
    }
    const isFollowing = followingSet.has(targetId);
    setFollowingSet((prev) => {
      const next = new Set(prev);
      if (isFollowing) next.delete(targetId);
      else next.add(targetId);
      return next;
    });

    try {
      if (isFollowing) {
        await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", targetId);
      } else {
        await supabase.from("follows").insert({ follower_id: user.id, following_id: targetId });
      }
      qc.invalidateQueries({ queryKey: ["my-follows", user.id] });
    } catch {
      // Rollback
      setFollowingSet((prev) => {
        const next = new Set(prev);
        if (isFollowing) next.add(targetId);
        else next.delete(targetId);
        return next;
      });
      toast.error("Couldn't update follow status");
    }
  };

  const handleRemoveOwnReaction = async (emoji: string) => {
    if (!user) return;
    try {
      await supabase
        .from("post_reactions")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", user.id)
        .eq("emoji", emoji);

      qc.invalidateQueries({ queryKey: ["post-reactors-sheet", postId] });
      qc.invalidateQueries({ queryKey: ["feed-posts"] });
      qc.invalidateQueries({ queryKey: ["posts"] });

      toast("Reaction removed", {
        action: {
          label: "Undo",
          onClick: async () => {
            await supabase
              .from("post_reactions")
              .insert({ post_id: postId, user_id: user.id, emoji });
            qc.invalidateQueries({ queryKey: ["post-reactors-sheet", postId] });
            qc.invalidateQueries({ queryKey: ["feed-posts"] });
            qc.invalidateQueries({ queryKey: ["posts"] });
            toast.success("Reaction restored");
          },
        },
      });
    } catch {
      toast.error("Couldn't remove reaction");
    }
  };

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
              : "glass border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/5"
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
                : "glass border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/5"
            }`}
          >
            <span>{emoji}</span>
            <span className="font-mono text-[10px] opacity-80">{tabCounts[emoji]}</span>
          </button>
        ))}
      </div>

      {/* List: 56px rows */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
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
          const isMe = user?.id === item.user_id;
          const isFollowing = followingSet.has(item.user_id);
          const uName = u?.display_name || u?.username || "user";

          return (
            <div
              key={`${item.user_id}-${item.emoji}-${idx}`}
              className="flex min-h-[56px] items-center justify-between gap-3 p-2.5 rounded-xl border border-white/5 bg-card/40 hover:bg-white/[0.04] transition-colors"
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
                    <AvatarFallback className="bg-surface-2 text-foreground font-bold text-xs">
                      {uName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {isMe ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void handleRemoveOwnReaction(item.emoji);
                      }}
                      title="Tap to remove your reaction"
                      aria-label="Remove your reaction"
                      className="absolute -bottom-1 -right-1 text-base leading-none drop-shadow-sm select-none transition-transform hover:scale-125 active:scale-95 cursor-pointer rounded-full"
                    >
                      {item.emoji}
                    </button>
                  ) : (
                    <span className="absolute -bottom-1 -right-1 text-base leading-none drop-shadow-sm select-none">
                      {item.emoji}
                    </span>
                  )}
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

              {isMe ? (
                <button
                  type="button"
                  onClick={() => void handleRemoveOwnReaction(item.emoji)}
                  className="text-[11px] font-medium text-muted-foreground hover:text-destructive px-2.5 py-1 rounded-lg border border-white/10 hover:border-destructive/40 transition-colors"
                >
                  Remove
                </button>
              ) : user ? (
                <Button
                  size="sm"
                  variant={isFollowing ? "outline" : "default"}
                  onClick={() => void handleToggleFollow(item.user_id)}
                  className={`h-8 px-3 rounded-lg text-xs font-semibold shrink-0 gap-1 ${
                    isFollowing
                      ? "glass border-white/10 text-muted-foreground hover:text-foreground"
                      : "bg-primary text-primary-foreground border-0 shadow-sm"
                  }`}
                >
                  {isFollowing ? (
                    <>
                      <Check className="h-3 w-3" /> Following
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-3 w-3" /> Follow
                    </>
                  )}
                </Button>
              ) : null}
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
          <SheetHeader className="p-4 pr-12 border-b border-white/10 flex flex-row items-center justify-between">
            <SheetTitle className="font-display text-base font-bold flex items-center gap-2">
              <Smile className="h-4 w-4 text-primary" /> {t("reactions")} ({reactions.length})
            </SheetTitle>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-white/10 max-w-md w-full p-0 overflow-hidden">
        <DialogHeader className="p-4 pr-12 border-b border-white/10">
          <DialogTitle className="font-display text-base font-bold flex items-center gap-2">
            <Smile className="h-4 w-4 text-primary" /> {t("reactions")} ({reactions.length})
          </DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
