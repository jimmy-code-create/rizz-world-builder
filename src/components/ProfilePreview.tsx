import { useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import {
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
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { getBanner } from "@/lib/banner";
import { useEquipped } from "@/lib/useEquipped";
import { usePresence, publicStatusOf, statusLabel } from "@/lib/presence";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BadgeChip } from "@/components/BadgeChip";
import { BadgeDetailDialog } from "@/components/profile/BadgeDetailDialog";
import { MarkdownText } from "@/components/MarkdownText";
import { fetchUserBadges, type Badge } from "@/lib/badges";
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
  banner_mode: string | null;
  banner_gradient: unknown;
  accent_color: string | null;
  reduced_motion: boolean | null;
  updated_at: string | null;
  paw_balance: number;
  created_at: string;
  featured_badge?: string | null;
  post_count?: number;
  follower_count?: number;
  following_count?: number;
};

async function fetchPreview(username: string): Promise<PreviewProfile | null> {
  // `*` keeps the preview readable before/after the banner migration and gives
  // the header the same row the full profile reads.
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .maybeSingle();
  if (error) throw error;
  const profile = (data as unknown as PreviewProfile | null) ?? null;
  if (!profile) return null;

  // The preview lists the same activity numbers as the full profile.
  const [posts, followers, following] = await Promise.all([
    Promise.resolve(
      supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("author_id", profile.id),
    )
      .then((result) => result.count ?? 0)
      .catch(() => 0),
    Promise.resolve(
      supabase
        .from("follows")
        .select("follower_id", { count: "exact", head: true })
        .eq("following_id", profile.id),
    )
      .then((result) => result.count ?? 0)
      .catch(() => 0),
    Promise.resolve(
      supabase
        .from("follows")
        .select("follower_id", { count: "exact", head: true })
        .eq("follower_id", profile.id),
    )
      .then((result) => result.count ?? 0)
      .catch(() => 0),
  ]);

  return { ...profile, post_count: posts, follower_count: followers, following_count: following };
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

function activityCount(value: number | undefined) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(
    Number(value ?? 0),
  );
}

