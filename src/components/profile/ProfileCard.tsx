import { useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AtSign, Ban, Check, Flag, Link2, MessageCircle, MoreHorizontal,
  Pencil, Phone, UserCheck, UserPlus, VolumeX, Volume2,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CloseButton } from "@/components/ui/close-button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CustomStatusLine, StatusIcon } from "@/components/presence/StatusDot";
import { usePresence, publicCustomStatus, publicStatusOf } from "@/lib/presence";
import { defaultAvatarFor } from "@/lib/default-avatars";
import { MarkdownText } from "@/components/MarkdownText";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/** Legacy shape (realm chat passes these); userId is the only required field. */
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

type CardBadge = { slug: string; name: string; icon: string; color: string; description: string };

type CardData = {
  deleted: boolean;
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  pronouns: string | null;
  verified: boolean;
  createdAt: string | null;
  rizzScore: number;
  rank: number | null;
  followers: number;
  following: number;
  badges: CardBadge[];
  mutualPreview: Array<{ id: string; username: string; display_name: string | null; avatar_url: string | null }>;
  mutualTotal: number;
  viewerFollows: boolean;
  blockedByViewer: boolean;
  blockedViewer: boolean;
  mutedByViewer: boolean;
};

/**
 * The card prefers the get_profile_card() RPC but works without it (pending
 * migration). Once the server says the function isn't there, stop asking —
 * that keeps every preview from logging a 404 and makes opens instant.
 */
let profileCardRpcMissing = false;

