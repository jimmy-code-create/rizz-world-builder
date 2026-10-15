import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CloseButton } from "@/components/ui/close-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarWithStatus, ThoughtBubble } from "@/components/presence/StatusDot";
import { usePresence, publicCustomStatus, publicStatusOf, statusLabel } from "@/lib/presence";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { MessageSquare, User, AtSign, Shield, Bot, Sparkles } from "lucide-react";
import { MarkdownText } from "@/components/MarkdownText";

export type RealmProfilePreviewUser = {
  userId: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  accentColor?: string | null;
  isBot?: boolean;
  botName?: string | null;
  realmRole?: string | null;
};

type Props = {
  user: RealmProfilePreviewUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMention?: (username: string) => void;
};

export function RealmProfilePreviewDialog({ user: targetUser, open, onOpenChange, onMention }: Props) {
  const { user: currentUser } = useAuth();
  const nav = useNavigate();

  const isSelf = currentUser?.id === targetUser?.userId;
  const isBot = Boolean(targetUser?.isBot);

  const profileQuery = useQuery({
    queryKey: ["profile-preview", targetUser?.userId],
    enabled: open && !!targetUser?.userId && !isBot,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio, accent_color, verified, website, created_at")
        .eq("id", targetUser!.userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  const presenceQuery = usePresence(open && targetUser?.userId && !isBot ? targetUser.userId : null);

  if (!targetUser) return null;

  const profile = profileQuery.data;
  const displayName = targetUser.isBot
    ? targetUser.botName ?? "Bot"
    : profile?.display_name || targetUser.displayName || targetUser.username;
  const username = targetUser.username;
  const avatarUrl = profile?.avatar_url ?? targetUser.avatarUrl;
  const accentColor = profile?.accent_color ?? targetUser.accentColor ?? "#c8ff3d";

  const status = presenceQuery ? publicStatusOf(presenceQuery) : "offline";
  const customStatus = presenceQuery ? publicCustomStatus(presenceQuery) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose className="glass-strong border-white/10 p-0 overflow-hidden sm:max-w-[380px] rounded-3xl max-w-[92vw]">
        <DialogHeader className="sr-only">
          <DialogTitle>Profile of {displayName}</DialogTitle>
        </DialogHeader>

        {/* Discord-style profile banner */}
        <div
          className="relative h-24 w-full"
          style={{
            background: `linear-gradient(135deg, ${accentColor}44 0%, #141416 100%)`,
          }}
        >
          {/* Top-right badge indicators and close button */}
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-30">
            {isBot && (
              <span className="flex items-center gap-1 rounded-full bg-indigo-500/80 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider backdrop-blur-sm">
                <Bot className="h-3 w-3" /> BOT
              </span>
            )}
            {targetUser.realmRole && targetUser.realmRole !== "member" && (
              <span className="flex items-center gap-1 rounded-full bg-primary/20 border border-primary/30 px-2 py-0.5 text-[10px] font-bold text-primary uppercase tracking-wider backdrop-blur-sm">
                <Shield className="h-3 w-3" /> {targetUser.realmRole}
              </span>
            )}
            <DialogClose asChild>
              <CloseButton className="bg-black/35 backdrop-blur-sm" />
            </DialogClose>
          </div>
        </div>

        {/* Profile Card Body */}
        <div className="relative px-5 pb-5 pt-0 -mt-12">
          {/* Avatar with StatusDot & Thought Bubble */}
          <div className="flex items-end justify-between gap-3">
            <div className="relative">
              <AvatarWithStatus status={isBot ? "online" : status} dotSize={16}>
                <Avatar className="h-20 w-20 rounded-2xl ring-4 ring-background shadow-xl">
                  <AvatarImage src={avatarUrl ?? undefined} className="object-cover" />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold rounded-2xl">
                    {displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </AvatarWithStatus>
            </div>

            {/* Custom status thought / imagination bubble */}
            {!isBot && customStatus && (customStatus.emoji || customStatus.text) && (
              <div className="mb-2 max-w-[190px]">
                <ThoughtBubble
                  emoji={customStatus.emoji}
                  text={customStatus.text}
                />
              </div>
            )}
          </div>

          {/* Name & Username */}
          <div className="mt-3">
            <div className="flex items-center gap-1.5">
              <h3 className="font-display text-lg font-bold truncate text-foreground">
                {displayName}
              </h3>
              {profile?.verified && (
                <span title="Verified Creator" className="text-primary">
                  <Sparkles className="h-4 w-4" />
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-medium">@{username}</p>
            {!isBot && (
              <p className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1">
                <span className="capitalize">{statusLabel(status)}</span>
              </p>
            )}
          </div>

          {/* Bio / About me */}
          {profile?.bio && (
            <div className="mt-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3 text-xs leading-relaxed text-foreground/90">
              <p className="font-semibold text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                About Me
              </p>
              <MarkdownText text={profile.bio} />
            </div>
          )}

          {/* Quick Action buttons */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {!isBot && !isSelf && (
              <Button
                size="sm"
                className="flex-1 bg-primary text-primary-foreground font-semibold h-9 rounded-xl gap-1.5 shadow-sm"
                onClick={() => {
                  onOpenChange(false);
                  void nav({ to: "/dm/$userId", params: { userId: targetUser.userId } });
                }}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Message
              </Button>
            )}

            {onMention && (
              <Button
                variant="outline"
                size="sm"
                className="glass border-white/10 font-semibold h-9 rounded-xl gap-1 text-xs"
                onClick={() => {
                  onOpenChange(false);
                  onMention(username);
                }}
              >
                <AtSign className="h-3.5 w-3.5" />
                Mention
              </Button>
            )}

            {!isBot && (
              <Button
                variant="outline"
                size="sm"
                className="glass border-white/10 font-semibold h-9 rounded-xl gap-1 text-xs"
                onClick={() => {
                  onOpenChange(false);
                  void nav({ to: "/u/$username", params: { username } });
                }}
              >
                <User className="h-3.5 w-3.5" />
                Profile
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
