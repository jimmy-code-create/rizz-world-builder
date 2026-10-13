import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, UserPlus, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { defaultAvatarFor } from "@/lib/default-avatars";
import { formatCount } from "@/lib/utils";

type PreviewProfile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
};

async function fetchPreview(username: string): Promise<PreviewProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, avatar_url")
    .eq("username", username)
    .maybeSingle();
  if (error) throw error;
  return (data as PreviewProfile) ?? null;
}

/**
 * A small profile card — avatar, name, bio, follower count and the two actions
 * people actually want (follow / message) — without leaving the page you are on.
 *
 * Drop `<ProfilePreviewTrigger username="…">` around any name or avatar and it
 * becomes tappable everywhere, which is what makes this feel like one app
 * instead of a feed, a chat and a comments page that each behave differently.
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
  const { user } = useAuth();
  const qc = useQueryClient();

  const profile = useQuery({
    queryKey: ["profile-preview", username],
    queryFn: () => fetchPreview(username),
    enabled: open,
    staleTime: 60_000,
  });

  const id = profile.data?.id;
  const followers = useQuery({
    queryKey: ["profile-preview-followers", id],
    queryFn: async () => {
      const { count } = await supabase
        .from("follows")
        .select("follower_id", { count: "exact", head: true })
        .eq("following_id", id!);
      return count ?? 0;
    },
    enabled: open && !!id,
  });

  const following = useQuery({
    queryKey: ["profile-preview-following", id, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", user!.id)
        .eq("following_id", id!)
        .maybeSingle();
      return !!data;
    },
    enabled: open && !!id && !!user,
  });

  const postsCount = useQuery({
    queryKey: ["profile-preview-posts", id],
    queryFn: async () => {
      const { count } = await supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("author_id", id!);
      return count ?? 0;
    },
    enabled: open && !!id,
    staleTime: 60_000,
  });

  const followingCount = useQuery({
    queryKey: ["profile-preview-following-count", id],
    queryFn: async () => {
      const { count } = await supabase
        .from("follows")
        .select("follower_id", { count: "exact", head: true })
        .eq("following_id", id!);
      return count ?? 0;
    },
    enabled: open && !!id,
    staleTime: 60_000,
  });

  const toggleFollow = useMutation({
    mutationFn: async () => {
      if (!user || !id) return;
      if (following.data) {
        const { error } = await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("follows").insert({ follower_id: user.id, following_id: id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile-preview-following", id, user?.id] });
      qc.invalidateQueries({ queryKey: ["profile-preview-followers", id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const p = profile.data;
  const name = p?.display_name || p?.username || username;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="glass-strong left-0 right-0 top-auto bottom-0 w-full max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-t-3xl rounded-b-none border-0 border-white/10 p-0 shadow-2xl [&>button:last-child]:rounded-full [&>button:last-child]:bg-black/45 [&>button:last-child]:p-2 [&>button:last-child]:text-white [&>button:last-child]:backdrop-blur [&>button:last-child]:hover:bg-black/65 sm:left-1/2 sm:right-auto sm:top-1/2 sm:bottom-auto sm:w-[min(100vw-2rem,24rem)] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-3xl sm:border sm:pb-0"
      >
        <DialogTitle className="sr-only">Profile preview for {name}</DialogTitle>

        {/* Drag handle: phones get a sheet, desktop keeps a card. */}
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/25 sm:hidden" aria-hidden="true" />

        <div className="max-h-[84dvh] overflow-y-auto overscroll-contain sm:max-h-[78dvh]">
          {profile.isLoading && <p className="p-6 text-center text-sm text-muted-foreground">Loading profile…</p>}
          {!profile.isLoading && !p && (
            <p className="p-6 text-center text-sm text-muted-foreground">That profile is no longer available.</p>
          )}
          {p && (
            <>
              {/* Discord-style banner, with the avatar breaking out of it */}
              <div className="relative h-24 w-full bg-gradient-primary">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_-20%,rgba(255,255,255,0.35),transparent_55%)]" />
              </div>

              <div className="px-5 pb-5">
                <div className="-mt-10">
                  <Avatar className="h-20 w-20 rounded-full ring-4 ring-[var(--surface-bar)]">
                    <AvatarImage src={p.avatar_url ?? defaultAvatarFor(p.username)} />
                    <AvatarFallback className="bg-gradient-primary text-2xl font-bold">
                      {name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>

                <h2 className="mt-3 font-display text-xl font-bold leading-tight">{name}</h2>
                <p className="text-sm text-muted-foreground">@{p.username}</p>

                {/* Stats row */}
                <div className="mt-3 grid grid-cols-3 divide-x divide-white/10 rounded-2xl border border-white/10 bg-white/[0.03] py-2.5 text-center">
                  {[
                    { value: postsCount.data ?? 0, label: "Posts" },
                    { value: followers.data ?? 0, label: "Followers" },
                    { value: followingCount.data ?? 0, label: "Following" },
                  ].map((stat) => (
                    <div key={stat.label}>
                      <p className="text-sm font-bold tabular-nums">{formatCount(stat.value)}</p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">About</p>
                  <p className="mt-1 text-sm leading-snug text-foreground/90">{p.bio || "No bio yet — say something."}</p>
                </div>

                <div className="mt-4 flex gap-2">
                  {user && user.id !== p.id ? (
                    <Button
                      type="button"
                      disabled={toggleFollow.isPending}
                      onClick={() => toggleFollow.mutate()}
                      className={
                        following.data
                          ? "h-11 flex-1 gap-2 border border-white/10 bg-white/5 text-foreground"
                          : "h-11 flex-1 gap-2 border-0 bg-gradient-primary shadow-glow"
                      }
                    >
                      {following.data ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                      {following.data ? "Following" : "Follow"}
                    </Button>
                  ) : null}
                  <Button asChild variant="outline" className="h-11 flex-1 gap-2 border-white/10 bg-white/5">
                    <Link to="/dm/$userId" params={{ userId: p.id }}>
                      <MessageCircle className="h-4 w-4" />
                      Message
                    </Link>
                  </Button>
                </div>

                <Link
                  to="/u/$username"
                  params={{ username: p.username }}
                  className="mt-2.5 flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-xs font-semibold text-foreground/90 transition hover:bg-white/[0.07]"
                >
                  Open full profile
                </Link>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
