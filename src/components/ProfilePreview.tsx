import { useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, Phone, MoreHorizontal, Check, UserPlus, UserCheck, Ban, PawPrint } from "lucide-react";
import { defaultAvatarFor } from "@/lib/default-avatars";
import { bannerToneFor } from "@/components/profile/ProfileCard";
import { usePresence, publicStatusOf, statusLabel } from "@/lib/presence";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "@/lib/toast";
import { motion } from "framer-motion";

type PreviewProfile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  paw_balance: number;
  verified: boolean;
  created_at: string;
};

async function fetchPreview(username: string): Promise<PreviewProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, avatar_url, banner_url, paw_balance, created_at")
    .eq("username", username)
    .maybeSingle();
  if (error) throw error;
  return (data as PreviewProfile) ?? null;
}

async function checkFollowing(viewerId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", viewerId)
    .eq("following_id", userId)
    .maybeSingle();
  return !!data;
}

async function checkBlocked(viewerId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("blocks")
    .select("blocker_id")
    .eq("blocker_id", viewerId)
    .eq("blocked_id", userId)
    .maybeSingle();
  return !!data;
}

/**
 * Discord-style profile preview with banner, avatar overlay, and action buttons
 */
export function ProfilePreviewTrigger({
  username,
  children,
  className,
}: {
  username: string | null | undefined;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!username) return <>{children}</>;
  return (
    <>
      <button
        type="button"
        className={className ?? "text-left"}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
      >
        {children}
      </button>
      <ProfilePreviewDialog username={username} open={open} onOpenChange={setOpen} />
    </>
  );
}

