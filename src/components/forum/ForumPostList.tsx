import { MessageSquarePlus, SearchX } from "lucide-react";
import { ForumEmpty, ForumEmptyAction, ForumSkeleton } from "@/components/forum/ForumBits";
import { ForumPostCard } from "@/components/forum/ForumPostCard";
import type { ForumPost, ForumStatus, ForumTag } from "@/lib/forums";
import type { ForumDensity, ForumLayout } from "@/lib/forum-prefs";
import { cn } from "@/lib/utils";

/**
 * The thread list.
 *
 * Pinned threads stay at the top in their own group so "we already answered
 * this" is the first thing anyone sees, and the rest follow in the order the
 * query returned. Gallery uses real CSS columns, which gives the masonry look
 * without measuring anything in JavaScript.
 */
export function ForumPostList({
  posts,
  layout,
  density,
  tagsById,
  statusesById,
  readIds,
  mutedIds,
  loading,
  hasFilters,
  onOpen,
  onToggleTag,
  onNewPost,
  onClearFilters,
}: {
  posts: ForumPost[];
  layout: ForumLayout;
  density: ForumDensity;
  tagsById: Map<string, ForumTag>;
  statusesById: Map<string, ForumStatus>;
  readIds: Set<string>;
  mutedIds: Set<string>;
  loading?: boolean;
  hasFilters: boolean;
  onOpen: (post: ForumPost) => void;
  onToggleTag: (tagId: string) => void;
  onNewPost: () => void;
  onClearFilters: () => void;
}) {
  if (loading) return <ForumSkeleton layout={layout} rows={5} />;

  if (posts.length === 0) {
    if (hasFilters) {
      return (
        <ForumEmpty
          icon={<SearchX className="h-5 w-5" />}
          title="Nothing matches those filters"
          body="Try a different tag, clear the search, or show archived threads."
        >
          <ForumEmptyAction onClick={onClearFilters}>Clear filters</ForumEmptyAction>
        </ForumEmpty>
      );
    }
    return (
      <ForumEmpty
        icon={<MessageSquarePlus className="h-5 w-5" />}
        title="No threads yet"
        body="Start the first one — a question, a bug report or a guide."
      >
        <ForumEmptyAction onClick={onNewPost}>Write the first post</ForumEmptyAction>
      </ForumEmpty>
    );
  }

  const pinned = posts.filter((post) => post.is_pinned);
  const rest = posts.filter((post) => !post.is_pinned);

  const renderGroup = (list: ForumPost[], offset: number) => {
    const cards = list.map((post, index) => (
      <ForumPostCard
        key={post.id}
        post={post}
        layout={layout}
        density={density}
        index={offset + index}
        tags={post.tag_ids.map((id) => tagsById.get(id)).filter((tag): tag is ForumTag => !!tag)}
        status={post.status_id ? statusesById.get(post.status_id) ?? null : null}
        unread={!readIds.has(post.id)}
        muted={mutedIds.has(post.id)}
        onOpen={() => onOpen(post)}
        onToggleTag={onToggleTag}
      />
    ));
    if (layout === "gallery") return <div className="forum-masonry">{cards}</div>;
    return (
      <div className="flex flex-col" style={{ gap: "var(--forum-gap)" }}>
        {cards}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {pinned.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Pinned</h3>
          {renderGroup(pinned, 0)}
        </section>
      )}
      <section className={cn(pinned.length > 0 && "space-y-2")}>
        {pinned.length > 0 && (
          <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">All threads</h3>
        )}
        {renderGroup(rest, pinned.length)}
      </section>
    </div>
  );
}
