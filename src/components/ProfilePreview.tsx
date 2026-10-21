import { useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Award,
  Ban,
  Copy,
  MessageCircle,
  MoreHorizontal,
  PawPrint,
  Pin,
  UserPlus,
  UserCheck,
  X,
} from "lucide-react";
import { StatusIcon } from "@/components/presence/StatusDot";
import { defaultAvatarFor } from "@/lib/default-avatars";
import { bannerToneFor } from "@/components/profile/ProfileCard";
import { bannerBackground } from "@/lib/profile-banner";
import { ProfileEffect as ProfileEffectVisual } from "@/components/profile/ProfileEffect";
import { ProfileFrame } from "@/components/profile/ProfileFrame";
import { BloodwebDecoration } from "@/components/profile/BloodwebDecoration";
import { VerifiedSeal } from "@/components/profile/VerifiedSeal";
import { useEquipped } from "@/lib/useEquipped";
import { usePresence, publicStatusOf, statusLabel } from "@/lib/presence";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/Badge";
import { MarkdownText } from "@/components/MarkdownText";
import { fetchUserBadges } from "@/lib/badges";
import { canonBadges, distinctBadges } from "@/lib/badge-set";
import { toast } from "@/lib/toast";
import { motion, useDragControls } from "framer-motion";

type PreviewProfile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  banner_gradient?: string | null;
  accent_color?: string | null;
  paw_balance: number;
  created_at: string;
  featured_badge?: string | null;
};

async function fetchPreview(username: string): Promise<PreviewProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    // `*` keeps the preview working before the gradient migration lands.
    .select("*")
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