/**
 * Discord-style profile preview: banner, overlapping avatar with a presence
 * dot, name row with the member's badges, ABOUT ME (markdown, like Discord),
 * MEMBER SINCE with the Rizz mark, and the same Activity numbers as the full
 * profile. It uses the same 400px / 176px / 96px proportions as the profile
 * card, so opening either surface never jumps.
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
  const [openBadge, setOpenBadge] = useState<Badge | null>(null);

  const presence = usePresence(p?.id ?? "");
  const status = publicStatusOf(presence);
  const statusText = statusLabel(status);

  const badges = useQuery({
    queryKey: ["profile-preview-badges", p?.id],
    queryFn: () => fetchUserBadges(p!.id),
    enabled: open && !!p,
    staleTime: 60_000,
  });

  // The preview carries the same equipped effects as the full profile, so the
  // popout never shows a different banner treatment than the page behind it.
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
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("follows")
          .insert({ follower_id: user.id, following_id: p.id });
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
      const { error } = await supabase
        .from("blocks")
        .insert({ blocker_id: user.id, blocked_id: p.id });
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

  const isOwnProfile = user?.id === p?.id;
  const earned = badges.data ?? [];
  // Name-row marks: canonical order, no two awards drawing the same emblem.
  const markBadges = distinctBadges(canonBadges(earned));
  const wornSlug = p?.featured_badge ?? null;
  // Verified is a badge, not a profiles column (same rule as the profile page).
  const verified = earned.some((badge) => badge.slug === "verified" || badge.slug === "no-cap");
  const previewBanner = p
    ? getBanner({
        banner_url: p.banner_url,
        banner_mode: p.banner_mode,
        banner_gradient: p.banner_gradient,
        updated_at: p.updated_at,
      })
    : null;

  // Phones drag the sheet down from the banner or the grab handle. Taps on the
  // banner's own buttons must not start a drag.
  const beginSheetDrag = (event: ReactPointerEvent) => {
    if (!isMobile) return;
    if ((event.target as HTMLElement).closest("button, a, [role='menuitem']")) return;
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
          <Button
            type="button"
            variant="outline"
            onClick={() => void profile.refetch()}
            className="mt-3 h-11"
          >
            Try again
          </Button>
        </div>
      )}

      {!profile.isLoading && !profile.isError && !p && (
        <p className="p-6 text-center text-sm text-muted-foreground">
          That profile is no longer available.
        </p>
      )}

      {p && (
        <motion.div
          initial={{ opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <ProfileHeader
            user={{
              id: p.id,
              username: p.username,
              displayName: p.display_name,
              avatarUrl: p.avatar_url,
              bannerUrl: p.banner_url,
              bannerMode: p.banner_mode,
              bannerGradient: p.banner_gradient,
              updatedAt: p.updated_at,
              accentColor: p.accent_color,
              verified,
              reducedMotion: Boolean(p.reduced_motion),
            }}
            effects={equipped.data}
            status={status}
            statusIsSelf={isOwnProfile}
            customStatus={null}
            statusLine={
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{statusText}</span>
                {wornSlug && markBadges.some((badge) => badge.slug === wornSlug) && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    <Pin className="h-2.5 w-2.5" />
                    {markBadges.find((badge) => badge.slug === wornSlug)?.name}
                  </span>
                )}
              </p>
            }
            featuredBadge={
              markBadges.length > 0 ? (
                <span className="flex items-center gap-0.5" aria-label="Badges">
                  {markBadges.slice(0, 6).map((badge) => (
                    <span
                      key={badge.slug}
                      className={
                        badge.slug === wornSlug ? "rounded-full ring-1 ring-primary/70" : undefined
                      }
                    >
                      <BadgeChip
                        badge={badge}
                        size="sm"
                        onSelect={(picked) => setOpenBadge(picked)}
                      />
                    </span>
                  ))}
                </span>
              ) : undefined
            }
            overlayActions={
              <>
                {!isOwnProfile && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label="Profile options"
                        className="grid h-11 w-11 place-items-center rounded-full bg-black/50 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <MoreHorizontal className="h-5 w-5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={handleViewProfile}>
                        View Full Profile
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void copyUsername()}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy username
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => blockMutation.mutate()}
                        className="text-destructive"
                      >
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
                  className="grid h-11 w-11 place-items-center rounded-full bg-black/50 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-5 w-5" />
                </button>
              </>
            }
            avatarRing={p.accent_color}
            surface={previewBanner?.profileBackground ? previewBanner.surface : "#111214"}
            gutter="16px"
            onBannerPointerDown={beginSheetDrag}
          />

          {/* Profile info — same anatomy as the card and full profile. */}
          <div className="space-y-3 px-4 pb-4 pt-3">
            <div className="h-px bg-white/[0.06]" />

            {/* Primary actions sit directly under the identity, like Discord's
                  profile menu — no scrolling past the bio to message someone. */}
            {!isOwnProfile ? (
              <div className="flex items-center gap-2 pt-0.5">
                <Button
                  onClick={handleMessage}
                  className="h-10 flex-1 gap-1.5 border-0 bg-primary text-[13px] font-bold text-primary-foreground shadow-[0_10px_24px_-16px_var(--brand-signal)] hover:bg-primary/90"
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
                    className={`h-10 shrink-0 gap-1.5 border-white/15 px-3 text-[13px] font-bold ${following.data ? "bg-white/[0.06] text-foreground" : "text-foreground hover:bg-white/[0.06]"}`}
                  >
                    {following.data ? (
                      <UserCheck className="h-4 w-4" />
                    ) : (
                      <UserPlus className="h-4 w-4" />
                    )}
                    {following.data ? "Following" : "Follow"}
                  </Button>
                )}
              </div>
            ) : (
              <Button
                onClick={handleViewProfile}
                variant="outline"
                className="h-10 w-full border-white/15 bg-transparent text-[13px] font-bold text-foreground hover:bg-white/[0.06]"
              >
                View Full Profile
              </Button>
            )}

            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
              {p.bio ? (
                <>
                  <h4 className="text-[12px] font-bold uppercase tracking-wide text-foreground">
                    About Me
                  </h4>
                  <MarkdownText
                    text={p.bio}
                    className="mt-1.5 line-clamp-4 whitespace-pre-wrap text-[13px] leading-5 text-foreground/90 [&_a]:text-primary [&_a]:underline"
                  />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No bio yet.</p>
              )}
              <div className="mt-3 flex items-center gap-2 border-t border-white/[0.07] pt-3">
                <img
                  src="/brand/rizz-cat-logo.svg"
                  alt=""
                  aria-hidden
                  className="h-4 w-4 shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    Member Since
                  </p>
                  <p className="mt-0.5 truncate text-sm font-medium text-[#f2efe6]">
                    {monthYear(p.created_at)}
                  </p>
                </div>
              </div>
            </section>

            {/* Activity: the same four numbers the full profile shows. */}
            <section aria-label="Profile activity">
              <div className="mb-1.5 flex items-center justify-between">
                <h4 className="text-[12px] font-bold uppercase tracking-wide text-foreground">
                  Activity
                </h4>
                <span className="text-[10px] text-muted-foreground">Lifetime</span>
              </div>
              <div className="grid grid-cols-4 gap-1 rounded-2xl border border-white/10 bg-white/[0.035] p-1 text-center">
                <div className="rounded-xl py-2">
                  <p className="truncate font-display text-base font-bold tabular-nums text-foreground">
                    {activityCount(p.post_count)}
                  </p>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Posts
                  </p>
                </div>
                <div className="rounded-xl py-2">
                  <p className="truncate font-display text-base font-bold tabular-nums text-foreground">
                    {activityCount(p.follower_count)}
                  </p>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Followers
                  </p>
                </div>
                <div className="rounded-xl py-2">
                  <p className="truncate font-display text-base font-bold tabular-nums text-foreground">
                    {activityCount(p.following_count)}
                  </p>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Following
                  </p>
                </div>
                <div className="rounded-xl py-2">
                  <p className="flex items-center justify-center gap-1 truncate font-display text-base font-bold tabular-nums text-[#c8ff3d]">
                    <PawPrint className="h-3.5 w-3.5 shrink-0" />
                    {activityCount(p.paw_balance)}
                  </p>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Paws
                  </p>
                </div>
              </div>
            </section>
          </div>
        </motion.div>
      )}

      <BadgeDetailDialog
        entry={openBadge ? { badge: openBadge } : null}
        open={!!openBadge}
        onOpenChange={(next) => !next && setOpenBadge(null)}
        featured={!!openBadge && openBadge.slug === wornSlug}
        viewerId={user?.id ?? null}
      />
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
          style={
            previewBanner?.profileBackground
              ? { background: previewBanner.profileBackground }
              : undefined
          }
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
              <span
                className="mx-auto block h-1 w-10 rounded-full bg-white/25"
                aria-hidden="true"
              />
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
        style={
          previewBanner?.profileBackground
            ? { background: previewBanner.profileBackground }
            : undefined
        }
      >
        <DialogTitle className="sr-only">Profile preview for {username}</DialogTitle>
        <div className="max-h-[86dvh] overflow-y-auto">{panel}</div>
      </DialogContent>
    </Dialog>
  );
}
