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
import { Sparkles, Calendar, MessageCircle } from "lucide-react";
import { toast } from "sonner";

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
          <Link to="/settings">
            <Button variant="outline" size="sm" className="glass border-white/10">Edit profile</Button>
          </Link>
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
        <div><span className="font-bold">{followerCount}</span> <span className="text-muted-foreground">followers</span></div>
        <div><span className="font-bold">{followingCount}</span> <span className="text-muted-foreground">following</span></div>
        <div className="ml-auto flex items-center gap-1.5 text-[var(--rizz-pink)] font-bold">
          <Sparkles className="h-4 w-4" />
          {profile.rizz_score} Rizz
        </div>
      </div>

      <div className="px-1 md:px-2 mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Calendar className="h-3 w-3" /> Joined {joined}
      </div>

      <div className="mt-8 border-t border-white/5 pt-6">
        {posts.data?.length === 0 ? (
          <div className="glass rounded-3xl p-10 text-center">
            <p className="text-sm text-muted-foreground">No posts yet.</p>
          </div>
        ) : (
          posts.data?.map((p) => <PostCard key={p.id} post={p} />)
        )}
      </div>
    </div>
  );
}