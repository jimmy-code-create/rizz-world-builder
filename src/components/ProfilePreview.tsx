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
      <DialogContent className="w-[min(100vw-2rem,22rem)] max-w-none gap-0 overflow-hidden rounded-3xl border-white/10 glass-strong p-0">
        <DialogTitle className="sr-only">Profile preview</DialogTitle>
        {profile.isLoading && <p className="p-6 text-center text-sm text-muted-foreground">Loading profile…</p>}
        {!profile.isLoading && !p && (
          <p className="p-6 text-center text-sm text-muted-foreground">That profile is no longer available.</p>
        )}
        {p && (
          <>
            <div className="h-20 bg-gradient-primary/80" />
            <div className="-mt-10 px-5 pb-5">
              <Avatar className="h-20 w-20 ring-4 ring-background">
                <AvatarImage src={p.avatar_url ?? defaultAvatarFor(p.username)} />
                <AvatarFallback className="bg-gradient-primary text-2xl font-bold">
                  {name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <h2 className="mt-3 font-display text-lg font-bold">{name}</h2>
              <p className="text-xs text-muted-foreground">@{p.username}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatCount(followers.data ?? 0)} followers
              </p>
              {p.bio && <p className="mt-2 text-sm leading-snug">{p.bio}</p>}
              <div className="mt-4 flex gap-2">
                {user && user.id !== p.id ? (
                  <Button
                    type="button"
                    disabled={toggleFollow.isPending}
                    onClick={() => toggleFollow.mutate()}
                    className={following.data ? "h-10 flex-1 gap-2 border border-white/10 bg-white/5 text-foreground" : "h-10 flex-1 gap-2 border-0 bg-gradient-primary shadow-glow"}
                  >
                    {following.data ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                    {following.data ? "Following" : "Follow"}
                  </Button>
                ) : null}
                <Button asChild variant="outline" className="h-10 flex-1 gap-2 border-white/10 bg-white/5">
                  <Link to="/dm/$userId" params={{ userId: p.id }}>
                    <MessageCircle className="h-4 w-4" />
                    Message
                  </Link>
                </Button>
              </div>
              <Link
                to="/u/$username"
                params={{ username: p.username }}
                className="mt-3 block text-center text-xs font-semibold text-[var(--rizz-pink)] hover:underline"
              >
                Open full profile
              </Link>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
