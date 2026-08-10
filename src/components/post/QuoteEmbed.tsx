import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Quote } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { fetchPostById } from "@/lib/posts";

export function QuoteEmbed({ postId }: { postId: string }) {
  const q = useQuery({ queryKey: ["post", postId], queryFn: () => fetchPostById(postId) });
  if (q.isLoading) {
    return <div className="mx-4 mb-3 h-20 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />;
  }
  const p = q.data;
  if (!p) {
    return (
      <div className="mx-4 mb-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs text-muted-foreground">
        This post is unavailable.
      </div>
    );
  }
  const initial = (p.author?.display_name || p.author?.username || "?").charAt(0).toUpperCase();
  return (
    <Link
      to="/u/$username"
      params={{ username: p.author?.username ?? "" }}
      className="mx-4 mb-3 block rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-white/20"
    >
      <div className="flex items-center gap-2">
        <Quote className="h-3 w-3 shrink-0 text-[var(--rizz-pink)]" />
        <Avatar className="h-5 w-5">
          <AvatarImage src={p.author?.avatar_url ?? undefined} />
          <AvatarFallback className="bg-gradient-primary text-[9px]">{initial}</AvatarFallback>
        </Avatar>
        <span className="truncate text-xs font-semibold">@{p.author?.username}</span>
      </div>
      {p.caption && <p className="mt-1.5 line-clamp-3 text-xs leading-snug text-muted-foreground">{p.caption}</p>}
      {p.media_url && p.media_type === "image" && (
        <img src={p.media_url} alt="" loading="lazy" decoding="async" className="mt-2 max-h-48 w-full rounded-xl object-cover" />
      )}
      {p.media_url && p.media_type === "video" && (
        <video src={p.media_url} preload="metadata" muted playsInline className="mt-2 max-h-48 w-full rounded-xl object-cover" />
      )}
    </Link>
  );
}