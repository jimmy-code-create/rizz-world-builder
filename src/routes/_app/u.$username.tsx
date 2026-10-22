import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatNumber, relativeTime } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/PostCard";
import { fetchUserPosts } from "@/lib/posts";
import { fetchUserBadges } from "@/lib/badges";
import { ProfileBadgesSection } from "@/components/profile/ProfileBadgesSection";
import { AnimatedBadge } from "@/components/profile/AnimatedBadge";
import { profileBadgeLineup } from "@/lib/badges";
import { usePurify, withPurifyBadge } from "@/lib/purify";
import { canonBadges, distinctBadges } from "@/lib/badge-set";
import type { Badge as BadgeType } from "@/lib/badges";
import { AnimatePresence, motion } from "framer-motion";
import {
  Award,
  Film,
  Hash,
  Heart,
  MessageCircle,
  MoreHorizontal,
  PawPrint,
  Share2,
  Smile,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { FollowListDialog } from "@/components/social/FollowListDialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { blockUser, isBlocked, unblockUser } from "@/lib/social";
import { StatusPill } from "@/components/presence/StatusDot";
import { PresenceSheet } from "@/components/presence/PresenceSheet";
import { publicCustomStatus, publicStatusOf, statusLabel, usePresence } from "@/lib/presence";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { getBanner } from "@/lib/banner";
import { CustomEmoji } from "@/components/CustomEmoji";
import { TUTORIAL_INTERESTS } from "@/lib/emoji.js";
import { cn } from "@/lib/utils";
import { MarkdownText } from "@/components/MarkdownText";
import { renderCaptionWithTags } from "@/lib/hashtags";

export const Route = createFileRoute("/_app/u/$username")({
  head: ({ params }) => ({ meta: [{ title: `@${params.username} · RIZZ` }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { username } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [listOpen, setListOpen] = useState<null | "followers" | "following">(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [activity, setActivity] = useState<ActivityTab>("posts");
  const purify = usePurify();

  const profileQ = useQuery({
    queryKey: ["profile", username],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data;
    },
  });

  const profile = profileQ.data;
  const isMe = profile && user?.id === profile.id;
  // Presence for this profile: invisible accounts read as offline to others.
  const presenceRow = usePresence(profile?.id);
  const presenceStatus = publicStatusOf(presenceRow, Boolean(isMe));
  const customStatus = publicCustomStatus(presenceRow, Boolean(isMe));
  const blockStatusKey = ["block-status", user?.id, profile?.id];
  const blockStatus = useQuery({
    queryKey: blockStatusKey,
    queryFn: () => isBlocked(user!.id, profile!.id),
    enabled: !!user && !!profile && !isMe,
  });

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const [{ count: fol }, { count: ing }] = await Promise.all([
        supabase
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("following_id", profile.id),
        supabase
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("follower_id", profile.id),
      ]);
      setFollowerCount(fol ?? 0);
      setFollowingCount(ing ?? 0);
      if (user && !isMe) {
        const { data } = await supabase
          .from("follows")
          .select("follower_id")
          .eq("follower_id", user.id)
          .eq("following_id", profile.id)
          .maybeSingle();
        setIsFollowing(!!data);
      }
    })();
  }, [profile, user, isMe]);

  // Re-render the moment a custom status expires: realtime only fires on row
  // changes, and an expiry passing is silent.
  const statusExpiresAt =
    (presenceRow as { custom_status_expires_at?: string | null } | null)
      ?.custom_status_expires_at ?? null;
  useEffect(() => {
    if (!statusExpiresAt || !profile) return;
    const ms = new Date(statusExpiresAt).getTime() - Date.now();
    if (ms <= 0) {
      void qc.invalidateQueries({ queryKey: ["presence-user", profile.id] });
      return;
    }
    const t = window.setTimeout(
      () => void qc.invalidateQueries({ queryKey: ["presence-user", profile.id] }),
      Math.min(ms + 500, 2_147_483_647),
    );
    return () => window.clearTimeout(t);
  }, [statusExpiresAt, profile, qc]);

  const posts = useQuery({
    queryKey: ["user-posts", profile?.id],
    queryFn: () => fetchUserPosts(profile!.id),
    enabled: !!profile,
  });

  const badges = useQuery({
    queryKey: ["badges", profile?.id],
    queryFn: () => fetchUserBadges(profile!.id),
    enabled: !!profile,
  });

  const reelsQ = useQuery({
    queryKey: ["user-reels", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("posts")
        .select("*")
        .eq("author_id", profile!.id)
        .eq("media_type", "video")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!profile,
  });

  const realmsQ = useQuery({
    queryKey: ["user-realms", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("realms")
        .select("id,name,slug,topic,accent_color,member_count,icon_url,created_at")
        .eq("owner_id", profile!.id)
        .order("member_count", { ascending: false });
      return data ?? [];
    },
    enabled: !!profile,
  });

  const groupsQ = useQuery({
    queryKey: ["user-groups", profile?.id],
    queryFn: async () => {
    const { data: mem } = await supabase
      .from("group_members")
      .select("group_id, joined_at")
      .eq("user_id", profile!.id);
    const ids = (mem ?? []).map((m) => m.group_id);
    if (!ids.length) return [];
    const joinedAt = new Map((mem ?? []).map((m) => [m.group_id, m.joined_at]));
    const { data } = await supabase
      .from("groups")
      .select("id,name,slug,topic,accent_color,member_count,icon_url")
      .in("id", ids)
      .order("member_count", { ascending: false });
    return (data ?? []).map((group) => ({
      ...group,
      joined_at: joinedAt.get(group.id) ?? null,
    }));
    },
    enabled: !!profile,
  });

  const pawLedger = useQuery({
    queryKey: ["paw-ledger", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("paw_transactions")
        .select("id, amount, kind, description, created_at")
        .eq("user_id", profile!.id)
        .order("created_at", { ascending: false })
        .limit(12);
      return data ?? [];
    },
    enabled: !!profile && !!isMe,
  });

  // Lifetime activity: the numbers the Activity tab shows. Likes, comments and
  // reactions are the ones received on this member's posts, so they come
  // straight off rows the profile already loads — no extra round trips.
  const lifetime = useMemo(() => {
    const list = posts.data ?? [];
    const sum = (key: "like_count" | "comment_count" | "reaction_count") =>
      list.reduce((total, post) => total + (Number(post[key]) || 0), 0);
    return [
      { id: "posts", label: "Posts", value: list.length, icon: Hash },
      { id: "likes", label: "Likes", value: sum("like_count"), icon: Heart },
      { id: "comments", label: "Comments", value: sum("comment_count"), icon: MessageCircle },
      { id: "reactions", label: "Reactions", value: sum("reaction_count"), icon: Smile },
      { id: "followers", label: "Followers", value: followerCount, icon: Users },
      { id: "following", label: "Following", value: followingCount, icon: UserPlus },
      { id: "badges", label: "Badges", value: badges.data?.length ?? 0, icon: Award },
      { id: "paws", label: "Paws", value: Number(profile?.paw_balance ?? 0), icon: PawPrint },
    ];
  }, [posts.data, followerCount, followingCount, badges.data, profile?.paw_balance]);

  /** Every activity number is a door: followers lists, the gallery, the Paws page. */
  const openActivity = (id: string) => {
    if (id === "followers" || id === "following") {
      setListOpen(id);
      return;
    }
    if (id === "badges") {
      nav({ to: "/badges" });
      return;
    }
    if (id === "paws") {
      nav({ to: "/drops" });
      return;
    }
    setActivity("posts");
    document.getElementById("activity-grid")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // Recent activity: posts, reels, realms they made and communities they joined,
  // newest first.
  const recentActivity = useMemo(() => {
    const items: {
      id: string;
      kind: "post" | "reel" | "realm" | "group";
      title: string;
      detail?: string;
      at: string;
    }[] = [];
    for (const post of posts.data ?? []) {
      const detail = post.caption?.replace(/\s+/g, " ").trim();
      items.push({
        id: `post-${post.id}`,
        kind: post.media_type === "video" ? "reel" : "post",
        title: post.media_type === "video" ? "Posted a reel" : "Shared a post",
        detail: detail ? (detail.length > 72 ? `${detail.slice(0, 71)}…` : detail) : undefined,
        at: post.created_at,
      });
    }
    for (const realm of realmsQ.data ?? []) {
      items.push({
        id: `realm-${realm.id}`,
        kind: "realm",
        title: "Created a realm",
        detail: realm.name,
        at: realm.created_at,
      });
    }
    for (const group of groupsQ.data ?? []) {
      if (!group.joined_at) continue;
      items.push({
        id: `group-${group.id}`,
        kind: "group",
        title: "Joined a community",
        detail: group.name,
        at: group.joined_at,
      });
    }
    return items
      .filter((item) => !Number.isNaN(new Date(item.at).getTime()))
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 8);
  }, [posts.data, realmsQ.data, groupsQ.data]);

  const shareProfile = async () => {
    const profileUsername = profile!.username ?? username;
    const url = `${window.location.origin}/u/${profileUsername}`;
    const shareData = {
      title: `@${profileUsername} on RIZZ`,
      text: profile!.bio || `Check out @${profileUsername} on RIZZ`,
      url,
    };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Profile link copied");
      }
    } catch {
      /* The share sheet was dismissed — nothing to report. */
    }
  };

  const followMut = useMutation({
    mutationFn: async () => {
      if (!user || !profile) return;
      if (isFollowing) {
        await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", profile.id);
        setFollowerCount((c) => c - 1);
        setIsFollowing(false);
      } else {
        await supabase.from("follows").insert({ follower_id: user.id, following_id: profile.id });
        setFollowerCount((c) => c + 1);
        setIsFollowing(true);
      }
    },
    onError: (e: Error) => toast.error(e.message),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile", username] }),
  });

  const blockMut = useMutation({
    mutationFn: async (nextBlocked: boolean) => {
      if (!user || !profile) throw new Error("Sign in to manage blocked accounts.");
      if (nextBlocked) await blockUser(user.id, profile.id);
      else await unblockUser(user.id, profile.id);
      return nextBlocked;
    },
    onMutate: async (nextBlocked) => {
      await qc.cancelQueries({ queryKey: blockStatusKey });
      const previous = qc.getQueryData<boolean>(blockStatusKey);
      qc.setQueryData(blockStatusKey, nextBlocked);
      return { previous };
    },
    onError: (error: Error, _nextBlocked, context) => {
      if (context?.previous !== undefined) qc.setQueryData(blockStatusKey, context.previous);
      toast.error(error.message || "Couldn't update this block");
    },
    onSuccess: (blocked) => toast.success(blocked ? "User blocked" : "User unblocked"),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: blockStatusKey });
    },
  });

  if (profileQ.isLoading) {
    return <div className="h-64 animate-pulse rounded-3xl glass" />;
  }
  if (profileQ.isError) {
    return (
      <div className="py-20 text-center">
        <h1 className="font-display text-2xl font-bold">Profile couldn’t load</h1>
        <p className="mt-2 text-sm text-muted-foreground">Check your connection and try again.</p>
        <Button
          variant="outline"
          className="mt-5 glass border-white/10"
          onClick={() => profileQ.refetch()}
        >
          Try again
        </Button>
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="text-center py-20">
        <h1 className="font-display text-2xl font-bold">Profile not found</h1>
        <p className="text-muted-foreground mt-2">@{username} doesn't exist on RIZZ.</p>
      </div>
    );
  }

  const accent = profile.accent_color || "var(--brand-signal)";
  // Only a badge this member actually earned can sit beside their name.
  const featuredBadge = badges.data?.find((b) => b.slug === profile.featured_badge) ?? null;
  const verified = Boolean(badges.data?.some((b) => b.slug === "verified" || b.slug === "no-cap"));
  const profileUsername = profile.username ?? username;
  const joined = new Date(profile.created_at).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
  const pageBanner = getBanner({
    banner_url: profile.banner_url,
    banner_mode: profile.banner_mode,
    banner_gradient: profile.banner_gradient,
    updated_at: profile.updated_at,
  });
  // With no gradient the header keeps the app surface; with one it melts into
  // the darkened profile theme.
  const profileSurface = pageBanner.profileBackground ? pageBanner.surface : "var(--background)";
  // Every earned mark can be tapped; the worn one keeps its ring.
  // Only the five profile marks survive, in a fixed order; Purify is injected
  // for subscribers so the subscriber badge always has its slot.
  const nameBadges = profileBadgeLineup(
    withPurifyBadge(distinctBadges(canonBadges(badges.data ?? [])), purify.active),
  );

  const headerActions = (
    <>
      {isMe ? (
        <>
          <Link to="/settings/profile">
            <Button className="h-9 border-0 bg-primary px-3.5 text-[12.5px] font-bold text-primary-foreground shadow-[0_10px_24px_-16px_var(--brand-signal)] hover:bg-primary/90">
              Edit profile
            </Button>
          </Link>
          <Button
            variant="outline"
            size="icon"
            aria-label="Share profile"
            className="h-9 w-9 border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"
            onClick={() => void shareProfile()}
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </>
      ) : user ? (
        <>
          {!blockStatus.data && (
            <Button
              className="h-9 gap-1.5 border-0 bg-primary px-3 text-[12.5px] font-bold text-primary-foreground shadow-[0_10px_24px_-16px_var(--brand-signal)] hover:bg-primary/90"
              onClick={() => nav({ to: "/dm/$userId", params: { userId: profile.id } })}
            >
              <MessageCircle className="h-4 w-4" /> Message
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => followMut.mutate()}
            disabled={followMut.isPending}
            className={cn(
              "h-9 px-3 text-[12.5px] font-bold",
              isFollowing
                ? "border-white/10 bg-white/[0.06] text-foreground hover:bg-white/[0.1]"
                : "border-white/15 bg-transparent text-foreground hover:bg-white/[0.06]",
            )}
          >
            {isFollowing ? "Following" : "Follow"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label="More profile options"
                className="h-9 w-9 border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => void shareProfile()}>
                <Share2 className="mr-2 h-4 w-4" /> Share profile
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => blockMut.mutate(!blockStatus.data)}
                className={blockStatus.data ? "text-primary" : "text-destructive"}
              >
                {blockStatus.data ? "Unblock" : "Block"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : (
        <Button
          variant="outline"
          size="icon"
          aria-label="Share profile"
          className="h-9 w-9 border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"
          onClick={() => void shareProfile()}
        >
          <Share2 className="h-4 w-4" />
        </Button>
      )}
    </>
  );

  return (
    <div
      className="relative isolate -mx-3 min-h-[70vh] px-3 sm:-mx-4 sm:px-4 lg:-mx-6 lg:px-6"
      style={
        pageBanner.profileBackground ? { background: pageBanner.profileBackground } : undefined
      }
    >
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative z-0">
        <ProfileHeader
          user={{
            id: profile.id,
            username: profileUsername,
            displayName: profile.display_name,
            avatarUrl: profile.avatar_url,
            bannerUrl: profile.banner_url,
            bannerMode: profile.banner_mode,
            bannerGradient: profile.banner_gradient,
            updatedAt: profile.updated_at,
            accentColor: profile.accent_color,
            verified,
            reducedMotion: Boolean(profile.reduced_motion),
          }}
          status={presenceStatus}
          statusIsSelf={Boolean(isMe)}
          customStatus={customStatus}
          statusLine={
            <>
              {!isMe && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {statusLabel(presenceStatus)}
                </p>
              )}
              {customStatus && (customStatus.emoji || customStatus.text) ? (
                <StatusPill
                  emoji={customStatus.emoji}
                  text={customStatus.text}
                  expiresAt={presenceRow?.custom_status_expires_at ?? null}
                  onActivate={isMe ? () => setStatusOpen(true) : undefined}
                  className="mt-1.5"
                />
              ) : isMe ? (
                <StatusPill
                  emptyLabel="+ Set status"
                  onActivate={() => setStatusOpen(true)}
                  className="mt-1.5"
                />
              ) : null}
            </>
          }
          handleExtra={
            <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <img
                src="/brand/rizz-cat-logo.svg"
                alt=""
                aria-hidden
                className="h-3.5 w-3.5 shrink-0"
              />
              Joined {joined}
            </span>
          }
          featuredBadge={
            nameBadges.length > 0 ? (
              <span className="flex items-center gap-1" aria-label="Badges">
                {nameBadges.map((badge) => (
                  <button
                    key={badge.slug}
                    type="button"
                    onClick={() => nav({ to: "/badges" })}
                    aria-label={`${badge.name} badge — open the badge gallery`}
                    className={`rounded-full transition-transform active:scale-95 ${
                      badge.slug === featuredBadge?.slug ? "ring-1 ring-primary/70" : ""
                    }`}
                  >
                    <AnimatedBadge badge={badge} size={20} />
                  </button>
                ))}
              </span>
            ) : undefined
          }
          avatarRing={profileSurface}
          surface={profileSurface}
          gutter="clamp(4px, 1.2vw, 8px)"
        />
      </motion.div>

      <div className="relative z-20">
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2 px-1 md:px-2">
          {headerActions}
        </div>

        <div className="mt-3 grid grid-cols-4 divide-x divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03] backdrop-blur-sm">
          <StatCell
            label="Posts"
            value={formatNumber(posts.data?.length ?? 0)}
            onClick={() => openActivity("posts")}
          />
          <StatCell
            label="Followers"
            value={formatNumber(followerCount)}
            onClick={() => setListOpen("followers")}
          />
          <StatCell
            label="Following"
            value={formatNumber(followingCount)}
            onClick={() => setListOpen("following")}
          />
          <button
            type="button"
            onClick={() => nav({ to: "/drops" })}
            className="px-3 py-2.5 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
          >
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80">
              Paws
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-sm font-bold tabular-nums text-primary">
              <PawPrint className="h-3 w-3 shrink-0" />
              {formatNumber(profile.paw_balance ?? 0)}
            </p>
          </button>
        </div>

        {(profile.bio || profile.interests?.length > 0) && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 backdrop-blur-sm"
            aria-label="About me"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                About me
              </h2>
              {isMe && (
                <Link
                  to="/settings/profile"
                  className="text-[11px] font-semibold text-muted-foreground transition-colors hover:text-primary"
                >
                  Edit
                </Link>
              )}
            </div>
            {profile.bio ? (
              <div className="mt-2 text-[14px] leading-relaxed text-foreground/90">
                <MarkdownText
                  text={profile.bio}
                  renderPlainText={(plain) =>
                    renderCaptionWithTags(plain).map((p, i) => {
                      if (p.tag) {
                        return (
                          <Link
                            key={i}
                            to="/tag/$tag"
                            params={{ tag: p.tag }}
                            className="font-medium text-primary hover:underline"
                          >
                            {p.text}
                          </Link>
                        );
                      }
                      if (p.mention) {
                        return (
                          <Link
                            key={i}
                            to="/u/$username"
                            params={{ username: p.mention }}
                            className="mention-highlight font-medium hover:underline"
                          >
                            {p.text}
                          </Link>
                        );
                      }
                      if (p.url) {
                        return (
                          <a
                            key={i}
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="break-all text-sky-400 hover:underline"
                          >
                            {p.text}
                          </a>
                        );
                      }
                      return <span key={i}>{p.text}</span>;
                    })
                  }
                />
              </div>
            ) : (
              <p className="mt-2 text-[13px] italic text-muted-foreground">
                No bio yet — tap Edit to introduce yourself.
              </p>
            )}

            {profile.interests?.length > 0 && (
              <div className="mt-3.5 flex flex-wrap gap-1.5" aria-label="Profile interests">
                {[...new Set(profile.interests as string[])].map((interest) => {
                  const option = TUTORIAL_INTERESTS.find((item) => item.id === interest);
                  return (
                    <span
                      key={interest}
                      className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.07] px-2.5 py-1 text-[11px] font-semibold text-foreground/90"
                    >
                      {option && <CustomEmoji name={option.emoji} className="h-3.5 w-3.5" />}
                      {interest}
                    </span>
                  );
                })}
              </div>
            )}
          </motion.section>
        )}

        <ProfileBadgesSection
          profileId={profile.id}
          isOwner={Boolean(isMe)}
          stored={profile.badges}
          earned={badges.data ?? []}
          loading={badges.isLoading}
          viewerId={user?.id ?? null}
          featuredSlug={profile.featured_badge}
        />

        <Tabs defaultValue="main" className="mt-4">
          <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b border-white/[0.07] bg-transparent p-0">
            {[
              { value: "main", label: "Main" },
              { value: "activity", label: "Activity" },
              { value: "paws", label: "Paws" },
            ].map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="relative h-11 rounded-none border-b-2 border-transparent bg-transparent px-4 text-[13px] font-bold text-muted-foreground shadow-none transition-colors after:absolute after:inset-x-3 after:-bottom-[1px] after:h-[2px] after:rounded-full after:bg-primary after:opacity-0 after:transition-opacity after:duration-150 after:content-[''] hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:after:opacity-100"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="main" className="mt-4">
            <div
              className="mb-3 flex flex-wrap items-center gap-1.5"
              role="tablist"
              aria-label="Activity"
            >
              {(
                [
                  { id: "posts", label: "Posts", icon: Hash, count: posts.data?.length ?? null },
                  { id: "reels", label: "Reels", icon: Film, count: reelsQ.data?.length ?? null },
                  {
                    id: "realms",
                    label: "Realms",
                    icon: Hash,
                    count: realmsQ.data?.length ?? null,
                  },
                  {
                    id: "groups",
                    label: "Groups",
                    icon: Users,
                    count: groupsQ.data?.length ?? null,
                  },
                ] as const
              ).map((tab) => {
                const active = activity === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActivity(tab.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-bold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      active
                        ? "border-white/15 bg-white/[0.09] text-foreground"
                        : "border-white/[0.06] bg-transparent text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                    )}
                  >
                    <tab.icon className="h-3.5 w-3.5" />
                    {tab.label}
                    {tab.count !== null && (
                      <span className={cn("tabular-nums", active ? "text-primary" : "opacity-70")}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activity}
                initial={{ opacity: 0, scale: 0.995 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.995 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
              >
                {activity === "posts" && (
                  <div className="space-y-3">
                    {posts.isLoading ? (
                      <div className="h-40 animate-pulse rounded-2xl glass" />
                    ) : posts.data?.length === 0 ? (
                      <EmptyState
                        icon={<Hash className="h-5 w-5" />}
                        label="No posts yet"
                        hint={
                          isMe ? "Your first post is one tap away." : "Nothing shared here so far."
                        }
                      />
                    ) : (
                      posts.data?.map((p) => <PostCard key={p.id} post={p} />)
                    )}
                  </div>
                )}

                {activity === "reels" &&
                  (reelsQ.isLoading ? (
                    <div className="h-40 animate-pulse rounded-2xl glass" />
                  ) : reelsQ.data?.length === 0 ? (
                    <EmptyState icon={<Film className="h-5 w-5" />} label="No reels yet" />
                  ) : (
                    <div className="grid grid-cols-3 gap-1.5 md:gap-2">
                      {reelsQ.data?.map((r) => (
                        <Link
                          key={r.id}
                          to="/reels"
                          className="group relative aspect-[9/16] overflow-hidden rounded-xl glass"
                        >
                          <video
                            src={r.media_url ?? undefined}
                            className="h-full w-full object-cover"
                            muted
                            playsInline
                            preload="metadata"
                          />
                          <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                            <div className="flex items-center gap-1 text-xs">
                              <Heart className="h-3 w-3" />
                              {r.like_count}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ))}

                {activity === "realms" &&
                  (realmsQ.isLoading ? (
                    <div className="h-24 animate-pulse rounded-2xl glass" />
                  ) : realmsQ.data?.length === 0 ? (
                    <EmptyState icon={<Hash className="h-5 w-5" />} label="No realms owned" />
                  ) : (
                    <div className="space-y-2">
                      {realmsQ.data?.map((c) => (
                        <Link
                          key={c.id}
                          to="/r/$slug"
                          params={{ slug: c.slug }}
                          className="block min-h-[56px] rounded-xl glass p-3 transition-colors hover:bg-white/5"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="flex h-10 w-10 items-center justify-center rounded-xl font-bold"
                              style={{
                                background: `linear-gradient(135deg, ${c.accent_color || accent}, var(--brand-paper-dim))`,
                              }}
                            >
                              #
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold">{c.name}</div>
                              {c.topic && (
                                <div className="truncate text-xs text-muted-foreground">
                                  {c.topic}
                                </div>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {c.member_count} members
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ))}

                {activity === "groups" &&
                  (groupsQ.isLoading ? (
                    <div className="h-24 animate-pulse rounded-2xl glass" />
                  ) : groupsQ.data?.length === 0 ? (
                    <EmptyState
                      icon={<Users className="h-5 w-5" />}
                      label="Not in any groups yet"
                    />
                  ) : (
                    <div className="space-y-2">
                      {groupsQ.data?.map((g) => (
                        <Link
                          key={g.id}
                          to="/g/$id"
                          params={{ id: g.id }}
                          className="block min-h-[56px] rounded-xl glass p-3 transition-colors hover:bg-white/5"
                        >
                          <div className="flex items-center gap-3">
                            {g.icon_url ? (
                              <img
                                src={g.icon_url}
                                width={40}
                                height={40}
                                loading="lazy"
                                decoding="async"
                                className="h-10 w-10 rounded-xl object-cover"
                                alt=""
                              />
                            ) : (
                              <div
                                className="flex h-10 w-10 items-center justify-center rounded-xl font-bold"
                                style={{
                                  background: `linear-gradient(135deg, ${g.accent_color || accent}, var(--brand-paper-dim))`,
                                }}
                              >
                                {g.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold">{g.name}</div>
                              {g.topic && (
                                <div className="truncate text-xs text-muted-foreground">
                                  {g.topic}
                                </div>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">{g.member_count}</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ))}
              </motion.div>
            </AnimatePresence>
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            <section
              aria-label="Lifetime activity"
              className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 backdrop-blur-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Lifetime activity
                </h2>
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
                  All time
                </span>
              </div>
              <div id="activity-grid" className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {lifetime.map(({ id, label, value, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => openActivity(id)}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3 text-left transition-colors hover:border-white/15 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <span className="grid h-7 w-7 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <p className="mt-2 font-display text-lg font-bold leading-none tabular-nums text-foreground">
                      {formatNumber(value)}
                    </p>
                    <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {label}
                    </p>
                  </button>
                ))}
              </div>
            </section>

            <section
              aria-label="Recent activity"
              className="mt-3 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03] backdrop-blur-sm"
            >
              <div className="flex items-center justify-between gap-3 px-4 pt-3.5">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Recent activity
                </h2>
                {recentActivity.length > 0 && (
                  <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                    Latest {relativeTime(recentActivity[0].at).text}
                  </span>
                )}
              </div>
              {recentActivity.length === 0 ? (
                <p className="px-4 py-4 text-[13px] text-muted-foreground">
                  {isMe
                    ? "Nothing yet — your first post starts the trail."
                    : "No public activity yet."}
                </p>
              ) : (
                <ul className="mt-1 divide-y divide-white/[0.05]">
                  {recentActivity.map((item) => {
                    const Icon =
                      item.kind === "reel" ? Film : item.kind === "group" ? Users : Hash;
                    const when = relativeTime(item.at);
                    return (
                      <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.04] text-muted-foreground">
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-foreground">
                            {item.title}
                          </span>
                          {item.detail && (
                            <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">
                              {item.detail}
                            </span>
                          )}
                        </span>
                        <time
                          dateTime={item.at}
                          title={when.fullDate}
                          className="shrink-0 text-[11px] tabular-nums text-muted-foreground"
                        >
                          {when.text}
                        </time>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </TabsContent>

          <TabsContent value="paws" className="mt-4">
            <PawsBreakdown
              balance={Number(profile.paw_balance ?? 0)}
              earned={Number(profile.paw_earned ?? profile.paw_balance ?? 0)}
              ledger={(pawLedger.data ?? []) as PawLedgerRow[]}
              loading={pawLedger.isLoading}
              isMe={Boolean(isMe)}
              accent={accent}
            />
          </TabsContent>
        </Tabs>



        {listOpen && (
          <FollowListDialog
            open={!!listOpen}
            onOpenChange={(v) => !v && setListOpen(null)}
            userId={profile.id}
            mode={listOpen}
          />
        )}
        {isMe && <PresenceSheet open={statusOpen} onOpenChange={setStatusOpen} />}
      </div>
    </div>
  );
}

function StatCell({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-bold tabular-nums text-foreground">{value}</p>
    </>
  );
  if (!onClick) return <div className="px-3 py-2.5">{content}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-2.5 text-left transition-colors hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
    >
      {content}
    </button>
  );
}

function EmptyState({ label, hint, icon }: { label: string; hint?: string; icon?: ReactNode }) {
  return (
    <div className="glass rounded-2xl border border-white/[0.06] p-10 text-center">
      {icon && (
        <span className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-muted-foreground">
          {icon}
        </span>
      )}
      <p className="text-sm font-semibold text-foreground">{label}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

type ActivityTab = "posts" | "reels" | "realms" | "groups";

type PawLedgerRow = {
  id: string;
  amount: number;
  kind: string;
  description: string | null;
  created_at: string;
};

export function PawsBreakdown({
  balance,
  earned,
  ledger,
  loading,
  isMe,
  accent,
}: {
  balance: number;
  earned: number;
  ledger: PawLedgerRow[];
  loading: boolean;
  isMe: boolean;
  accent: string;
}) {
  const spent = Math.max(earned - balance, 0);
  const stats = [
    { label: "Lifetime earned", value: earned, note: "Bounties and legacy transfers" },
    { label: "Spent", value: spent, note: "Effects and avatar decorations" },
  ];

  return (
    <div className="space-y-4">
      <div className="border border-border bg-card rounded-2xl p-6 text-center">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Paws balance</div>
        <div
          className="font-display text-5xl font-bold mt-2 flex items-center justify-center gap-2"
          style={{ color: accent }}
        >
          <PawPrint className="h-8 w-8" />
          {formatNumber(balance)}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {isMe ? "Your spendable Paws." : "Paws are earned by claiming bounties."}
        </p>
      </div>

      <div className="glass rounded-3xl p-5 grid gap-3 sm:grid-cols-2">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {stat.label}
            </p>
            <p className="font-display text-2xl font-bold mt-1">{formatNumber(stat.value)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{stat.note}</p>
          </div>
        ))}
      </div>

      {isMe && (
        <div className="glass rounded-3xl p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-sm font-bold">Recent Paws activity</h3>
            <PawPrint className="h-4 w-4 text-primary" />
          </div>
          {loading ? (
            <div className="mt-3 h-20 animate-pulse rounded-2xl bg-white/5" />
          ) : ledger.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No Paws activity yet. Claim a bounty to start earning.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-white/5">
              {ledger.slice(0, 8).map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {row.description || (row.amount > 0 ? "Paws earned" : "Paws spent")}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(row.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 font-display font-bold tabular-nums ${
                      row.amount > 0 ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {row.amount > 0 ? "+" : ""}
                    {formatNumber(row.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Link
          to="/drops"
          className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground"
        >
          <PawPrint className="h-4 w-4" /> Earn Paws
        </Link>
      </div>
    </div>
  );
}
