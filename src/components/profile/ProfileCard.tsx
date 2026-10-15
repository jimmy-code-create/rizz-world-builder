import { useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AtSign, Check, Copy, Flag, MessageCircle, MoreHorizontal, Pencil, UserCheck, UserPlus, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CloseButton } from "@/components/ui/close-button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StatusBubble, StatusIcon } from "@/components/presence/StatusDot";
import { usePresence, publicCustomStatus, publicStatusOf } from "@/lib/presence";
import { defaultAvatarFor } from "@/lib/default-avatars";
import { MarkdownText } from "@/components/MarkdownText";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type ProfileCardUser = {
  userId: string;
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  realmRole?: string | null;
  isBot?: boolean;
  botName?: string | null;
};

/** Dark muted tone derived from the user id (never lime). */
export function bannerToneFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return `hsl(${h} 18% 14%)`;
}

type FullProfile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  verified: boolean | null;
  created_at: string | null;
};

async function fetchCardProfile(userId: string): Promise<FullProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, banner_url, bio, verified, created_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as FullProfile | null) ?? null;
}

/**
 * ONE shared <ProfileCard>, used everywhere (feed sheet, realm chat,
 * comments, member list, voice room, DMs). Reads the same profile +
 * presence store as the profile page (profiles by id + usePresence).
 */
