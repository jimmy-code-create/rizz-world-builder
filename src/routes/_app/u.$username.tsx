import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/PostCard";
import { fetchUserPosts } from "@/lib/posts";
import { fetchUserBadges } from "@/lib/badges";
import { BadgeRow } from "@/components/BadgeChip";
import { motion } from "framer-motion";
import { Sparkles, Calendar, MessageCircle, Share2, Hash, Users, Film, Trophy, Heart, MessageSquare, UserPlus, Star } from "lucide-react";
import { toast } from "sonner";
import { FollowListDialog } from "@/components/social/FollowListDialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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

  const channelsQ = useQuery({
    queryKey: ["user-channels", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("channels")
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

  const rizzBreakdown = useQuery({
    queryKey: ["rizz-breakdown", profile?.id],
    queryFn: async () => {
      const uid = profile!.id;
      const [{ count: likes }, { count: comments }, { count: reactions }, postsRes, { count: badgeCount }] = await Promise.all([
        supabase.from("post_likes").select("post_id,posts!inner(author_id)", { count: "exact", head: true }).eq("posts.author_id", uid),
        supabase.from("post_comments").select("post_id,posts!inner(author_id)", { count: "exact", head: true }).eq("posts.author_id", uid),
        supabase.from("post_reactions").select("post_id,posts!inner(author_id)", { count: "exact", head: true }).eq("posts.author_id", uid),
        supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_id", uid),
        supabase.from("user_badges").select("badge_id", { count: "exact", head: true }).eq("user_id", uid),
      ]);
      return {
        likes: likes ?? 0,
        comments: comments ?? 0,
        reactions: reactions ?? 0,
        postCount: postsRes.count ?? 0,
        badges: badgeCount ?? 0,
      };
    },
    enabled: !!profile,
  });

  const shareProfile = async () => {
    const url = `${window.location.origin}/u/${profile!.username}`;
    const shareData = { title: `@${profile!.username} on RIZZ`, text: profile!.bio || `Check out @${profile!.username} on RIZZ`, url };
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

  if (profileQ.isLoading) {
    return <div className="h-64 animate-pulse rounded-3xl glass" />;
  }
  if (!profile) {
    return (
      <div className="text-center py-20">
        <h1 className="font-display text-2xl font-bold">Profile not found</h1>
        <p className="text-muted-foreground mt-2">@{username} doesn't exist on RIZZ.</p>
      </div>
    );
  }

  const accent = profile.accent_color || "var(--rizz-pink)";
  const initial = (profile.display_name || profile.username).charAt(0).toUpperCase();
  const joined = new Date(profile.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" });

  return (
    <div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative">
        <div
          className="h-40 md:h-56 rounded-3xl mb-16 relative overflow-hidden"
          style={{
            background: profile.banner_url
              ? `url(${profile.banner_url}) center/cover`
              : `linear-gradient(135deg, ${accent}, var(--rizz-violet))`,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        </div>
        <div className="absolute -bottom-12 left-4 md:left-6">
          <Avatar className="h-24 w-24 md:h-28 md:w-28 ring-4 ring-background" style={{ boxShadow: `0 0 30px ${accent}80` }}>
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback className="bg-gradient-primary text-3xl font-bold">{initial}</AvatarFallback>
          </Avatar>
        </div>
      </motion.div>

      <div className="px-1 md:px-2 mt-4 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight truncate">
            {profile.display_name || profile.username}
          </h1>
          <p className="text-sm text-muted-foreground">@{profile.username}</p>
        </div>
        {isMe ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="glass border-white/10" onClick={shareProfile}>
              <Share2 className="h-4 w-4" />
            </Button>
            <Link to="/settings">
              <Button variant="outline" size="sm" className="glass border-white/10">Edit profile</Button>
            </Link>
          </div>
        ) : user ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => followMut.mutate()}
              disabled={followMut.isPending}
              className={isFollowing ? "glass border border-white/10" : "bg-gradient-primary border-0 shadow-glow"}
              variant={isFollowing ? "outline" : "default"}
            >
              {isFollowing ? "Following" : "Follow"}
            </Button>
            <Button size="sm" variant="outline" className="glass border-white/10" onClick={() => nav({ to: "/dm/$userId", params: { userId: profile.id } })}>
              <MessageCircle className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" className="glass border-white/10" onClick={shareProfile}>
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </div>

      {profile.bio && <p className="px-1 md:px-2 mt-3 text-sm leading-relaxed whitespace-pre-wrap">{profile.bio}</p>}

      {badges.data && badges.data.length > 0 && (
        <div className="px-1 md:px-2 mt-4">
          <BadgeRow badges={badges.data} max={8} />
        </div>
      )}

      <div className="px-1 md:px-2 mt-4 flex items-center gap-5 text-sm">
        <div><span className="font-bold">{posts.data?.length ?? 0}</span> <span className="text-muted-foreground">posts</span></div>
        <button onClick={() => setListOpen("followers")} className="hover:underline">
          <span className="font-bold">{followerCount}</span> <span className="text-muted-foreground">followers</span>
        </button>
        <button onClick={() => setListOpen("following")} className="hover:underline">
          <span className="font-bold">{followingCount}</span> <span className="text-muted-foreground">following</span>
        </button>
        <div className="ml-auto flex items-center gap-1.5 text-[var(--rizz-pink)] font-bold">
          <Sparkles className="h-4 w-4" />
          {profile.rizz_score} Rizz
        </div>
      </div>

      <div className="px-1 md:px-2 mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Calendar className="h-3 w-3" /> Joined {joined}
      </div>

      <Tabs defaultValue="posts" className="mt-8">
        <TabsList className="glass border border-white/5 w-full justify-start overflow-x-auto rounded-2xl p-1">
          <TabsTrigger value="posts" className="gap-1.5"><Hash className="h-4 w-4" />Posts</TabsTrigger>
          <TabsTrigger value="reels" className="gap-1.5"><Film className="h-4 w-4" />Reels</TabsTrigger>
          <TabsTrigger value="channels" className="gap-1.5"><Hash className="h-4 w-4" />Channels</TabsTrigger>
          <TabsTrigger value="servers" className="gap-1.5"><Users className="h-4 w-4" />Servers</TabsTrigger>
          <TabsTrigger value="rizz" className="gap-1.5"><Trophy className="h-4 w-4" />Rizz</TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="mt-6 space-y-4">
          {posts.isLoading ? (
            <div className="h-40 animate-pulse rounded-3xl glass" />
          ) : posts.data?.length === 0 ? (
            <EmptyState label="No posts yet" />
          ) : (
            posts.data?.map((p) => <PostCard key={p.id} post={p} />)
          )}
        </TabsContent>

        <TabsContent value="reels" className="mt-6">
          {reelsQ.isLoading ? (
            <div className="h-40 animate-pulse rounded-3xl glass" />
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

        <TabsContent value="channels" className="mt-6 space-y-2">
          {channelsQ.isLoading ? (
            <div className="h-24 animate-pulse rounded-3xl glass" />
          ) : channelsQ.data?.length === 0 ? (
            <EmptyState label="No channels owned" />
          ) : (
            channelsQ.data?.map((c) => (
              <Link key={c.id} to="/c/$slug" params={{ slug: c.slug }} className="block glass rounded-2xl p-4 hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center font-bold" style={{ background: `linear-gradient(135deg, ${c.accent_color || accent}, var(--rizz-violet))` }}>
                    #
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{c.name}</div>
                    {c.topic && <div className="text-xs text-muted-foreground truncate">{c.topic}</div>}
                  </div>
                  <div className="text-xs text-muted-foreground">{c.member_count} members</div>
                </div>
              </Link>
            ))
          )}
        </TabsContent>

        <TabsContent value="servers" className="mt-6 space-y-2">
          {groupsQ.isLoading ? (
            <div className="h-24 animate-pulse rounded-3xl glass" />
          ) : groupsQ.data?.length === 0 ? (
            <EmptyState label="Not in any servers yet" />
          ) : (
            groupsQ.data?.map((g) => (
              <Link key={g.id} to="/g/$id" params={{ id: g.id }} className="block glass rounded-2xl p-4 hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-3">
                  {g.icon_url ? (
                    <img src={g.icon_url} className="h-10 w-10 rounded-xl object-cover" alt="" />
                  ) : (
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center font-bold" style={{ background: `linear-gradient(135deg, ${g.accent_color || accent}, var(--rizz-violet))` }}>
                      {g.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{g.name}</div>
                    {g.topic && <div className="text-xs text-muted-foreground truncate">{g.topic}</div>}
                  </div>
                  <div className="text-xs text-muted-foreground">{g.member_count}</div>
                </div>
              </Link>
            ))
          )}
        </TabsContent>

        <TabsContent value="rizz" className="mt-6">
          <RizzBreakdown score={profile.rizz_score} data={rizzBreakdown.data} loading={rizzBreakdown.isLoading} accent={accent} />
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

function RizzBreakdown({ score, data, loading, accent }: { score: number; data?: { likes: number; comments: number; reactions: number; postCount: number; badges: number }; loading: boolean; accent: string }) {
  if (loading || !data) return <div className="h-40 animate-pulse rounded-3xl glass" />;
  const rows = [
    { icon: Heart, label: "Likes received", value: data.likes, pts: data.likes * 2, color: "var(--rizz-pink)" },
    { icon: MessageSquare, label: "Comments received", value: data.comments, pts: data.comments * 3, color: "var(--rizz-violet)" },
    { icon: Sparkles, label: "Reactions received", value: data.reactions, pts: data.reactions * 1, color: "var(--rizz-pink)" },
    { icon: UserPlus, label: "Posts published", value: data.postCount, pts: data.postCount * 5, color: "var(--rizz-violet)" },
    { icon: Star, label: "Badges earned", value: data.badges, pts: data.badges * 25, color: "var(--rizz-pink)" },
  ];
  const total = rows.reduce((a, r) => a + r.pts, 0) || 1;
  return (
    <div className="space-y-4">
      <div className="glass rounded-3xl p-6 text-center" style={{ boxShadow: `0 0 40px ${accent}30` }}>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Rizz Score</div>
        <div className="font-display text-5xl font-bold mt-2 flex items-center justify-center gap-2" style={{ color: accent }}>
          <Sparkles className="h-8 w-8" />{score}
        </div>
      </div>
      <div className="glass rounded-3xl p-5 space-y-3">
        {rows.map((r) => {
          const pct = Math.min(100, (r.pts / total) * 100);
          const Icon = r.icon;
          return (
            <div key={r.label}>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <div className="flex items-center gap-2"><Icon className="h-4 w-4" style={{ color: r.color }} /> {r.label}</div>
                <div className="text-muted-foreground"><span className="font-semibold text-foreground">{r.value}</span> · +{r.pts}</div>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${r.color}, ${accent})` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}