export function ProfilePreviewDialog({
  username,
  open,
  onOpenChange,
}: {
  username: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const profile = useQuery({
    queryKey: ["profile-preview", username],
    queryFn: () => fetchPreview(username),
    enabled: open,
    staleTime: 60_000,
  });
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const p = profile.data;
  
  const presence = usePresence(p?.id ?? "");
  const status = publicStatusOf(presence);
  const statusText = statusLabel(status);
  
  const following = useQuery({
    queryKey: ["following", user?.id, p?.id],
    queryFn: () => checkFollowing(user!.id, p!.id),
    enabled: !!user && !!p && user.id !== p.id,
  });
  
  const blocked = useQuery({
    queryKey: ["blocked", user?.id, p?.id],
    queryFn: () => checkBlocked(user!.id, p!.id),
    enabled: !!user && !!p && user.id !== p.id,
  });

  const toggleFollow = useMutation({
    mutationFn: async () => {
      if (!user || !p) throw new Error("Invalid state");
      if (following.data) {
        const { error } = await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("follows").insert({ follower_id: user.id, following_id: p.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(following.data ? "Unfollowed" : "Following");
      void qc.invalidateQueries({ queryKey: ["following", user?.id, p?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const blockMutation = useMutation({
    mutationFn: async () => {
      if (!user || !p) throw new Error("Invalid state");
      const { error } = await supabase.from("blocks").insert({ blocker_id: user.id, blocked_id: p.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Blocked");
      void qc.invalidateQueries({ queryKey: ["blocked", user?.id, p?.id] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to block"),
  });

  const handleMessage = () => {
    if (!p) return;
    onOpenChange(false);
    nav({ to: "/dm/$userId", params: { userId: p.id } });
  };

  const handleViewProfile = () => {
    if (!p) return;
    onOpenChange(false);
    nav({ to: "/u/$username", params: { username: p.username } });
  };

  const bannerUrl = p?.banner_url ?? null;
  const bannerBg = bannerUrl ? `url(${bannerUrl})` : bannerToneFor(p?.id ?? "");
  const isOwnProfile = user?.id === p?.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className="left-0 right-0 top-auto bottom-0 max-h-[86dvh] w-full translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-b-none rounded-t-3xl border-white/10 bg-[#141416] p-0 sm:left-1/2 sm:right-auto sm:top-1/2 sm:bottom-auto sm:w-[340px] sm:max-w-[340px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
      >
        <DialogTitle className="sr-only">Profile preview for {username}</DialogTitle>
        
        {/* Drag handle for mobile */}
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-white/25 sm:hidden" aria-hidden />
        
        {profile.isLoading && (
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-24 w-full rounded-2xl bg-white/5" />
              <div className="h-20 w-20 mx-auto -mt-12 rounded-full bg-white/10 ring-4 ring-[#141416]" />
              <div className="space-y-2 pt-4">
                <div className="h-5 w-32 mx-auto rounded bg-white/5" />
                <div className="h-4 w-24 mx-auto rounded bg-white/5" />
              </div>
            </div>
          </div>
        )}
        
        {profile.isError && (
          <div className="p-6 text-center">
            <p className="text-sm text-muted-foreground">Couldn&apos;t load this profile.</p>
            <Button type="button" variant="outline" onClick={() => void profile.refetch()} className="mt-3 h-11">
              Try again
            </Button>
          </div>
        )}
        
        {!profile.isLoading && !profile.isError && !p && (
          <p className="p-6 text-center text-sm text-muted-foreground">That profile is no longer available.</p>
        )}
        
        {p && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="overflow-y-auto max-h-[86dvh]"
          >
            {/* Banner */}
            <div 
              className="relative h-24 w-full"
              style={{
                background: bannerUrl ? `${bannerBg} center/cover` : bannerBg,
              }}
            >
              {/* More options button */}
              {!isOwnProfile && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/60 backdrop-blur-sm grid place-items-center hover:bg-black/80 transition-colors">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={handleViewProfile}>
                      View Full Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => blockMutation.mutate()} className="text-destructive">
                      <Ban className="h-4 w-4 mr-2" />
                      Block
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            
            {/* Avatar overlapping banner */}
            <div className="px-4 -mt-12">
              <div className="relative inline-block">
                <Avatar className="h-20 w-20 ring-[5px] ring-[#141416] border-2 border-white/10">
                  <AvatarImage src={p.avatar_url ?? defaultAvatarFor(p.username)} />
                  <AvatarFallback className="bg-surface-2 text-foreground font-bold text-xl">
                    {p.display_name?.[0] ?? p.username[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {/* Status badge */}
                {status !== "offline" && (
                  <span 
                    className="absolute bottom-0 right-0 h-5 w-5 rounded-full ring-[3px] ring-[#141416]"
                    style={{
                      background: status === "online" ? "#22c55e" : 
                                 status === "idle" ? "#f59e0b" : 
                                 status === "dnd" ? "#ef4444" : "#6b7280"
                    }}
                  />
                )}
              </div>
            </div>
            
            {/* Profile info */}
            <div className="px-4 pb-4 pt-3 space-y-3">
              {/* Name and username */}
              <div>
                <h3 className="text-xl font-bold text-foreground flex items-center gap-1.5">
                  {p.display_name || p.username}
                  {p.verified && (
                    <svg className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8.52 3.59c.8-1.39 2.16-1.39 2.96 0l1.07 1.85c.27.47.86.77 1.44.73l2.12-.14c1.55-.1 2.5.98 2.08 2.4l-.56 2.03c-.18.64.01 1.35.46 1.74l1.63 1.4c1.19 1.02 1.19 2.64 0 3.66l-1.63 1.4c-.45.39-.64 1.1-.46 1.74l.56 2.03c.42 1.42-.53 2.5-2.08 2.4l-2.12-.14c-.58-.04-1.17.26-1.44.73l-1.07 1.85c-.8 1.39-2.16 1.39-2.96 0l-1.07-1.85c-.27-.47-.86-.77-1.44-.73l-2.12.14c-1.55.1-2.5-.98-2.08-2.4l.56-2.03c.18-.64-.01-1.35-.46-1.74l-1.63-1.4c-1.19-1.02-1.19-2.64 0-3.66l1.63-1.4c.45-.39.64-1.1.46-1.74l-.56-2.03c-.42-1.42.53-2.5 2.08-2.4l2.12.14c.58.04 1.17-.26 1.44-.73l1.07-1.85zM11 15l-3-3 1.41-1.41L11 12.17l3.59-3.58L16 10l-5 5z"/>
                    </svg>
                  )}
                </h3>
                <p className="text-sm text-muted-foreground">@{p.username}</p>
              </div>
              
              {/* Status text */}
              {status !== "offline" && (
                <div className="flex items-center gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span 
                      className="h-2 w-2 rounded-full"
                      style={{
                        background: status === "online" ? "#22c55e" : 
                                   status === "idle" ? "#f59e0b" : 
                                   status === "dnd" ? "#ef4444" : "#6b7280"
                      }}
                    />
                    <span className="text-muted-foreground capitalize">{statusText}</span>
                  </div>
                </div>
              )}
              
              {/* Divider */}
              <div className="h-px bg-white/10" />
              
              {/* About section */}
              {p.bio && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">About Me</h4>
                  <p className="text-sm text-foreground whitespace-pre-wrap line-clamp-3">{p.bio}</p>
                </div>
              )}
              
              {/* Stats */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Stats</h4>
                <div className="flex items-center gap-4">
                  <div>
                    <p className="flex items-center gap-1 text-sm font-semibold text-primary">
                      <PawPrint className="h-3.5 w-3.5" />
                      {Number(p.paw_balance ?? 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">Paws balance</p>
                  </div>
                  <div className="h-8 w-px bg-white/10" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </p>
                    <p className="text-xs text-muted-foreground">Member Since</p>
                  </div>
                </div>
              </div>
              
              {/* Action buttons */}
              {!isOwnProfile && (
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={handleMessage}
                    className="flex-1 h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Message
                  </Button>
                  {!blocked.data && (
                    <Button
                      onClick={() => toggleFollow.mutate()}
                      disabled={toggleFollow.isPending}
                      variant="outline"
                      className="h-10 px-4 border-white/20 hover:bg-white/10"
                    >
                      {following.data ? (
                        <UserCheck className="h-4 w-4" />
                      ) : (
                        <UserPlus className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              )}
              
              {isOwnProfile && (
                <Button
                  onClick={handleViewProfile}
                  variant="outline"
                  className="w-full h-10 border-white/20 hover:bg-white/10"
                >
                  View Full Profile
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  );
}
