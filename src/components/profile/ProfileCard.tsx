import { Fragment, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AtSign, Ban, ChevronRight, Flag, Link2, MessageCircle, MoreHorizontal,
  Pencil, Phone, Trophy, UserCheck, UserPlus, VolumeX, Volume2,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CloseButton } from "@/components/ui/close-button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StatusPill } from "@/components/presence/StatusDot";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { Badge } from "@/components/Badge";
import { AnimatedBadge } from "@/components/profile/AnimatedBadge";
import { PURIFY_BADGE, usePurify } from "@/lib/purify";
import { canonBadges, canonicalFor, distinctBadges } from "@/lib/badge-set";
import { usePresence, publicCustomStatus, publicStatusOf } from "@/lib/presence";
import { MarkdownText } from "@/components/MarkdownText";
import { supabase } from "@/integrations/supabase/client";
import { untypedRpc } from "@/lib/untyped-db";
import { getBanner } from "@/lib/banner";
import { useAuth } from "@/lib/auth";
import { useWornEffects } from "@/lib/effects";
import { profileBadgeLineup } from "@/lib/badges";

/** Legacy shape (realm chat passes these); userId is the only required field. */
export type ProfileCardUser = {
  userId: string;
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  realmRole?: string | null;
  /** Realm the card was opened from — enables the "In this realm" section. */
  realmId?: string | null;
  /** Their accent color, when a caller already knows it. */
  accentColor?: string | null;
  isBot?: boolean;
  botName?: string | null;
};

/** 943 → "943" · 12,400 → "12.4K" · 500,000 → "500K" · 1,200,000 → "1.2M" */
export function formatCount(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const abs = Math.abs(value);
  if (abs < 10_000) return value.toLocaleString("en-US");
  if (abs < 1_000_000) return `${(value / 1000).toFixed(abs >= 100_000 || abs % 1000 === 0 ? 0 : 1)}K`;
  return `${(value / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 1)}M`;
}

type CardBadge = { slug: string; name: string; icon: string; color: string; description: string; earnedAt?: string | null };

const REALM_ROLE_META: Record<string, { label: string; color: string }> = {
  owner: { label: "Owner", color: "#ffc457" },
  admin: { label: "Admin", color: "#ff8f6b" },
  mod: { label: "Moderator", color: "#7dd3fc" },
  moderator: { label: "Moderator", color: "#7dd3fc" },
  member: { label: "Member", color: "#a1a1aa" },
  bot: { label: "Bot", color: "#c8ff3d" },
};

