import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef, useEffect, useState } from "react";
import { Heart, MessageCircle, Share2, Volume2, VolumeX, Music2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { fetchReels } from "@/lib/posts";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/reels")({
  head: () => ({ meta: [{ title: "Reels · RIZZ" }] }),
  component: ReelsPage,
});

function ReelsPage() {
  const reels = useQuery({ queryKey: ["reels"], queryFn: () => fetchReels(40) });
  const [muted, setMuted] = useState(true);

  return (
    <div className="-mx-4 md:-mx-8 -my-6 md:-my-10 h-[calc(100dvh-7rem)] md:h-[calc(100dvh-2.5rem)]">
      {reels.isLoading && <div className="h-full grid place-items-center text-muted-foreground">Loading reels…</div>}
      {reels.data?.length === 0 && (
        <div className="h-full grid place-items-center text-muted-foreground">No reels yet — post a video to start the vibe.</div>
      )}
      <div className="h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar">
        {reels.data?.map((r) => (
          <ReelItem key={r.id} post={r} muted={muted} toggleMute={() => setMuted((m) => !m)} />
        ))}
      </div>
    </div>
  );
}

function ReelItem({ post, muted, toggleMute }: { post: any; muted: boolean; toggleMute: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) el.play().catch(() => {});
        else el.pause();
      },
      { threshold: 0.6 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const remix = () => toast.success("Remix template saved to your drafts ✨");
  const share = () => {
    navigator.clipboard.writeText(window.location.origin + "/u/" + post.author?.username);
    toast.success("Link copied");
  };

  return (
    <section className="relative h-full snap-start grid place-items-center bg-black">
      <video
        ref={ref}
        src={post.media_url}
        muted={muted}
        loop
        playsInline
        onClick={toggleMute}
        className="h-full w-full object-contain"
      />
      <button onClick={toggleMute} className="absolute top-4 right-4 h-10 w-10 rounded-full glass-strong grid place-items-center">
        {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </button>
      <div className="absolute left-4 right-20 bottom-6 text-white drop-shadow">
        <Link to="/u/$username" params={{ username: post.author?.username ?? "" }} className="flex items-center gap-2 mb-2">
          <Avatar className="h-9 w-9 ring-2 ring-white/40">
            <AvatarImage src={post.author?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-gradient-primary text-xs">{(post.author?.username ?? "?").charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="font-bold text-sm">@{post.author?.username}</span>
        </Link>
        {post.caption && <p className="text-sm line-clamp-3">{post.caption}</p>}
        <div className="flex items-center gap-1.5 text-xs mt-2 opacity-80">
          <Music2 className="h-3.5 w-3.5" /> Original audio · @{post.author?.username}
        </div>
      </div>
      <div className="absolute right-3 bottom-10 flex flex-col items-center gap-3 text-white">
        <ReelAction icon={<Heart className="h-6 w-6" />} label={String(post.like_count)} />
        <ReelAction icon={<MessageCircle className="h-6 w-6" />} label={String(post.comment_count)} />
        <ReelAction icon={<Share2 className="h-6 w-6" />} label="Share" onClick={share} />
        <Button onClick={remix} size="sm" variant="outline" className="rounded-full bg-white/10 border-white/30 text-white">Remix</Button>
      </div>
    </section>
  );
}

function ReelAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1">
      <span className="h-11 w-11 rounded-full glass-strong grid place-items-center">{icon}</span>
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}