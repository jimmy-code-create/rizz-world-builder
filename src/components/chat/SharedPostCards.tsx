import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Film, ImageIcon, Play } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmojiText } from "@/components/emoji/EmojiText";
import { fetchPostById, type FeedPost } from "@/lib/posts";
import { sharedPostIds } from "@/lib/share-links";

/**
 * A shared post or reel, rendered as a card inside a conversation.
 *
 * The same component is used by DMs, group chats and realm channels, so a reel
 * someone shares looks identical wherever it lands. Media is reserved before it
 * loads (16:9 for video, 4:3 for photos) so scrolling never shifts, and the
 * whole card links to the post's own page with a real router Link — no new tab.
 */
export function SharedPostCards({ text }: { text?: string | null }) {
  const ids = sharedPostIds(text);
  if (ids.length === 0) return null;
  return (
    <div className="mt-1.5 flex w-full max-w-[22rem] flex-col gap-2">
      {ids.map((id) => (
        <SharedPostCard key={id} postId={id} />
      ))}
    </div>
  );
}

function SharedPostCard({ postId }: { postId: string }) {
  const post = useQuery({
    queryKey: ["shared-post", postId],
    queryFn: () => fetchPostById(postId),
    staleTime: 5 * 60_000,
  });

  if (post.isLoading) {
    return (
      <div
        aria-hidden="true"
        className="h-[7.5rem] w-full animate-pulse rounded-xl border border-[#22222a] bg-[#0f0f11]"
      />
    );
  }
  if (!post.data) {
    // Deleted or private: the permalink the sender typed stays as plain text.
    return null;
  }

  return <SharedPostCardView post={post.data} />;
}

function SharedPostCardView({ post }: { post: FeedPost }) {
  const isVideo = post.media_type === "video";
  const authorName = post.author?.display_name || post.author?.username || "Someone";
  const username = post.author?.username ?? null;

  return (
    <Link
      to="/p/$postId"
      params={{ postId: post.id }}
      className="block overflow-hidden rounded-xl border border-[#22222a] bg-[#0f0f11] text-left transition-colors hover:border-[#34343d] hover:bg-[#131316] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      aria-label={`Open ${isVideo ? "reel" : "post"} by ${authorName}`}
    >
      <div className="flex items-center gap-2 px-3 pt-2.5">
        {isVideo ? <Film className="h-3.5 w-3.5 shrink-0 text-[#c8ff3d]" /> : <ImageIcon className="h-3.5 w-3.5 shrink-0 text-[#c8ff3d]" />}
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#c8ff3d]">
          {isVideo ? "Reel" : "Post"}
        </span>
      </div>

      {post.media_url && (
        <div className={`relative mt-2 w-full bg-black ${isVideo ? "aspect-video" : "aspect-[4/3]"}`}>
          {isVideo ? (
            <>
              <video
                src={post.media_url}
                muted
                playsInline
                preload="metadata"
                className="h-full w-full object-cover"
              />
              <span className="absolute inset-0 grid place-items-center bg-black/25">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-black/65 ring-1 ring-white/20">
                  <Play className="h-5 w-5 translate-x-[1px] fill-current text-white" />
                </span>
              </span>
            </>
          ) : (
            <img
              src={post.media_url}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          )}
        </div>
      )}

      <div className="px-3 py-2.5">
        {post.caption && (
          <p className="line-clamp-2 text-[13px] leading-snug text-foreground/90">
            <EmojiText text={post.caption} />
          </p>
        )}
        <div className="mt-2 flex items-center gap-2">
          <Avatar className="h-5 w-5 shrink-0">
            <AvatarImage src={post.author?.avatar_url ?? undefined} alt="" />
            <AvatarFallback className="bg-white/10 text-[9px] font-bold">
              {authorName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 truncate text-[11.5px] text-muted-foreground">
            {authorName}
            {username ? ` · @${username}` : ""}
          </span>
        </div>
      </div>
    </Link>
  );
}