export function ProfileCard({
  user,
  onMention,
  onOpenChange,
}: {
  user: ProfileCardUser;
  onMention?: (username: string) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const { user: me } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [bioExpanded, setBioExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const dragStart = useRef<number | null>(null);

  const isSelf = me?.id === user.userId;
  const isBot = Boolean(user.isBot);

  // Same source as the profile page: profiles by id + shared presence channel.
  const profileQuery = useQuery({
    queryKey: ["profile-card", user.userId],
    queryFn: () => fetchCardProfile(user.userId),
    enabled: !!user.userId && !isBot,
    staleTime: 60_000,
  });
  const presenceRow = usePresence(!isBot && user.userId ? user.userId : null);
  const status = presenceRow ? publicStatusOf(presenceRow, isSelf) : "offline";
  const customStatus = presenceRow ? publicCustomStatus(presenceRow, isSelf) : null;

  const followQuery = useQuery({
    queryKey: ["profile-card-following", user.userId, me?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", me!.id)
        .eq("following_id", user.userId)
        .maybeSingle();
      return !!data;
    },
    enabled: !!me && !!user.userId && !isSelf && !isBot,
  });

  const toggleFollow = useMutation({
    mutationFn: async () => {
      if (!me) return;
      if (followQuery.data) {
        const { error } = await supabase.from("follows").delete().eq("follower_id", me.id).eq("following_id", user.userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("follows").insert({ follower_id: me.id, following_id: user.userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile-card-following", user.userId, me?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const close = () => onOpenChange?.(false);

  if (isBot) {
    const botName = user.botName ?? "Bot";
    return (
      <div className="px-5 pb-5 pt-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-20 w-20 rounded-full ring-[6px] ring-[#141416]">
            <AvatarImage src={user.avatarUrl ?? undefined} className="object-cover" />
            <AvatarFallback className="bg-[#1c1c1f] text-xl font-bold text-[#f2efe6]">B</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold text-[#f2efe6]">{botName}</h2>
            <p className="text-sm text-muted-foreground">@{user.username ?? "bot"}</p>
            <span className="bot-tag mt-1">BOT</span>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          {onMention && (
            <Button variant="outline" className="h-11 flex-1" onClick={() => { close(); onMention(user.username ?? ""); }}>
              <AtSign className="h-4 w-4" /> Mention
            </Button>
          )}
          <Button variant="outline" className="h-11 flex-1" onClick={() => { close(); void nav({ to: "/u/$username", params: { username: user.username ?? "" } }); }}>
            View full profile
          </Button>
        </div>
      </div>
    );
  }

  if (profileQuery.isLoading) {
    return (
      <div className="p-5" role="status" aria-label="Loading profile">
        <div className="h-[100px] animate-pulse rounded-t-2xl bg-white/5" />
        <div className="mt-3 flex items-center gap-3">
          <div className="h-20 w-20 animate-pulse rounded-full bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-white/5" />
          </div>
        </div>
      </div>
    );
  }

  const p = profileQuery.data;
  if (!profileQuery.isLoading && !p) {
    return <p className="p-6 text-center text-sm text-muted-foreground">That profile is no longer available.</p>;
  }

  const displayName = p?.display_name || user.displayName || p?.username || user.username || "Member";
  const handle = p?.username || user.username || "member";
  const avatarSrc = p?.avatar_url ?? user.avatarUrl ?? defaultAvatarFor(handle);
  const banner = p?.banner_url ? `url(${p.banner_url}) center/cover` : bannerToneFor(user.userId);
  const joinDate = p?.created_at
    ? new Date(p.created_at).toLocaleDateString([], { month: "long", year: "numeric" })
    : null;

  const copyHandle = () => {
    void navigator.clipboard.writeText(`@${handle}`).then(
      () => toast.success("Handle copied"),
      () => toast.error("Couldn't copy"),
    );
    setMenuOpen(false);
  };
  const stubAction = (label: string) => {
    toast.info(label, { description: "Moderation actions live on the full profile page." });
    setMenuOpen(false);
  };

  return (
    <div
      onTouchStart={(e) => { dragStart.current = e.touches[0]?.clientY ?? null; }}
      onTouchEnd={(e) => {
        if (dragStart.current === null) return;
        const end = e.changedTouches[0]?.clientY ?? dragStart.current;
        if (end - dragStart.current > 90) close();
        dragStart.current = null;
      }}
    >
      {/* Banner 100px */}
      <div className="relative h-[100px] w-full" style={{ background: p?.banner_url ? banner : bannerToneFor(user.userId) }}>
        <div className="absolute right-2.5 top-2.5 z-30 flex items-center gap-1.5">
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Profile options"
                className="grid h-11 w-11 place-items-center rounded-full bg-black/40 text-[#f2efe6] backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d]"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={copyHandle} className="gap-2">
                <Copy className="h-4 w-4" /> Copy handle
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => stubAction("Mute")} className="gap-2">
                <VolumeX className="h-4 w-4" /> Mute
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => stubAction("Block")} className="gap-2">
                <UserCheck className="h-4 w-4" /> Block
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => stubAction("Report")} className="gap-2">
                <Flag className="h-4 w-4" /> Report
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="sm:hidden">
            <CloseButton aria-label="Close profile" onClick={close} className="bg-black/40 backdrop-blur-sm" />
          </span>
        </div>
      </div>

      <div className="px-4 pb-4">
        {/* Avatar overlapping banner 50% + StatusBubble right */}
        <div className="-mt-10 flex items-end justify-between gap-3">
          <span className="relative inline-flex">
            <Avatar className="h-20 w-20 rounded-full ring-[6px] ring-[#141416]">
              <AvatarImage src={avatarSrc ?? undefined} className="object-cover" />
              <AvatarFallback className="rounded-full bg-[#1c1c1f] text-2xl font-bold text-[#f2efe6]">
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-0.5 -right-0.5 grid place-items-center rounded-full bg-[#141416] p-[3px]">
              <StatusIcon status={status} size={22} />
            </span>
          </span>
          {customStatus && (customStatus.emoji || customStatus.text) && (
            <div className="mb-1 max-w-[190px]">
              <StatusBubble emoji={customStatus.emoji} text={customStatus.text} />
            </div>
          )}
        </div>

        {/* Inner panel */}
        <div className="mt-3 rounded-xl bg-[#1c1c1f] p-3" style={{ borderRadius: 12 }}>
          <div className="flex items-center gap-1.5">
            <h2 className="truncate text-xl font-bold leading-tight text-[#f2efe6]" style={{ fontSize: 20 }}>
              {displayName}
            </h2>
            {p?.verified && (
              <span title="Verified" className="shrink-0 text-[#f2efe6]" aria-label="Verified">
                <Check className="h-4 w-4" />
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">@{handle}</p>
          <div className="my-2.5 h-px bg-white/10" />
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">About me</p>
          {p?.bio ? (
            <div className={`mt-1 text-sm leading-snug ${bioExpanded ? "" : "line-clamp-3"}`}>
              <MarkdownText text={p.bio} />
              {!bioExpanded && p.bio.length > 180 && (
                <button type="button" onClick={() => setBioExpanded(true)} className="mt-0.5 text-xs text-[#c8ff3d] hover:underline">
                  more
                </button>
              )}
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">No bio yet.</p>
          )}
          {joinDate && (
            <>
              <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Rizz member since
              </p>
              <p className="mt-0.5 text-sm text-[#f2efe6]">{joinDate}</p>
            </>
          )}
          {user.realmRole && user.realmRole !== "member" && (
            <>
              <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                In this realm
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <span className="flex min-h-[44px] items-center gap-1.5 rounded-full border border-white/10 px-2.5 text-xs text-[#f2efe6]">
                  <span className="h-2 w-2 rounded-full bg-[#c8ff3d]" />
                  {user.realmRole}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="mt-3 flex gap-2">
          {isSelf ? (
            <Button asChild className="h-11 flex-1 bg-[#c8ff3d] text-[#0b0b0c] hover:bg-[#c8ff3d]/90">
              <Link to="/settings/profile">
                <Pencil className="h-4 w-4" /> Edit profile
              </Link>
            </Button>
          ) : (
            <>
              <Button
                type="button"
                onClick={() => { close(); void nav({ to: "/dm/$userId", params: { userId: user.userId } }); }}
                className="h-11 flex-1 bg-[#c8ff3d] text-[#0b0b0c] hover:bg-[#c8ff3d]/90"
              >
                <MessageCircle className="h-4 w-4" /> Message
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={toggleFollow.isPending}
                onClick={() => toggleFollow.mutate()}
                className="h-11 flex-1"
              >
                {followQuery.data ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                {followQuery.data ? "Following" : "Follow"}
              </Button>
            </>
          )}
          {onMention && !isSelf && (
            <Button
              type="button"
              variant="outline"
              onClick={() => { close(); onMention(handle); }}
              aria-label={`Mention ${handle}`}
              className="h-11 gap-1.5"
            >
              <AtSign className="h-4 w-4" /> Mention
            </Button>
          )}
        </div>
        <button
          type="button"
          onClick={() => { close(); void nav({ to: "/u/$username", params: { username: handle } }); }}
          className="mx-auto mt-2 flex min-h-[44px] items-center justify-center text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          View full profile
        </button>
      </div>
    </div>
  );
}

/** Bottom sheet on phones, 340px popover-style card on desktop. */
export function ProfileCardDialog({
  user,
  open,
  onOpenChange,
  onMention,
}: {
  user: ProfileCardUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMention?: (username: string) => void;
}) {
  const triggerRef = useRef<HTMLElement | null>(null);
  if (open && !triggerRef.current && typeof document !== "undefined") {
    triggerRef.current = document.activeElement as HTMLElement | null;
  }
  const handleChange = (next: boolean) => {
    onOpenChange(next);
    if (!next && triggerRef.current) {
      triggerRef.current.focus?.();
      triggerRef.current = null;
    }
  };
  return (
    <Dialog open={open} onOpenChange={handleChange}>
      <DialogContent
        hideClose
        className="left-0 right-0 top-auto bottom-0 max-h-[86dvh] w-full translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-b-none rounded-t-3xl border-white/10 bg-[#141416] p-0 sm:left-1/2 sm:right-auto sm:top-1/2 sm:bottom-auto sm:w-[340px] sm:max-w-[340px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
      >
        <DialogTitle className="sr-only">Profile</DialogTitle>
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-white/25 sm:hidden" aria-hidden />
        {user && <ProfileCard user={user} onMention={onMention} onOpenChange={handleChange} />}
      </DialogContent>
    </Dialog>
  );
}