function monthYear(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/**
 * Discord-style profile preview: banner, overlapping avatar with a presence
 * dot, name row with the member's badges, ABOUT ME (markdown, like Discord),
 * MEMBER SINCE, then the actions. It uses the same 400px / 176px / 96px
 * proportions as the profile card, so opening either surface never jumps.
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

  const isMobile = useIsMobile();
  const dragControls = useDragControls();

  const presence = usePresence(p?.id ?? "");
  const status = publicStatusOf(presence);
  const statusText = statusLabel(status);

  const badges = useQuery({
    queryKey: ["profile-preview-badges", p?.id],
    queryFn: () => fetchUserBadges(p!.id),
    enabled: open && !!p,
    staleTime: 60_000,
  });

  // A profile effect belongs on the preview, like Discord's popout: it is the
  // place people actually look at someone's banner.
  const equipped = useEquipped(p?.id);

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

  const copyUsername = async () => {
    try {
      await navigator.clipboard.writeText(`@${username}`);
      toast.success("Username copied");
    } catch {
      toast.error("Couldn't copy the username");
    }
  };

  const bannerUrl = p?.banner_url ?? null;
  const bannerBg = bannerBackground(bannerUrl, p?.banner_gradient, bannerToneFor(p?.id ?? ""));
  const isOwnProfile = user?.id === p?.id;
  const earned = badges.data ?? [];
  // Name-row marks: canonical order, no two awards drawing the same emblem.
  const markBadges = distinctBadges(canonBadges(earned));
  const wornSlug = p?.featured_badge ?? null;
  // Verified is a badge, not a profiles column (same rule as the profile page).
  const verified = earned.some((badge) => badge.slug === "verified" || badge.slug === "no-cap");

  // Phones drag the sheet down from the banner or the grab handle.
  const beginSheetDrag = (event: ReactPointerEvent) => {
    if (!isMobile) return;
    dragControls.start(event);
  };

  const panel = (
    <>
        {profile.isLoading && (
          <div className="p-4">
            <div className="animate-pulse space-y-4">
              <div className="h-40 w-full rounded-xl bg-white/[0.06] sm:h-44" />
              <div className="mx-2 -mt-12 h-24 w-24 rounded-full bg-white/10 ring-[6px] ring-[#111214]" />
              <div className="space-y-2 pt-2">
                <div className="h-5 w-32 rounded bg-white/[0.06]" />
                <div className="h-4 w-24 rounded bg-white/[0.06]" />
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
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
          >
            {/* Banner. On phones this doubles as the sheet's drag surface. */}
            <div
              className="relative h-40 w-full touch-none overflow-hidden sm:h-44 sm:touch-auto"
              style={{ background: bannerBg }}
              onPointerDown={beginSheetDrag}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent"
              />
              {equipped.data?.profile_effect && (
                <ProfileEffectVisual slug={equipped.data.profile_effect.slug} />
              )}
              {equipped.data?.profile_frame && (
                <ProfileFrame slug={equipped.data.profile_frame.slug} />
              )}
              <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5">
                {!isOwnProfile && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label="More options"
                        className="grid h-8 w-8 place-items-center rounded-full bg-black/50 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={handleViewProfile}>View Full Profile</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void copyUsername()}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy username
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => blockMutation.mutate()} className="text-destructive">
                        <Ban className="mr-2 h-4 w-4" />
                        Block
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <button
                  type="button"
                  aria-label="Close profile preview"
                  onClick={() => onOpenChange(false)}
                  className="grid h-8 w-8 place-items-center rounded-full bg-black/50 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Avatar — overlaps the banner, ringed in the card colour like Discord */}
            <div className="relative -mt-12 px-4">
              <div className="relative inline-block">
                <Avatar className="relative z-[1] h-24 w-24 rounded-full ring-[6px] ring-[#111214]">
                  <AvatarImage src={p.avatar_url ?? defaultAvatarFor(p.username)} />
                  <AvatarFallback className="bg-surface-2 text-xl font-bold text-foreground">
                    {p.display_name?.[0] ?? p.username[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <BloodwebDecoration slug={equipped.data?.avatar_decoration?.slug} />
                <span
                  aria-hidden
                  className="absolute -bottom-0.5 -right-0.5 z-[3] grid h-[22px] w-[22px] place-items-center rounded-full bg-[#111214]"
                >
                  <StatusIcon status={status} size={18} />
                </span>
              </div>
            </div>

            <div className="space-y-4 px-4 pb-4 pt-2.5">
              {/* Name row: display name, verified tick, badges — Discord order */}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                  <h3 className="truncate text-[22px] font-bold leading-7 text-foreground">
                    {p.display_name || p.username}
                  </h3>
                  {verified && (
                    <VerifiedSeal size={22} className="mb-0.5" />
                  )}
                  {markBadges.length > 0 && (
                    <span className="flex items-center gap-1" aria-label="Badges">
                      {markBadges.slice(0, 6).map((badge) => (
                        <span
                          key={badge.slug}
                          className={
                            badge.slug === wornSlug
                              ? "grid h-[21px] w-[21px] place-items-center rounded-full ring-1 ring-primary/70"
                              : "grid h-[21px] w-[21px] place-items-center"
                          }
                          title={badge.slug === wornSlug ? `${badge.name} · worn` : badge.name}
                        >
                          <Badge slug={badge.slug} size={17} title={badge.name} />
                        </span>
                      ))}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void copyUsername()}
                  className="mt-0.5 text-[13px] leading-4 text-muted-foreground transition-colors hover:text-foreground"
                  title="Copy username"
                >
                  @{p.username}
                </button>
              </div>

              {/* Presence row */}
              <div className="flex items-center justify-between gap-2 text-[12px] text-foreground/80">
                <span className="flex items-center gap-1.5">
                  <StatusIcon status={status} size={12} />
                  <span>{statusText}</span>
                </span>
                {wornSlug && markBadges.some((badge) => badge.slug === wornSlug) && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    <Pin className="h-2.5 w-2.5" />
                    {markBadges.find((badge) => badge.slug === wornSlug)?.name}
                  </span>
                )}
              </div>

              <div className="h-px bg-white/[0.06]" />

              {/* Primary actions sit directly under the identity, like Discord's
                  profile menu — no scrolling past the bio to message someone. */}
              {!isOwnProfile ? (
                <div className="flex items-center gap-2 pt-0.5">
                  <Button
                    onClick={handleMessage}
                    className="h-9 flex-1 gap-1.5 bg-primary text-[13px] font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Message
                  </Button>
                  {!blocked.data && (
                    <Button
                      onClick={() => toggleFollow.mutate()}
                      disabled={toggleFollow.isPending}
                      variant="outline"
                      aria-label={following.data ? "Unfollow" : "Follow"}
                      title={following.data ? "Unfollow" : "Follow"}
                      className={`h-9 shrink-0 gap-1.5 border-white/10 px-3 text-[13px] font-semibold ${following.data ? "bg-white/[0.06] text-foreground" : "text-foreground hover:bg-white/[0.06]"}`}
                    >
                      {following.data ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                      {following.data ? "Following" : "Follow"}
                    </Button>
                  )}
                </div>
              ) : (
                <Button
                  onClick={handleViewProfile}
                  variant="outline"
                  className="h-9 w-full border-white/10 bg-transparent text-[13px] font-semibold text-foreground hover:bg-white/[0.06]"
                >
                  View Full Profile
                </Button>
              )}

              {/* Quick stats: the three numbers people actually came to see. */}
              <section className="grid grid-cols-3 gap-2" aria-label="Quick stats">
                <div className="rounded-xl border border-primary/15 bg-primary/[0.06] px-2.5 py-2">
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-primary/70">Paws</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[13px] font-bold tabular-nums text-primary">
                    <PawPrint className="h-3 w-3 shrink-0" />
                    {Number(p.paw_balance ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-2.5 py-2">
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Badges</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[13px] font-bold tabular-nums text-foreground">
                    <Award className="h-3 w-3 shrink-0 text-muted-foreground" />
                    {earned.length}
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-2.5 py-2">
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Member Since
                  </p>
                  <p className="mt-0.5 text-[13px] font-bold text-foreground">{monthYear(p.created_at)}</p>
                </div>
              </section>

              {/* ABOUT ME */}
              {p.bio && (
                <section>
                  <h4 className="text-[12px] font-bold uppercase tracking-wide text-foreground">About Me</h4>
                  <MarkdownText
                    text={p.bio}
                    className="mt-1.5 line-clamp-4 whitespace-pre-wrap text-[13px] leading-5 text-foreground/90 [&_a]:text-primary [&_a]:underline"
                  />
                </section>
              )}

            </div>
          </motion.div>
        )}
    </>
  );

  // Phones get a real bottom sheet that slides up from the thumb and can be
  // swiped back down by its handle; the desktop keeps the anchored popout.
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          hideClose
          // The own spring keyframes below replace the primitive's linear slide,
          // so the sheet rises like a drawer and settles instead of gliding.
          className="profile-sheet max-h-[90dvh] gap-0 rounded-t-3xl border-white/[0.06] bg-[#111214] p-0 pb-[max(env(safe-area-inset-bottom),0.5rem)]"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Profile preview for {username}</SheetTitle>
          </SheetHeader>
          <motion.div
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.55 }}
            dragTransition={{ bounceStiffness: 520, bounceDamping: 38 }}
            onDragEnd={(_, info) => {
              // Either a deliberate pull or a flick closes the sheet.
              if (info.offset.y > 120 || info.velocity.y > 700) onOpenChange(false);
            }}
            className="flex max-h-[90dvh] flex-col"
          >
            <div
              onPointerDown={beginSheetDrag}
              className="shrink-0 cursor-grab pb-1.5 pt-2.5 active:cursor-grabbing"
            >
              <span className="mx-auto block h-1 w-10 rounded-full bg-white/25" aria-hidden="true" />
              <span className="sr-only">Drag down to close</span>
            </div>
            <div className="min-h-0 overflow-y-auto overscroll-contain">{panel}</div>
          </motion.div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className="gap-0 overflow-hidden rounded-2xl border-white/[0.06] bg-[#111214] p-0 shadow-2xl sm:w-[400px] sm:max-w-[400px]"
      >
        <DialogTitle className="sr-only">Profile preview for {username}</DialogTitle>
        <div className="max-h-[86dvh] overflow-y-auto">{panel}</div>
      </DialogContent>
    </Dialog>
  );
}
