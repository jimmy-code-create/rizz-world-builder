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
  Calendar,
  Copy,
  Hash,
  MessageCircle,
  MoreHorizontal,
  PawPrint,
  UserPlus,
  UserCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { getBanner } from "@/lib/banner";
import { usePresence, publicStatusOf, statusLabel } from "@/lib/presence";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BadgeLine } from "@/components/profile/BadgeInfoPopover";
import { ProfileEffectArt, isPageProfileEffect } from "@/components/effects/registry";
import { MarkdownText } from "@/components/MarkdownText";
import { fetchUserBadges, profileBadgeLineup } from "@/lib/badges";
import { useWornEffects } from "@/lib/effects";
import { usePurify, withPurifyBadge } from "@/lib/purify";
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
 * Discord-style profile preview: a compact banner, an overlapping avatar with
 * its presence dot, the name with every equipped badge on one row, the handle
 * and status, the full-profile button, ABOUT ME (markdown) with its icon, a
 * separate member-since row, and the same four Activity numbers as the full
 * profile. The header runs in `compact` mode so the feed sheet reclaims the
 * vertical space the old avatar/name gap wasted.
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
        // Marks this subtree as already owning a preview, so a nested avatar
        // never opens a second sheet over this one.
        data-profile-preview-trigger=""
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
  // A swipe past the threshold must not snap back to 0 and then play a second,
  // unrelated close animation — the card keeps travelling from the finger's
  // last position and only then unmounts.
  const [dismissing, setDismissing] = useState(false);
  const purify = usePurify();

  const presence = usePresence(p?.id ?? "");
  const status = publicStatusOf(presence);
  const statusText = statusLabel(status);

  const badges = useQuery({
    queryKey: ["profile-preview-badges", p?.id],
    queryFn: () => fetchUserBadges(p!.id),
    enabled: open && !!p,
    staleTime: 60_000,
  });

  // The preview wears the same cosmetics as the full profile behind it.
  const wornEffects = useWornEffects(p?.id);

  // The preview carries the same identity as the full profile, so the
  // popout never shows a different banner treatment than the page behind it.

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
  // Only the four profile marks survive, in a fixed order; Purify is injected
  // for subscribers so the subscriber badge always has its slot.
  const markBadges = profileBadgeLineup(
    withPurifyBadge(distinctBadges(canonBadges(earned)), purify.active),
  );
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
        // The skeleton mirrors the finished anatomy (3:1 cover, overlapping
        // avatar, identity, two actions, bio block, member since, activity) so
        // the sheet keeps one height while the row arrives instead of growing
        // upward under the thumb.
        <div className="animate-pulse" aria-hidden="true">
          <div className="aspect-[3/1] w-full bg-white/[0.06]" />
          <div className="px-3.5 pb-4 pt-2.5">
            <div className="-mt-9 ml-1 h-16 w-16 rounded-full bg-white/10 ring-[5px] ring-[#111214]" />
            <div className="mt-2 h-5 w-32 rounded bg-white/[0.06]" />
            <div className="mt-2 h-3.5 w-24 rounded bg-white/[0.06]" />
            <div className="mt-3 h-11 w-full rounded-xl bg-white/[0.05]" />
            <div className="mt-2 h-11 w-full rounded-xl bg-white/[0.05]" />
            <div className="mt-2 h-24 w-full rounded-2xl bg-white/[0.04]" />
            <div className="mt-2 h-10 w-full rounded-2xl bg-white/[0.03]" />
            <div className="mt-2 h-24 w-full rounded-2xl bg-white/[0.04]" />
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
          // A fade only. Scaling the panel pulled the cover and the name in a
          // few pixels the moment the row arrived, which read as the sheet
          // settling twice.
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
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
            status={status}
            statusIsSelf={isOwnProfile}
            customStatus={null}
            statusLine={<p className="mt-0.5 text-xs text-muted-foreground">{statusText}</p>}
            handleExtra={
              // Plain marks in one row, like Discord: no pill or plate behind
              // them, so the badges read as part of the identity rather than a
              // floating chip beside the handle.
              markBadges.length > 0 ? (
                <BadgeLine badges={markBadges} wornSlug={wornSlug} size={24} />
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
            avatarGlow={false}
            avatarDecoration={wornEffects.data?.avatar_decoration?.slug ?? null}
            profileEffect={wornEffects.data?.profile_effect?.slug ?? null}
            effectOnce
            surface={previewBanner?.profileBackground ? previewBanner.surface : "#111214"}
            gutter="14px"
            compact
            onBannerPointerDown={beginSheetDrag}
          />

          {/* Profile info — same anatomy as the card and full profile. */}
          <div className="space-y-2.5 px-3.5 pb-4 pt-2.5">
            {/* Primary actions sit directly under the identity, like Discord's
                  profile menu — no scrolling past the bio to message someone. */}
            {!isOwnProfile && (
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleMessage}
                  className="h-11 flex-1 gap-1.5 border-0 bg-primary text-[13px] font-bold text-primary-foreground shadow-[0_10px_24px_-16px_var(--brand-signal)] hover:bg-primary/90 active:bg-primary/85"
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
                    className={`h-11 shrink-0 gap-1.5 border-white/15 px-3 text-[13px] font-bold transition-colors active:bg-white/[0.1] ${following.data ? "bg-white/[0.06] text-foreground" : "text-foreground hover:bg-white/[0.06]"}`}
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
            )}

            <Button
              onClick={handleViewProfile}
              variant="outline"
              className="h-11 w-full border-white/15 bg-white/[0.02] text-[13px] font-bold text-foreground transition-colors hover:bg-white/[0.06] active:bg-white/[0.1]"
            >
              View Full Profile
            </Button>

            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
              <div className="flex items-center gap-1.5">
                <UserRound
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-foreground">
                  About Me
                </h4>
              </div>
              {p.bio ? (
                <MarkdownText
                  text={p.bio}
                  className="mt-2 line-clamp-4 whitespace-pre-wrap text-[13px] leading-5 text-foreground/90 [&_a]:text-primary [&_a]:underline"
                />
              ) : (
                <p className="mt-1.5 text-[13px] leading-5 text-muted-foreground">No bio yet.</p>
              )}
            </section>

            {/* Member since: one compact, clearly separate row. */}
            <div className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-2.5">
              <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <p className="min-w-0 truncate text-[12px] text-muted-foreground">
                Member since{" "}
                <span className="font-semibold text-foreground">{monthYear(p.created_at)}</span>
              </p>
            </div>

            {/* Activity: the same four numbers the full profile shows. */}
            <section aria-label="Profile activity">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-foreground">
                  Activity
                </h4>
                <span className="text-[10px] text-muted-foreground">Lifetime</span>
              </div>
              <div className="grid grid-cols-4 divide-x divide-white/[0.06] rounded-2xl border border-white/10 bg-white/[0.035] py-2.5 text-center">
                {(
                  [
                    { id: "posts", label: "Posts", value: p.post_count, Icon: Hash, accent: false },
                    {
                      id: "followers",
                      label: "Followers",
                      value: p.follower_count,
                      Icon: Users,
                      accent: false,
                    },
                    {
                      id: "following",
                      label: "Following",
                      value: p.following_count,
                      Icon: UserPlus,
                      accent: false,
                    },
                    {
                      id: "paws",
                      label: "Paws",
                      value: p.paw_balance,
                      Icon: PawPrint,
                      accent: true,
                    },
                  ] as const
                ).map(({ id, label, value, Icon, accent }) => (
                  <div key={id} className="min-w-0 px-1">
                    <Icon
                      className={
                        accent
                          ? "mx-auto h-3 w-3 text-[#ff2d3f]"
                          : "mx-auto h-3 w-3 text-muted-foreground/80"
                      }
                      aria-hidden="true"
                    />
                    <p
                      className={
                        accent
                          ? "mt-1 truncate font-display text-[15px] font-bold leading-none tabular-nums text-[#ff2d3f]"
                          : "mt-1 truncate font-display text-[15px] font-bold leading-none tabular-nums text-foreground"
                      }
                    >
                      {activityCount(value)}
                    </p>
                    <p className="mt-1 truncate text-[9px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </section>
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
          // The card is the dragged layer below, not this box: the tinted
          // surface, the cover and the content move as one object. When the
          // background lived on the (static) Radix box, every pull translated
          // only the content and exposed a bare strip of theme above the cover.
          className="profile-sheet max-h-[92dvh] gap-0 overflow-visible border-0 bg-transparent p-0 shadow-none"
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
              // Either a deliberate pull or a flick closes the sheet. Handing
              // the rest of the travel to the same motion value keeps the card
              // moving one way, instead of spring-back then fade-out.
              if (info.offset.y > 120 || info.velocity.y > 700) setDismissing(true);
            }}
            animate={dismissing ? { y: 900, opacity: 0 } : undefined}
            transition={dismissing ? { duration: 0.18, ease: "easeIn" } : undefined}
            onAnimationComplete={() => {
              if (!dismissing) return;
              setDismissing(false);
              onOpenChange(false);
            }}
            className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-[#0b0b0c] pb-[max(env(safe-area-inset-bottom),0.5rem)]"
            style={
              previewBanner?.profileBackground
                ? { background: previewBanner.profileBackground }
                : undefined
            }
          >
            {/* The sheet opens straight on the banner — no black handle strip
                above it. The grab pill floats over the cover and the banner
                itself stays draggable. */}
            <div
              onPointerDown={beginSheetDrag}
              className="absolute left-1/2 top-0 z-50 -translate-x-1/2 cursor-grab px-4 pb-4 pt-2 active:cursor-grabbing"
            >
              <span
                className="flex h-4 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm"
                aria-hidden="true"
              >
                <span className="block h-1 w-6 rounded-full bg-white/80" />
              </span>
              <span className="sr-only">Drag down to close</span>
            </div>
            <div className="min-h-0 overflow-y-auto overscroll-contain">{panel}</div>

            {/* The same full-profile decoration, played once on the small
                preview. The card's own radius and overflow clip it, so it can
                never spill onto the feed behind the sheet. */}
            {isPageProfileEffect(wornEffects.data?.profile_effect?.slug) && (
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20">
                <ProfileEffectArt
                  slug={wornEffects.data?.profile_effect?.slug}
                  animated={!p?.reduced_motion}
                  once
                />
              </div>
            )}
          </motion.div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className="popout-card gap-0 overflow-hidden rounded-2xl border-white/[0.06] bg-[#111214] p-0 shadow-2xl sm:w-[400px] sm:max-w-[400px]"
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