async function fetchCardData(userId: string, viewerId: string | null): Promise<CardData> {
  // 1) Prefer the server function (profile + stats + rank + mutuals in one call).
  try {
    if (!profileCardRpcMissing) {
      const { data, error } = await (supabase.rpc as never)("get_profile_card" as never, {
        _user_id: userId,
        _viewer: viewerId,
      } as never);
      if (error) {
        const rpcError = error as { code?: string; message?: string };
        if (rpcError.code === "PGRST202" || /could not find the function/i.test(rpcError.message ?? "")) {
          profileCardRpcMissing = true;
        }
      } else if (data) {
        const d = data as {
          deleted?: boolean;
          profile?: Record<string, unknown>;
          rank?: number; followers?: number; following?: number;
          mutual_preview?: CardData["mutualPreview"]; mutual_total?: number;
          earned_badges?: Array<Record<string, string>>;
          viewer_follows?: boolean; blocked_by_viewer?: boolean;
          blocked_viewer?: boolean; muted_by_viewer?: boolean;
        };
        if (d.deleted || !d.profile) return deletedCard(userId);
        const p = d.profile;
        const str = (v: unknown) => (typeof v === "string" ? v : null);
        const earnedBadges = (d.earned_badges ?? []).map((b) => ({
          slug: b.slug ?? "badge",
          name: b.name ?? "Badge",
          icon: b.icon ?? "🏅",
          color: b.color ?? "#c8ff3d",
          description: b.description ?? "",
        }));
        // "Verified" is an earned badge (badges.slug = verified / verified_creator),
        // never a profiles column.
        const isVerified = earnedBadges.some((b) => b.slug === "verified" || b.slug === "verified_creator");
        return {
          deleted: false,
          id: String(p.id ?? userId),
          username: str(p.username) ?? "member",
          displayName: str(p.display_name) ?? str(p.username) ?? "Member",
          avatarUrl: str(p.avatar_url),
          bannerUrl: str(p.banner_url),
          bio: str(p.bio),
          pronouns: str(p.pronouns),
          verified: p.verified === true || isVerified,
          createdAt: str(p.created_at),
          rizzScore: Number(p.rizz_score ?? 0),
          rank: typeof d.rank === "number" ? d.rank : null,
          followers: Number(d.followers ?? 0),
          following: Number(d.following ?? 0),
          badges: earnedBadges.filter((b) => b.slug !== "verified" && b.slug !== "verified_creator"),
          mutualPreview: d.mutual_preview ?? [],
          mutualTotal: Number(d.mutual_total ?? 0),
          viewerFollows: !!d.viewer_follows,
          blockedByViewer: !!d.blocked_by_viewer,
          blockedViewer: !!d.blocked_viewer,
          mutedByViewer: !!d.muted_by_viewer,
        };
      }
    }
  } catch {
    // Function not deployed yet — fall through to direct queries.
  }

  // 2) Fallback: same stores the profile page reads, assembled client-side.
  // NOTE: no `verified` column here — verification lives in user_badges/badges,
  // and asking PostgREST for a column that doesn't exist fails the whole query
  // (that is what broke every profile preview).
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, banner_url, bio, created_at, rizz_score")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) return deletedCard(userId);
  const p = profile as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : null);

  // Optional new columns (missing until the migration lands → hidden).
  let pronouns: string | null = null;
  try {
    const { data: ext } = await supabase.from("profiles").select("pronouns").eq("id", userId).maybeSingle();
    pronouns = str((ext as Record<string, unknown> | null)?.pronouns);
  } catch { /* column missing */ }

  const score = Number(p.rizz_score ?? 0);
  const [followers, following, rankRow, rel] = await Promise.all([
    supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", userId)
      .then((r) => r.count ?? 0).catch(() => 0),
    supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("follower_id", userId)
      .then((r) => r.count ?? 0).catch(() => 0),
    score > 0
      ? supabase.from("profiles").select("id", { count: "exact", head: true }).gt("rizz_score", score)
          .then((r) => (r.count ?? 0) + 1).catch(() => null)
      : Promise.resolve(null),
    viewerId
      ? Promise.all([
          supabase.from("follows").select("follower_id").eq("follower_id", viewerId).eq("following_id", userId).maybeSingle()
            .then((r) => !!r.data).catch(() => false),
          supabase.from("blocks").select("blocker_id").eq("blocker_id", viewerId).eq("blocked_id", userId).maybeSingle()
            .then((r) => !!r.data).catch(() => false),
          supabase.from("blocks").select("blocker_id").eq("blocker_id", userId).eq("blocked_id", viewerId).maybeSingle()
            .then((r) => !!r.data).catch(() => false),
          supabase.from("mutes").select("muter_id").eq("muter_id", viewerId).eq("muted_id", userId).maybeSingle()
            .then((r) => !!r.data).catch(() => false),
        ])
      : Promise.resolve([false, false, false, false] as const),
  ]);
  const [viewerFollows, blockedByViewer, blockedViewer, mutedByViewer] = rel as [boolean, boolean, boolean, boolean];

  // Mutual followers: their followers ∩ people I follow (preview 3 + total).
  let mutualPreview: CardData["mutualPreview"] = [];
  let mutualTotal = 0;
  if (viewerId && viewerId !== userId) {
    try {
      const { data: theirFollowers } = await supabase.from("follows").select("follower_id").eq("following_id", userId).limit(200);
      const theirIds = ((theirFollowers ?? []) as { follower_id: string }[]).map((r) => r.follower_id);
      if (theirIds.length > 0) {
        const { data: mine } = await supabase.from("follows").select("following_id").eq("follower_id", viewerId).in("following_id", theirIds);
        const mutualIds = ((mine ?? []) as { following_id: string }[]).map((r) => r.following_id);
        mutualTotal = mutualIds.length;
        if (mutualIds.length > 0) {
          const { data: previews } = await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", mutualIds.slice(0, 3));
          mutualPreview = ((previews ?? []) as CardData["mutualPreview"]).filter((m) => m.username);
        }
      }
    } catch { /* mutuals are best-effort */ }
  }

  // Earned badges from user_badges — this is also where "verified" comes from.
  let badges: CardBadge[] = [];
  try {
    const { data: ub } = await supabase.from("user_badges").select("badge:badges(slug, name, icon, color, description)").eq("user_id", userId).limit(8);
    badges = (((ub ?? []) as Array<{ badge: CardBadge | CardBadge[] | null }>).map((r) => Array.isArray(r.badge) ? r.badge[0] : r.badge).filter(Boolean) as CardBadge[]);
  } catch { /* badges are best-effort */ }
  const verified = badges.some((b) => b.slug === "verified" || b.slug === "verified_creator");
  if (verified) badges = badges.filter((b) => b.slug !== "verified" && b.slug !== "verified_creator");

  return {
    deleted: false,
    id: String(p.id ?? userId),
    username: str(p.username) ?? "member",
    displayName: str(p.display_name) ?? str(p.username) ?? "Member",
    avatarUrl: str(p.avatar_url),
    bannerUrl: str(p.banner_url),
    bio: str(p.bio),
    pronouns,
    verified,
    createdAt: str(p.created_at),
    rizzScore: score,
    rank: rankRow,
    followers,
    following,
    badges,
    mutualPreview,
    mutualTotal,
    viewerFollows,
    blockedByViewer,
    blockedViewer,
    mutedByViewer,
  };
}