type CardData = {
  deleted: boolean;
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bannerMode: string | null;
  bannerGradient: unknown;
  updatedAt: string | null;
  accentColor: string | null;
  reducedMotion: boolean;
  bio: string | null;
  pronouns: string | null;
  verified: boolean;
  createdAt: string | null;
  pawBalance: number;
  rank: number | null;
  followers: number;
  following: number;
  badges: CardBadge[];
  /** Slug of the badge the member wears beside their name (null when none). */
  featuredBadge: string | null;
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
      const { data, error } = await untypedRpc(supabase)("get_profile_card", {
        _user_id: userId,
        _viewer: viewerId,
      });
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
        // The RPC was deployed before banner_mode/banner_gradient existed, so a
        // popup could show a different banner than the full page. Read the live
        // profile row for the visual fields; the RPC still supplies stats.
        let fresh: Record<string, unknown> = {};
        try {
          const { data: live } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
          fresh = (live as Record<string, unknown> | null) ?? {};
        } catch {
          /* keep the RPC copy when the direct read is denied */
        }
        const earnedBadges: CardBadge[] = (d.earned_badges ?? []).map((b) => ({
          slug: b.slug ?? "badge",
          name: b.name ?? "Badge",
          icon: b.icon ?? "🏅",
          color: b.color ?? "#c8ff3d",
          description: b.description ?? "",
          earnedAt: typeof b.awarded_at === "string" ? b.awarded_at : null,
        }));
        // Keep verification sourced from earned badge rows, including the
        // legacy slug while accounts migrate to the 12-badge set.
        const isVerified = earnedBadges.some((b) => b.slug === "verified" || b.slug === "no-cap");
        return {
          deleted: false,
          id: String(fresh.id ?? p.id ?? userId),
          username: str(fresh.username) ?? str(p.username) ?? "member",
          displayName: str(fresh.display_name) ?? str(p.display_name) ?? str(p.username) ?? "Member",
          avatarUrl: str(fresh.avatar_url) ?? str(p.avatar_url),
          bannerUrl: str(fresh.banner_url) ?? str(p.banner_url),
          bannerMode: str(fresh.banner_mode) ?? str(p.banner_mode),
          bannerGradient: fresh.banner_gradient ?? p.banner_gradient ?? null,
          updatedAt: str(fresh.updated_at) ?? str(p.updated_at),
          accentColor: str(fresh.accent_color) ?? str(p.accent_color),
          reducedMotion: Boolean(fresh.reduced_motion ?? p.reduced_motion),
          bio: str(fresh.bio) ?? str(p.bio),
          pronouns: str(fresh.pronouns) ?? str(p.pronouns),
          verified: p.verified === true || isVerified,
          createdAt: str(p.created_at),
          pawBalance: Number(p.paw_balance ?? p.rizz_score ?? 0),
          rank: typeof d.rank === "number" ? d.rank : null,
          followers: Number(d.followers ?? 0),
          following: Number(d.following ?? 0),
          badges: earnedBadges,
          featuredBadge: str(p.featured_badge),
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
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) return deletedCard(userId);
  const p = profile as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  const pronouns = str(p.pronouns);
  const accentColor = str(p.accent_color);
  const featuredBadge = str(p.featured_badge);

  const balance = Number(p.paw_balance ?? 0);
  const earned = Number(p.paw_earned ?? balance);
  // NOTE: PostgREST builders are only PromiseLike, so each one is wrapped in a
  // real Promise before `.then(...).catch(...)` — `.catch` does not exist on
  // PromiseLike and that is what used to break this fallback path.
  const [followers, following, rankRow, rel] = await Promise.all([
    Promise.resolve(supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", userId))
      .then((r) => r.count ?? 0)
      .catch(() => 0),
    Promise.resolve(supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("follower_id", userId))
      .then((r) => r.count ?? 0)
      .catch(() => 0),
    earned > 0
      ? Promise.resolve(supabase.from("profiles").select("id", { count: "exact", head: true }).gt("paw_earned", earned))
          .then((r) => (r.count ?? 0) + 1)
          .catch(() => null)
      : Promise.resolve(null),
    viewerId
      ? Promise.all([
          Promise.resolve(supabase.from("follows").select("follower_id").eq("follower_id", viewerId).eq("following_id", userId).maybeSingle())
            .then((r) => !!r.data)
            .catch(() => false),
          Promise.resolve(supabase.from("blocks").select("blocker_id").eq("blocker_id", viewerId).eq("blocked_id", userId).maybeSingle())
            .then((r) => !!r.data)
            .catch(() => false),
          Promise.resolve(supabase.from("blocks").select("blocker_id").eq("blocker_id", userId).eq("blocked_id", viewerId).maybeSingle())
            .then((r) => !!r.data)
            .catch(() => false),
          Promise.resolve(supabase.from("mutes").select("muter_id").eq("muter_id", viewerId).eq("muted_id", userId).maybeSingle())
            .then((r) => !!r.data)
            .catch(() => false),
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
    const { data: ub } = await supabase
      .from("user_badges")
      .select("awarded_at, badge:badges(slug, name, icon, color, description)")
      .eq("user_id", userId)
      .limit(24);
    badges = (((ub ?? []) as unknown as Array<{ awarded_at: string | null; badge: CardBadge | CardBadge[] | null }>)
      .map((row) => {
        const badge = Array.isArray(row.badge) ? row.badge[0] : row.badge;
        return badge ? { ...badge, earnedAt: row.awarded_at ?? null } : null;
      })
      .filter(Boolean) as CardBadge[]);
  } catch { /* badges are best-effort */ }
  // Preserve legacy verification while supporting the new admin-granted slug.
  const verified = badges.some((b) => b.slug === "verified" || b.slug === "no-cap");

  return {
    deleted: false,
    id: String(p.id ?? userId),
    username: str(p.username) ?? "member",
    displayName: str(p.display_name) ?? str(p.username) ?? "Member",
    avatarUrl: str(p.avatar_url),
    bannerUrl: str(p.banner_url),
    bannerMode: str(p.banner_mode),
    bannerGradient: p.banner_gradient ?? null,
    updatedAt: str(p.updated_at),
    accentColor,
    reducedMotion: Boolean(p.reduced_motion),
    bio: str(p.bio),
    pronouns,
    verified,
    createdAt: str(p.created_at),
    pawBalance: balance,
    rank: rankRow,
    followers,
    following,
    badges,
    featuredBadge,
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
    avatarUrl: null, bannerUrl: null, bannerMode: null, bannerGradient: null, updatedAt: null,
    accentColor: null, reducedMotion: false, bio: null, pronouns: null, verified: false,
    createdAt: null, pawBalance: 0, rank: null, followers: 0, following: 0,
    badges: [], featuredBadge: null, mutualPreview: [], mutualTotal: 0, viewerFollows: false,
    blockedByViewer: false, blockedViewer: false, mutedByViewer: false,
  };
}

/**
 * ONE shared <ProfileCard userId>. Tall banner with a fade into the card,
 * accent-ringed avatar + realtime presence dot, handle/pronouns/custom status,
 * proof-of-life badges (up to 5 icon pills + a sheet with the full story), bio with
 * tappable mentions and links, member-since, the realm section when a realm is
 * known, formatted stats — with tappable follower lists — mutuals, Message /
 * Follow / Call, Block-Report-Mute in the menu and a real View-full-profile
 * button. Graceful blocked/deleted/no-data states throughout.
 */
export function ProfileCard({
  userId,
  username: usernameHint,
  displayName: displayNameHint,
  avatarUrl: avatarUrlHint,
  realmRole,
  realmId,
  accentColor: accentColorHint,
  onMention,
  onCall,
  onOpenChange,
  onEditStatus,
}: {
  userId: string;
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  realmRole?: string | null;
  realmId?: string | null;
  accentColor?: string | null;
  onMention?: (username: string) => void;
  onCall?: (userId: string) => void;
  onOpenChange?: (open: boolean) => void;
  /** Owner tap on the status pill opens the status editor. */
  onEditStatus?: () => void;
}) {
  const { user: me } = useAuth();
  const purify = usePurify();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [bioExpanded, setBioExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [listMode, setListMode] = useState<null | "followers" | "following">(null);
  const dragStart = useRef<number | null>(null);

  const isSelf = me?.id === userId;
  const card = useQuery({
    queryKey: ["profile-card", userId, me?.id ?? "anon"],
    queryFn: () => fetchCardData(userId, me?.id ?? null),
    enabled: !!userId,
    staleTime: 30_000,
  });
  // The compact card wears the same cosmetics as the full profile; tapping a
  // name in a realm or a leaderboard should not strip the member's effect.
  const worn = useWornEffects(userId);
  // When the card knows which realm it was opened from, resolve the real
  // membership row (role + join date); otherwise fall back to the hint.
  const realmRow = useQuery({
    queryKey: ["profile-card-realm", userId, realmId ?? "none"],
    enabled: !!realmId && !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("realm_members")
          .select("role, joined_at")
          .eq("realm_id", realmId!)
          .eq("user_id", userId)
          .maybeSingle();
        if (error) throw error;
        return (data as { role: string; joined_at: string } | null) ?? null;
      } catch {
        return null; // realm context is decoration, never a blocker
      }
    },
  });
  // Followers / following sheet — fetched when opened, a page at a time.
  const listQuery = useQuery({
    queryKey: ["profile-card-list", userId, listMode],
    enabled: !!listMode && !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const column = listMode === "followers" ? "follower_id" : "following_id";
      const match = listMode === "followers" ? "following_id" : "follower_id";
      const { data: rows, error } = await (supabase as any)
        .from("follows")
        .select(column)
        .eq(match, userId)
        .limit(50);
      if (error) throw error;
      const ids = ((rows ?? []) as Array<Record<string, string>>).map((row) => row[column]).filter(Boolean);
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", ids);
      return ((profiles ?? []) as Array<{ id: string; username: string | null; display_name: string | null; avatar_url: string | null }>)
        .sort((a, b) => (a.display_name || a.username || "").localeCompare(b.display_name || b.username || ""));
    },
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
        <div className="skeleton-shimmer h-[132px] w-full" />
        <div className="flex items-end gap-3 px-4">
          <div className="skeleton-shimmer -mt-10 h-20 w-20 rounded-full" />
          <div className="mb-1 flex-1 space-y-2 pb-1">
            <div className="skeleton-shimmer h-4 w-2/3 rounded" />
            <div className="skeleton-shimmer h-3 w-1/3 rounded" />
          </div>
        </div>
        <div className="space-y-2 p-4">
          <div className="skeleton-shimmer h-11 rounded-full" />
          <div className="skeleton-shimmer h-20 rounded-xl" />
          <div className="skeleton-shimmer h-11 rounded-xl" />
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

  const ringColor = d.accentColor ?? accentColorHint ?? "#c8ff3d";
  const joinDate = d.createdAt
    ? new Date(d.createdAt).toLocaleDateString([], { month: "long", year: "numeric" })
    : null;

  // The card shows only the badge worn beside the name, and only when it is
  // one of the four name-row marks; the full collection lives on /badges.
  const computedBadges: CardBadge[] = profileBadgeLineup(distinctBadges(canonBadges(d.badges)));
  const featuredBadgeMeta = computedBadges.find((badge) => badge.slug === d.featuredBadge) ?? null;

  const realmRoleValue = realmRow.data?.role ?? realmRole ?? null;
  const realmRoleMeta = realmRoleValue
    ? REALM_ROLE_META[realmRoleValue] ?? { label: realmRoleValue, color: "#c8ff3d" }
    : null;
  const realmJoinedAt = realmRow.data?.joined_at
    ? new Date(realmRow.data.joined_at).toLocaleDateString([], { month: "long", year: "numeric" })
    : null;
  const cardBanner = getBanner({
    banner_url: d.bannerUrl,
    banner_mode: d.bannerMode,
    banner_gradient: d.bannerGradient,
    updated_at: d.updatedAt,
  });

  const hasStatus = customStatus && (customStatus.emoji || customStatus.text);
  const statusPill = hasStatus ? (
    <StatusPill
      emoji={customStatus.emoji}
      text={customStatus.text}
      expiresAt={presenceRow?.custom_status_expires_at ?? null}
      onActivate={isSelf ? onEditStatus : undefined}
      className="mt-1.5"
    />
  ) : isSelf && onEditStatus ? (
    <StatusPill emptyLabel="+ Set status" onActivate={onEditStatus} className="mt-1.5" />
  ) : null;

  // Plain bio segments get line breaks (pre-wrap) and live mentions.
  const renderBioPlain = (text: string) => (
    <>
      {text.split(/(@[a-zA-Z0-9][a-zA-Z0-9_.-]{0,30})/g).map((part, index) =>
        part.startsWith("@") && part.length > 1 ? (
          <Link
            key={`mention-${index}`}
            to="/u/$username"
            params={{ username: part.slice(1) }}
            className="mention-highlight"
            onClick={() => close()}
          >
            {part}
          </Link>
        ) : (
          <Fragment key={`plain-${index}`}>{part}</Fragment>
        ),
      )}
    </>
  );

  return (
    <div
      style={cardBanner.profileBackground ? { background: cardBanner.profileBackground } : undefined}
      onTouchStart={(e) => { dragStart.current = e.touches[0]?.clientY ?? null; }}
      onTouchEnd={(e) => {
        if (dragStart.current === null) return;
        const end = e.changedTouches[0]?.clientY ?? dragStart.current;
        if (end - dragStart.current > 90) close();
        dragStart.current = null;
      }}
    >
      <ProfileHeader
        user={{
          id: d.id,
          username: d.username,
          displayName: d.displayName,
          avatarUrl: d.avatarUrl ?? avatarUrlHint,
          bannerUrl: d.bannerUrl,
          bannerMode: d.bannerMode,
          bannerGradient: d.bannerGradient,
          updatedAt: d.updatedAt,
          accentColor: ringColor,
          verified: d.verified,
          reducedMotion: d.reducedMotion,
        }}
        status={status}
        statusIsSelf={Boolean(isSelf)}
        customStatus={customStatus}
        statusLine={
          statusPill || d.blockedByViewer ? (
            <>
              {statusPill}
              {d.blockedByViewer && (
                <span className="mt-1.5 inline-flex rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-muted-foreground">
                  You blocked this account
                </span>
              )}
            </>
          ) : undefined
        }
        handleExtra={
          d.pronouns || realmRoleMeta ? (
            <>
              {d.pronouns && <span className="truncate text-sm text-muted-foreground">· {d.pronouns}</span>}
              {realmRoleMeta && (
                <span
                  className="inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-[11px] font-bold uppercase tracking-wider"
                  style={{
                    borderColor: `${realmRoleMeta.color}55`,
                    background: `${realmRoleMeta.color}14`,
                    color: realmRoleMeta.color,
                  }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: realmRoleMeta.color }} aria-hidden="true" />
                  {realmRoleMeta.label}
                </span>
              )}
            </>
          ) : undefined
        }
        featuredBadge={
          purify.active ? (
            <AnimatedBadge badge={PURIFY_BADGE} size={24} />
          ) : featuredBadgeMeta ? (
            <Badge
              slug={featuredBadgeMeta.slug}
              size={24}
              title={`Featured badge: ${canonicalFor(featuredBadgeMeta.slug)?.name ?? featuredBadgeMeta.name}`}
            />
          ) : undefined
        }
        avatarRing={ringColor}
        avatarDecoration={worn.data?.avatar_decoration?.slug ?? null}
        profileEffect={worn.data?.profile_effect?.slug ?? null}
        effectOnce
        overlayActions={
          <>
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
          </>
        }
        surface={cardBanner.profileBackground ? cardBanner.surface : "#141416"}
        gutter="16px"
      />

      <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
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
            {/* Inner panel: the bio, then the two dates people actually look for.
                The realm role lives up by the handle so it is not repeated here. */}
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
              {d.bio ? (
                <>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">About me</p>
                  <div className={`mt-1 whitespace-pre-wrap text-sm font-normal leading-relaxed text-foreground/90 ${bioExpanded ? "" : "line-clamp-3"}`}>
                    <MarkdownText text={d.bio} renderPlainText={renderBioPlain} />
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
              {(joinDate || realmJoinedAt) && (
                <div className="mt-3.5 grid grid-cols-2 gap-3 border-t border-white/[0.07] pt-3">
                  {joinDate && (
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Member since</p>
                      <p className="mt-1 flex items-center gap-1.5 truncate text-sm font-medium text-[#f2efe6]">
                        <img src="/brand/rizz-cat-logo.svg" alt="" aria-hidden className="h-3.5 w-3.5 shrink-0" />
                        {joinDate}
                      </p>
                    </div>
                  )}
                  {realmJoinedAt && (
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">In this realm</p>
                      <p className="mt-1 truncate text-sm font-medium text-[#f2efe6]">Joined {realmJoinedAt}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Stats — the same Activity block the full profile and popup use. */}
            <div className="mt-3.5 flex items-center justify-between">
              <p className="text-[12px] font-bold uppercase tracking-wide text-foreground">Activity</p>
              <span className="text-[10px] text-muted-foreground">Lifetime</span>
            </div>
            <div className="mt-1.5 grid grid-cols-4 gap-1 rounded-2xl border border-white/10 bg-white/[0.035] p-1 text-center">
              <div className="rounded-xl py-2">
                <p className="truncate font-display text-base font-bold tabular-nums text-[#c8ff3d]">{formatCount(d.pawBalance)}</p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Paws</p>
              </div>
              <div className="rounded-xl py-2">
                <p className="truncate font-display text-base font-bold tabular-nums text-foreground">
                  {d.rank != null ? `#${d.rank}` : "—"}
                  {d.rank != null && d.rank <= 10 && (
                    <Trophy aria-hidden="true" className="ml-0.5 inline h-3.5 w-3.5 -translate-y-px text-[#c8ff3d]" />
                  )}
                </p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Rank</p>
              </div>
              <button
                type="button"
                onClick={() => setListMode("followers")}
                aria-label={`See ${d.followers} followers`}
                className="min-h-11 rounded-xl py-2 transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#c8ff3d]"
              >
                <p className="truncate font-display text-base font-bold tabular-nums text-foreground">{formatCount(d.followers)}</p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Followers</p>
              </button>
              <button
                type="button"
                onClick={() => setListMode("following")}
                aria-label={`See ${d.following} following`}
                className="min-h-11 rounded-xl py-2 transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#c8ff3d]"
              >
                <p className="truncate font-display text-base font-bold tabular-nums text-foreground">{formatCount(d.following)}</p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Following</p>
              </button>
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
                <Button
                  asChild
                  variant="outline"
                  className="h-11 flex-1 border-[#c8ff3d]/40 bg-[#c8ff3d]/10 text-[#c8ff3d] hover:bg-[#c8ff3d]/20 hover:text-[#c8ff3d]"
                >
                  <Link to="/settings/profile" onClick={() => close()}>
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
            <Button
              asChild
              variant="outline"
              className="mt-2 h-11 w-full justify-between border-white/10 bg-white/[0.03] text-[#f2efe6] hover:bg-white/[0.07]"
            >
              <Link to="/u/$username" params={{ username: d.username }} onClick={() => close()}>
                View full profile
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </Button>
          </>
        )}
      </div>

      {/* Followers / following sheet */}
      <Dialog open={listMode !== null} onOpenChange={(open) => { if (!open) setListMode(null); }}>
        <DialogContent
          hideClose
          className="left-0 right-0 top-auto bottom-0 max-h-[76dvh] w-full translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-b-none rounded-t-3xl border-white/10 bg-[#141416] p-0 sm:left-1/2 sm:right-auto sm:top-1/2 sm:bottom-auto sm:w-[340px] sm:max-w-[340px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
        >
          <DialogTitle className="sr-only">{listMode === "followers" ? "Followers" : "Following"}</DialogTitle>
          <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-white/25 sm:hidden" aria-hidden="true" />
          <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-base font-bold text-[#f2efe6]">
                {listMode === "followers" ? "Followers" : "Following"}
              </h3>
              <CloseButton aria-label="Close list" onClick={() => setListMode(null)} />
            </div>
            {listQuery.isLoading ? (
              <div className="mt-3 space-y-2" aria-busy="true">
                {[0, 1, 2, 3].map((row) => (
                  <div key={row} className="h-14 animate-pulse rounded-2xl bg-white/5" />
                ))}
              </div>
            ) : listQuery.isError ? (
              <p role="alert" className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center text-sm text-muted-foreground">
                Couldn&apos;t load this list. Try again in a moment.
              </p>
            ) : (listQuery.data ?? []).length === 0 ? (
              <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center text-sm text-muted-foreground">
                {listMode === "followers" ? "No followers yet." : "Not following anyone yet."}
              </p>
            ) : (
              <ul className="mt-2 space-y-1">
                {(listQuery.data ?? []).map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setListMode(null);
                        close();
                        void nav({ to: "/u/$username", params: { username: row.username ?? row.id } });
                      }}
                      className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff3d]"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={row.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-[#1c1c1f] text-sm font-bold text-[#f2efe6]">
                          {(row.display_name || row.username || "?").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[#f2efe6]">
                          {row.display_name || row.username || "Member"}
                        </span>
                        {row.username && <span className="block truncate text-xs text-muted-foreground">@{row.username}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
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
  onEditStatus,
}: {
  user: ProfileCardUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMention?: (username: string) => void;
  onCall?: (userId: string) => void;
  onEditStatus?: () => void;
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
        className="left-0 right-0 top-auto bottom-0 max-h-[90dvh] w-full translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-b-none rounded-t-3xl border-white/10 bg-[#141416] p-0 sm:left-1/2 sm:right-auto sm:top-1/2 sm:bottom-auto sm:w-[400px] sm:max-w-[400px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
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
            realmId={user.realmId}
            accentColor={user.accentColor}
            onMention={onMention}
            onCall={onCall}
            onOpenChange={handleChange}
            onEditStatus={onEditStatus}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
