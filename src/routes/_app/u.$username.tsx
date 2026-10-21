import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatNumber } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/PostCard";
import { fetchUserPosts } from "@/lib/posts";
import { fetchUserBadges } from "@/lib/badges";
import { ProfileBadgesSection } from "@/components/profile/ProfileBadgesSection";
import { Badge as BadgeMark } from "@/components/Badge";
import { motion } from "framer-motion";
import { Calendar, MessageCircle, Share2, Hash, Users, Film, Heart, PawPrint } from "lucide-react";
import { toast } from "@/lib/toast";
import { FollowListDialog } from "@/components/social/FollowListDialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { blockUser, isBlocked, unblockUser } from "@/lib/social";
import { StatusPill } from "@/components/presence/StatusDot";
import { PresenceSheet } from "@/components/presence/PresenceSheet";
import { publicCustomStatus, publicStatusOf, statusLabel, usePresence } from "@/lib/presence";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { useEquipped } from "@/lib/useEquipped";
import { CustomEmoji } from "@/components/CustomEmoji";
import { TUTORIAL_INTERESTS } from "@/lib/emoji.js";
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
  const equippedQ = useEquipped(profile?.id);
  const eq = equippedQ.data;
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
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profile.id),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profile.id),
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
    (presenceRow as { custom_status_expires_at?: string | null } | null)?.custom_status_expires_at ?? null;
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
        .select("id,name,slug,topic,accent_color,member_count,icon_url")
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
        .select("group_id")
        .eq("user_id", profile!.id);
      const ids = (mem ?? []).map((m) => m.group_id);
      if (!ids.length) return [];
      const { data } = await supabase
        .from("groups")
        .select("id,name,slug,topic,accent_color,member_count,icon_url")
        .in("id", ids)
        .order("member_count", { ascending: false });
      return data ?? [];
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

  const shareProfile = async () => {
    const profileUsername = profile!.username ?? username;
    const url = `${window.location.origin}/u/${profileUsername}`;
    const shareData = { title: `@${profileUsername} on RIZZ`, text: profile!.bio || `Check out @${profileUsername} on RIZZ`, url };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Profile link copied");
      }
    } catch {}
  };

  const followMut = useMutation({
    mutationFn: async () => {
      if (!user || !profile) return;
      if (isFollowing) {
        await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", profile.id);
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
    onSettled: () => { void qc.invalidateQueries({ queryKey: blockStatusKey }); },
  });

  if (profileQ.isLoading) {
    return <div className="h-64 animate-pulse rounded-3xl glass" />;
  }
  if (profileQ.isError) {
    return (
      <div className="py-20 text-center">
        <h1 className="font-display text-2xl font-bold">Profile couldn’t load</h1>
        <p className="mt-2 text-sm text-muted-foreground">Check your connection and try again.</p>
        <Button variant="outline" className="mt-5 glass border-white/10" onClick={() => profileQ.refetch()}>
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
  const joined = new Date(profile.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" });
  // Three independent slots: decoration, banner effect and frame. Each
  // renderer ignores slugs outside the live catalogue, so a stale row can
  // never resurrect a removed overlay.
  const shownEffect = eq?.profile_effect ?? null;
  const shownDecoration = eq?.avatar_decoration ?? null;
  const shownFrame = eq?.profile_frame ?? null;

  return (
    <div className="relative isolate">
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
          effects={{
            profile_effect: shownEffect,
            avatar_decoration: shownDecoration,
            profile_frame: shownFrame,
          }}
          status={presenceStatus}
          statusIsSelf={Boolean(isMe)}
          customStatus={customStatus}
          statusLine={
            <>
              {!isMe && <p className="mt-0.5 text-xs text-muted-foreground">{statusLabel(presenceStatus)}</p>}
              {customStatus && (customStatus.emoji || customStatus.text) ? (
                <StatusPill
                  emoji={customStatus.emoji}
                  text={customStatus.text}
                  expiresAt={presenceRow?.custom_status_expires_at ?? null}
                  onActivate={isMe ? () => setStatusOpen(true) : undefined}
                  className="mt-1.5"
                />
              ) : isMe ? (
                <StatusPill emptyLabel="+ Set status" onActivate={() => setStatusOpen(true)} className="mt-1.5" />
              ) : null}
            </>
          }
          featuredBadge={
            featuredBadge ? (
              <span
                className="inline-flex items-center"
                aria-label={`Featured badge: ${featuredBadge.name}`}
              >
                <BadgeMark slug={featuredBadge.slug} size={24} title={featuredBadge.name} />
              </span>
            ) : undefined
          }
          avatarRing="var(--background)"
          surface="var(--background)"
          gutter="clamp(4px, 1.2vw, 8px)"
        />
      </motion.div>

      <div className="relative z-20">
      <div className="mt-4 flex flex-wrap items-center gap-2 px-1 md:px-2">
        {isMe ? (
          <>
            <Button variant="outline" size="sm" className="glass border-white/10" onClick={shareProfile}>
              <Share2 className="h-4 w-4" />
            </Button>
            <Link to="/settings">
              <Button variant="outline" size="sm" className="glass border-white/10">Edit profile</Button>
            </Link>
          </>
        ) : user ? (
          <>
            <Button
              size="sm"
              onClick={() => followMut.mutate()}
              disabled={followMut.isPending}
              className={isFollowing ? "glass border border-white/10" : "bg-primary text-primary-foreground border-0 shadow-md"}
              variant={isFollowing ? "outline" : "default"}
            >
              {isFollowing ? "Following" : "Follow"}
            </Button>
            {!blockStatus.data && <Button size="sm" variant="outline" className="glass border-white/10" onClick={() => nav({ to: "/dm/$userId", params: { userId: profile.id } })}>
              <MessageCircle className="h-4 w-4" />
            </Button>}
            <Button
              size="sm"
              variant="outline"
              disabled={blockStatus.isLoading || blockMut.isPending}
              onClick={() => blockMut.mutate(!blockStatus.data)}
              className={blockStatus.data ? "border-destructive/30 text-destructive" : "glass border-white/10"}
            >
              {blockStatus.data ? "Unblock" : "Block"}
            </Button>
            <Button size="sm" variant="outline" className="glass border-white/10" onClick={shareProfile}>
              <Share2 className="h-4 w-4" />
            </Button>
          </>
        ) : null}
      </div>

      {profile.bio && (
        <div className="px-1 md:px-2 mt-3 text-sm leading-relaxed whitespace-pre-wrap">
          <MarkdownText
            text={profile.bio}
            renderPlainText={(plain) =>
              renderCaptionWithTags(plain).map((p, i) => {
                if (p.tag) {
                  return (
                    <Link key={i} to="/tag/$tag" params={{ tag: p.tag }} className="text-primary hover:underline font-medium">
                      {p.text}
                    </Link>
                  );
                }
                if (p.mention) {
                  return (
                    <Link key={i} to="/u/$username" params={{ username: p.mention }} className="mention-highlight hover:underline font-medium">
                      {p.text}
                    </Link>
                  );
                }
                if (p.url) {
                  return (
                    <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline break-all">
                      {p.text}
                    </a>
                  );
                }
                return <span key={i}>{p.text}</span>;
              })
            }
          />
        </div>
      )}

      {profile.interests?.length > 0 && (
        <section className="px-1 md:px-2 mt-4" aria-label="Profile interests">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Into</h2>
          <div className="flex flex-wrap gap-2">
            {[...new Set(profile.interests)].map((interest) => {
              const option = TUTORIAL_INTERESTS.find((item) => item.id === interest);
              return (
                <span
                  key={interest}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium"
                >
                  {option && <CustomEmoji name={option.emoji} className="h-4 w-4" />}
                  {interest}
                </span>
              );
            })}
          </div>
        </section>
      )}

      <ProfileBadgesSection
        profileId={profile.id}
        isOwner={Boolean(isMe)}
        stored={profile.badges}
        earned={badges.data ?? []}
        loading={badges.isLoading}
      />

      <div className="px-1 md:px-2 mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <div><span className="font-bold">{posts.data?.length ?? 0}</span> <span className="text-muted-foreground">posts</span></div>
        <button onClick={() => setListOpen("followers")} className="hover:underline">
          <span className="font-bold">{followerCount}</span> <span className="text-muted-foreground">followers</span>
        </button>
        <button onClick={() => setListOpen("following")} className="hover:underline">
          <span className="font-bold">{followingCount}</span> <span className="text-muted-foreground">following</span>
        </button>
        <div className="flex items-center gap-1.5 text-primary font-bold sm:ml-auto">
          <PawPrint className="h-4 w-4" />
          {formatNumber(profile.paw_balance ?? 0)} <span className="text-muted-foreground">Paws balance</span>
        </div>
      </div>

      <div className="px-1 md:px-2 mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Calendar className="h-3 w-3" /> Joined {joined}
      </div>

      <Tabs defaultValue="posts" className="mt-4">
        <TabsList className="glass border border-white/5 w-full justify-start overflow-x-auto rounded-xl p-1">
          <TabsTrigger value="posts" className="gap-1.5"><Hash className="h-4 w-4" />Posts</TabsTrigger>
          <TabsTrigger value="reels" className="gap-1.5"><Film className="h-4 w-4" />Reels</TabsTrigger>
          <TabsTrigger value="realms" className="gap-1.5"><Hash className="h-4 w-4" />Realms</TabsTrigger>
          <TabsTrigger value="groups" className="gap-1.5"><Users className="h-4 w-4" />Groups</TabsTrigger>
          <TabsTrigger value="paws" className="gap-1.5"><PawPrint className="h-4 w-4" />Paws</TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="mt-4 space-y-3">
          {posts.isLoading ? (
            <div className="h-40 animate-pulse rounded-2xl glass" />
          ) : posts.data?.length === 0 ? (
            <EmptyState label="No posts yet" />
          ) : (
            posts.data?.map((p) => <PostCard key={p.id} post={p} />)
          )}
        </TabsContent>

        <TabsContent value="reels" className="mt-4">
          {reelsQ.isLoading ? (
            <div className="h-40 animate-pulse rounded-2xl glass" />
          ) : reelsQ.data?.length === 0 ? (
            <EmptyState label="No reels yet" />
          ) : (
            <div className="grid grid-cols-3 gap-1.5 md:gap-2">
              {reelsQ.data?.map((r) => (
                <Link key={r.id} to="/reels" className="relative aspect-[9/16] rounded-xl overflow-hidden glass group">
                  <video src={r.media_url ?? undefined} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                    <div className="text-xs flex items-center gap-1"><Heart className="h-3 w-3" />{r.like_count}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="realms" className="mt-4 space-y-2">
          {realmsQ.isLoading ? (
            <div className="h-24 animate-pulse rounded-2xl glass" />
          ) : realmsQ.data?.length === 0 ? (
            <EmptyState label="No realms owned" />
          ) : (
            realmsQ.data?.map((c) => (
              <Link key={c.id} to="/r/$slug" params={{ slug: c.slug }} className="block glass rounded-xl p-3 min-h-[56px] hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center font-bold" style={{ background: `linear-gradient(135deg, ${c.accent_color || accent}, var(--brand-paper-dim))` }}>
                    #
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{c.name}</div>
                    {c.topic && <div className="text-xs text-muted-foreground truncate">{c.topic}</div>}
                  </div>
                  <div className="text-xs text-muted-foreground">{c.member_count} members</div>
                </div>
              </Link>
            ))
          )}
        </TabsContent>

        <TabsContent value="groups" className="mt-4 space-y-2">
          {groupsQ.isLoading ? (
            <div className="h-24 animate-pulse rounded-2xl glass" />
          ) : groupsQ.data?.length === 0 ? (
            <EmptyState label="Not in any groups yet" />
          ) : (
            groupsQ.data?.map((g) => (
              <Link key={g.id} to="/g/$id" params={{ id: g.id }} className="block glass rounded-xl p-3 min-h-[56px] hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-3">
                  {g.icon_url ? (
                    <img src={g.icon_url} width={40} height={40} loading="lazy" decoding="async" className="h-10 w-10 rounded-xl object-cover" alt="" />
                  ) : (
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center font-bold" style={{ background: `linear-gradient(135deg, ${g.accent_color || accent}, var(--brand-paper-dim))` }}>
                      {g.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{g.name}</div>
                    {g.topic && <div className="text-xs text-muted-foreground truncate">{g.topic}</div>}
                  </div>
                  <div className="text-xs text-muted-foreground">{g.member_count}</div>
                </div>
              </Link>
            ))
          )}
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

function EmptyState({ label }: { label: string }) {
  return (
    <div className="glass rounded-3xl p-10 text-center">
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

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
        {isMe && (
          <Link
            to="/effects"
            className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full border border-white/10 px-4 text-sm font-bold"
          >
            Use Paws
          </Link>
        )}
      </div>
    </div>
  );
}