function deletedCard(userId: string): CardData {
  return {
    deleted: true, id: userId, username: "deleted", displayName: "Deleted user",
    avatarUrl: null, bannerUrl: null, bio: null, pronouns: null, verified: false,
    createdAt: null, rizzScore: 0, rank: null, followers: 0, following: 0,
    badges: [], mutualPreview: [], mutualTotal: 0, viewerFollows: false,
    blockedByViewer: false, blockedViewer: false, mutedByViewer: false,
  };
}

/**
 * ONE shared <ProfileCard userId>. Banner + overlapping avatar + realtime
 * presence dot, pronouns + custom status line, tappable badges, bio/member
 * since, stats (score/rank/followers/following), mutuals, Message / Follow /
 * Call / "..." menu, View full profile. Graceful blocked/deleted states.
 */
export function ProfileCard({
  userId,
  username: usernameHint,
  displayName: displayNameHint,
  avatarUrl: avatarUrlHint,
  realmRole,
  onMention,
  onCall,
  onOpenChange,
}: {
  userId: string;
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  realmRole?: string | null;
  onMention?: (username: string) => void;
  onCall?: (userId: string) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const { user: me } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [bioExpanded, setBioExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [badgeTip, setBadgeTip] = useState<string | null>(null);
  const dragStart = useRef<number | null>(null);

  const isSelf = me?.id === userId;
  const card = useQuery({
    queryKey: ["profile-card", userId, me?.id ?? "anon"],
    queryFn: () => fetchCardData(userId, me?.id ?? null),
    enabled: !!userId,
    staleTime: 30_000,
  });
  // Same realtime presence store as the profile page.
  const presenceRow = usePresence(userId);
  const status = presenceRow ? publicStatusOf(presenceRow, !!isSelf) : "offline";
  const customStatus = presenceRow ? publicCustomStatus(presenceRow, !!isSelf) : null;

  const toggleFollow = useMutation({
    mutationFn: async () => {
      if (!me) throw new Error("Sign in to follow");
      if (card.data?.viewerFollows) {
        const { error } = await supabase.from("follows").delete().eq("follower_id", me.id).eq("following_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("follows").insert({ follower_id: me.id, following_id: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["profile-card", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setBlocked = useMutation({
    mutationFn: async (block: boolean) => {
      if (!me) throw new Error("Sign in first");
      if (block) {
        const { error } = await supabase.from("blocks").insert({ blocker_id: me.id, blocked_id: userId });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("blocks").delete().eq("blocker_id", me.id).eq("blocked_id", userId);
        if (error) throw error;
      }
    },
    onSuccess: (_, block) => {
      toast.success(block ? "Blocked" : "Unblocked");
      void qc.invalidateQueries({ queryKey: ["profile-card", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setMuted = useMutation({
    mutationFn: async (mute: boolean) => {
      if (!me) throw new Error("Sign in first");
      if (mute) {
        const { error } = await supabase.from("mutes").insert({ muter_id: me.id, muted_id: userId });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("mutes").delete().eq("muter_id", me.id).eq("muted_id", userId);
        if (error) throw error;
      }
    },
    onSuccess: (_, mute) => {
      toast.success(mute ? "Muted" : "Unmuted");
      void qc.invalidateQueries({ queryKey: ["profile-card", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const close = () => onOpenChange?.(false);
  const copyLink = () => {
    const url = `${window.location.origin}/u/${d?.username ?? usernameHint ?? ""}`;
    void navigator.clipboard.writeText(url).then(
      () => toast.success("Profile link copied"),
      () => toast.error("Couldn't copy the link"),
    );
    setMenuOpen(false);
  };

  // No user id (a bot message, a deleted placeholder): nothing to show. The
  // query stays disabled in that case, so `card.data` would be undefined and
  // rendering used to take the whole page down.
  if (!userId) return null;

  if (card.isLoading) {
    return (
      <div className="p-0" role="status" aria-label="Loading profile">
        <div className="skeleton-shimmer h-[100px] w-full" />
        <div className="flex items-end gap-3 px-4">
          <div className="skeleton-shimmer -mt-10 h-20 w-20 rounded-full" />
          <div className="mb-1 flex-1 space-y-2 pb-1">
            <div className="skeleton-shimmer h-4 w-2/3 rounded" />
            <div className="skeleton-shimmer h-3 w-1/3 rounded" />
          </div>
        </div>
        <div className="space-y-2 p-4">
          <div className="skeleton-shimmer h-20 rounded-xl" />
          <div className="skeleton-shimmer h-11 rounded-xl" />
        </div>
      </div>
    );
  }

  if (card.isError) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-muted-foreground">Couldn&apos;t load this profile.</p>
        <Button type="button" variant="outline" onClick={() => void card.refetch()} className="mt-3 h-11">
          Try again
        </Button>
      </div>
    );
  }

  const d = card.data!;
  if (d.deleted) {
    return (
      <div className="p-6 text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#1c1c1f] text-2xl">?</div>
        <p className="mt-3 text-sm font-semibold text-foreground">This account is gone</p>
        <p className="mt-1 text-xs text-muted-foreground">The user was deleted or deactivated.</p>
      </div>
    );
  }

  const hintName = displayNameHint || usernameHint || d.displayName;
  const avatarSrc = d.avatarUrl ?? avatarUrlHint ?? defaultAvatarFor(d.username);

  // They blocked me: reveal nothing (no banner/photo/status).
  if (d.blockedViewer && !isSelf) {
    return (
      <div className="p-6 text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#1c1c1f] text-2xl font-bold text-muted-foreground">
          {hintName.charAt(0).toUpperCase()}
        </div>
        <p className="mt-3 text-sm font-semibold text-foreground">Not available</p>
        <p className="mt-1 text-xs text-muted-foreground">This profile isn&apos;t visible to you.</p>
      </div>
    );
  }

  const bannerBg = d.bannerUrl ? `url(${d.bannerUrl}) center/cover` : bannerToneFor(userId);
  const joinDate = d.createdAt
    ? new Date(d.createdAt).toLocaleDateString([], { month: "long", year: "numeric" })
    : null;

  const computedBadges: CardBadge[] = [
    ...(d.rank != null && d.rank <= 10
      ? [{ slug: "top-10", name: "Top 10", icon: "🏆", color: "#c8ff3d", description: `Ranked #${d.rank} on the leaderboard` }]
      : []),
    ...(d.verified ? [{ slug: "verified", name: "Verified", icon: "✔", color: "#f2efe6", description: "Verified creator" }] : []),
    ...(d.createdAt && new Date(d.createdAt).getTime() < new Date("2025-01-01").getTime()
      ? [{ slug: "early", name: "Early user", icon: "🌱", color: "#c8ff3d", description: "Here since the early days" }]
      : []),
    ...d.badges.slice(0, 5),
  ].slice(0, 6);

  const statusLine = customStatus && (customStatus.emoji || customStatus.text) ? (
    <CustomStatusLine status={{ emoji: customStatus.emoji, text: customStatus.text }} className="mt-1 text-[13px] text-muted-foreground" />
  ) : null;

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
      <div className="relative h-[100px] w-full" style={{ background: bannerBg }}>
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
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onSelect={copyLink} className="gap-2">
                <Link2 className="h-4 w-4" /> Copy profile link
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => { setMenuOpen(false); void setMuted.mutate(!d.mutedByViewer); }}
                className="gap-2"
              >
                {d.mutedByViewer ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                {d.mutedByViewer ? "Unmute" : "Mute"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => { setMenuOpen(false); void setBlocked.mutate(!d.blockedByViewer); }}
                className="gap-2"
              >
                <Ban className="h-4 w-4" /> {d.blockedByViewer ? "Unblock" : "Block"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setMenuOpen(false);
                  toast.info("Report sent", { description: "A moderator will take a look." });
                }}
                className="gap-2"
              >
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
        {/* Avatar overlapping banner + presence dot */}
        <div className="-mt-10 flex items-end justify-between gap-3">
          <span className="relative inline-flex">
            <Avatar className="h-20 w-20 rounded-full ring-[6px] ring-[#141416]">
              <AvatarImage src={avatarSrc ?? undefined} className="object-cover" />
              <AvatarFallback className="rounded-full bg-[#1c1c1f] text-2xl font-bold text-[#f2efe6]">
                {d.displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span
              className="absolute -bottom-0.5 -right-0.5 grid place-items-center rounded-full bg-[#141416] p-[3px]"
              title={status}
            >
              <StatusIcon status={status} size={22} />
            </span>
          </span>
          {d.blockedByViewer && (
            <span className="mb-1 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-muted-foreground">
              You blocked this account
            </span>
          )}
        </div>

        {d.blockedByViewer && !isSelf ? (
          <div className="mt-3 rounded-xl bg-[#1c1c1f] p-4 text-center" style={{ borderRadius: 12 }}>
            <p className="text-sm font-semibold text-foreground">@{d.username} is blocked</p>
            <p className="mt-1 text-xs text-muted-foreground">Unblock to see their banner, photo and status.</p>
            <Button
              type="button" variant="outline" disabled={setBlocked.isPending}
              onClick={() => setBlocked.mutate(false)} className="mt-3 h-11"
            >
              Unblock
            </Button>
          </div>
        ) : (
          <>
            {/* Name / handle / pronouns / status */}
            <div className="mt-2 flex items-center gap-1.5">
              <h2 className="truncate font-display text-xl font-bold leading-tight text-[#f2efe6]" style={{ fontSize: 20 }}>
                {d.displayName}
              </h2>
              {d.verified && (
                <span title="Verified" aria-label="Verified" className="shrink-0 text-[#c8ff3d]">
                  <Check className="h-4 w-4" />
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              @{d.username}
              {d.pronouns && <span className="text-muted-foreground"> · {d.pronouns}</span>}
            </p>
            {statusLine}

            {/* Badges (tap for tooltip) */}
            {computedBadges.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Badges">
                {computedBadges.map((b) => (
                  <button
                    key={b.slug}
                    type="button"
                    title={b.description || b.name}
                    aria-label={`${b.name}${b.description ? `: ${b.description}` : ""}`}
                    onClick={() => setBadgeTip((t) => (t === b.slug ? null : b.slug))}
                    className="flex min-h-[44px] min-w-[44px] items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 text-xs font-semibold text-[#f2efe6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d]"
                  >
                    <span aria-hidden>{b.icon}</span>
                    <span className="hidden min-[380px]:inline">{b.name}</span>
                  </button>
                ))}
              </div>
            )}
            {badgeTip && (
              <p role="status" className="mt-1.5 rounded-lg border border-white/10 bg-black/60 px-2.5 py-1.5 text-xs text-muted-foreground">
                {computedBadges.find((b) => b.slug === badgeTip)?.description ?? badgeTip}
              </p>
            )}

            {/* Inner panel */}
            <div className="mt-3 rounded-xl bg-[#1c1c1f] p-3" style={{ borderRadius: 12 }}>
              {d.bio ? (
                <>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">About me</p>
                  <div className={`mt-1 text-sm leading-snug text-foreground/90 ${bioExpanded ? "" : "line-clamp-3"}`}>
                    <MarkdownText text={d.bio} />
                    {!bioExpanded && d.bio.length > 180 && (
                      <button type="button" onClick={() => setBioExpanded(true)} className="mt-0.5 min-h-[44px] text-xs font-semibold text-[#c8ff3d] hover:underline">
                        more
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{isSelf ? "Tell people who you are — edit your profile to add a bio." : "No bio yet."}</p>
              )}
              {joinDate && (
                <>
                  <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Member since
                  </p>
                  <p className="mt-0.5 text-sm text-[#f2efe6]">{joinDate}</p>
                </>
              )}
              {realmRole && realmRole !== "member" && (
                <>
                  <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    In this realm
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span className="flex min-h-[44px] items-center gap-1.5 rounded-full border border-white/10 px-2.5 text-xs text-[#f2efe6]">
                      <span className="h-2 w-2 rounded-full bg-[#c8ff3d]" />
                      {realmRole}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Stats */}
            <div className="mt-3 grid grid-cols-4 divide-x divide-white/10 rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-center">
              {[
                { value: d.rizzScore, label: "Rizz" },
                { value: d.rank != null ? `#${d.rank}` : "—", label: "Rank" },
                { value: d.followers, label: "Followers" },
                { value: d.following, label: "Following" },
              ].map((s) => (
                <div key={s.label}>
                  <p className="truncate text-sm font-bold tabular-nums text-foreground">{s.value}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Mutual followers */}
            {d.mutualTotal > 0 && (
              <div className="mt-2.5 flex min-h-[44px] items-center gap-2">
                <span className="flex -space-x-2">
                  {d.mutualPreview.map((m) => (
                    <Avatar key={m.id} className="h-6 w-6 ring-2 ring-[#141416]">
                      <AvatarImage src={m.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-[#1c1c1f] text-[9px] font-bold text-[#f2efe6]">
                        {(m.display_name || m.username || "?").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  Followed by {d.mutualPreview.map((m) => m.username).filter(Boolean).join(", ")}
                  {d.mutualTotal > d.mutualPreview.length && ` and ${d.mutualTotal - d.mutualPreview.length} more`}
                </span>
              </div>
            )}

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
                    onClick={() => { close(); void nav({ to: "/dm/$userId", params: { userId } }); }}
                    className="h-11 flex-1 bg-[#c8ff3d] text-[#0b0b0c] hover:bg-[#c8ff3d]/90"
                  >
                    <MessageCircle className="h-4 w-4" /> Message
                  </Button>
                  <Button
                    type="button" variant="outline" disabled={toggleFollow.isPending}
                    onClick={() => toggleFollow.mutate()} className="h-11 flex-1"
                  >
                    {d.viewerFollows ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                    {d.viewerFollows ? "Following" : "Follow"}
                  </Button>
                  {onCall && (
                    <Button
                      type="button" variant="outline" aria-label={`Call ${d.username}`}
                      onClick={() => { close(); onCall(userId); }} className="h-11 w-11 shrink-0 px-0"
                    >
                      <Phone className="h-4 w-4" />
                    </Button>
                  )}
                </>
              )}
              {onMention && !isSelf && (
                <Button
                  type="button" variant="outline" aria-label={`Mention ${d.username}`}
                  onClick={() => { close(); onMention(d.username); }} className="h-11 gap-1.5"
                >
                  <AtSign className="h-4 w-4" /> Mention
                </Button>
              )}
            </div>
            <button
              type="button"
              onClick={() => { close(); void nav({ to: "/u/$username", params: { username: d.username } }); }}
              className="mx-auto mt-1 flex min-h-[44px] items-center justify-center px-4 text-xs font-semibold text-muted-foreground hover:text-foreground hover:underline"
            >
              View full profile
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Bottom sheet on phones, centered 340px popover on desktop. */
export function ProfileCardDialog({
  user,
  open,
  onOpenChange,
  onMention,
  onCall,
}: {
  user: ProfileCardUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMention?: (username: string) => void;
  onCall?: (userId: string) => void;
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
        {user && (
          <ProfileCard
            userId={user.userId}
            username={user.username}
            displayName={user.displayName}
            avatarUrl={user.avatarUrl}
            realmRole={user.realmRole}
            onMention={onMention}
            onCall={onCall}
            onOpenChange={handleChange}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
