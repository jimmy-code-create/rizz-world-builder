import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ForumHero, ForumSlimHeader } from "@/components/forum/ForumHero";
import { ForumToolbar, ForumViewOptions } from "@/components/forum/ForumToolbar";
import { ForumPostList } from "@/components/forum/ForumPostList";
import { ForumComposer } from "@/components/forum/ForumComposer";
import { ForumPostView } from "@/components/forum/ForumPostView";
import { ForumSettingsSheet } from "@/components/forum/ForumSettingsSheet";
import {
  DEFAULT_FORUM_FILTERS,
  archiveStaleForumPosts,
  emptyForumConfig,
  forumConfigKey,
  forumEnsureConfig,
  forumPostsKey,
  forumTaxonomyKey,
  setForumMute,
  toggleForumTagFollow,
  useForumConfig,
  useForumMutes,
  useForumMyTags,
  useForumPosts,
  useForumRealtime,
  useForumTaxonomy,
  type ForumConfig,
  type ForumFilters,
  type ForumPost,
} from "@/lib/forums";
import { resolveForumView, useForumPrefs } from "@/lib/forum-prefs";
import type { RealmRoom } from "@/lib/realms";

/**
 * A forum channel, from the inside.
 *
 * This is the single place that owns a forum's state: which filters are on, how
 * the reader likes it laid out, which thread is open, and whether the composer
 * or the customization screen is up. The realm page renders it in place of the
 * message pane, so a forum and a text channel sit in exactly the same shell.
 */
export function RealmForum({
  realmId,
  realmName,
  room,
  accentColor,
  userId,
  canModerate,
  joined,
  initialPostId = null,
  onPostChange,
}: {
  realmId: string;
  realmName: string;
  room: RealmRoom;
  accentColor: string | null;
  userId: string | null;
  canModerate: boolean;
  joined: boolean;
  /** A thread from the URL, so a shared link opens the thread, not just the board. */
  initialPostId?: string | null;
  onPostChange?: (postId: string | null) => void;
}) {
  const qc = useQueryClient();
  const { prefs, update: updatePrefs } = useForumPrefs();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const config = useForumConfig(realmId, room.id, joined);
  const taxonomy = useForumTaxonomy(config.data?.id, joined && !!config.data?.id);
  // Memoised so an empty forum doesn't hand every consumer a brand-new array on
  // each render, which would recompute the maps below for nothing.
  const tags = useMemo(() => taxonomy.data?.tags ?? [], [taxonomy.data?.tags]);
  const statuses = useMemo(() => taxonomy.data?.statuses ?? [], [taxonomy.data?.statuses]);
  const templates = useMemo(() => taxonomy.data?.templates ?? [], [taxonomy.data?.templates]);

  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState<ForumFilters>(DEFAULT_FORUM_FILTERS);
  const [sortTouched, setSortTouched] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [openPostId, setOpenPostId] = useState<string | null>(initialPostId);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<ForumPost | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const view = resolveForumView(prefs, room.id, config.data);

  /** Opening or closing a thread keeps the URL in step with what is on screen. */
  const showPost = useCallback(
    (postId: string | null) => {
      setOpenPostId(postId);
      onPostChange?.(postId);
    },
    [onPostChange],
  );

  // A deep link that changes while the forum is already open follows it.
  useEffect(() => {
    if (initialPostId && initialPostId !== openPostId) setOpenPostId(initialPostId);
  }, [initialPostId, openPostId]);

  // The moderator's default sort applies until the reader picks their own.
  useEffect(() => {
    if (sortTouched) return;
    setFilters((current) => ({ ...current, sort: view.sort }));
  }, [view.sort, sortTouched]);

  // Typing shouldn't fire a request per keystroke.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setFilters((current) => (current.search === searchInput ? current : { ...current, search: searchInput }));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  const posts = useForumPosts({
    realmId,
    roomId: room.id,
    forumId: config.data?.id,
    userId,
    filters,
    enabled: joined,
  });
  const myTags = useForumMyTags(realmId, userId);
  const mutes = useForumMutes(realmId, userId);
  useForumRealtime(room.id);

  // Auto-archive is a lazy sweep: opening the forum is when it matters.
  useEffect(() => {
    if (!joined) return;
    void archiveStaleForumPosts(realmId)
      .then((count) => {
        if (count > 0) void qc.invalidateQueries({ queryKey: forumPostsKey(room.id) });
      })
      .catch(() => {
        // A failed sweep must never break the forum itself.
      });
  }, [joined, realmId, room.id, qc]);

  // The hero collapses into the slim header once it has scrolled away.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const onScroll = () => setCollapsed(element.scrollTop > 132);
    onScroll();
    element.addEventListener("scroll", onScroll, { passive: true });
    return () => element.removeEventListener("scroll", onScroll);
  }, []);

  const tagById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags]);
  const statusById = useMemo(() => new Map(statuses.map((status) => [status.id, status])), [statuses]);
  const readIds = useMemo(
    () => new Set((posts.data?.posts ?? []).filter((post) => post.read_at).map((post) => post.id)),
    [posts.data?.posts],
  );
  const mutedPostIds = useMemo(
    () => new Set((mutes.data ?? []).filter((mute) => mute.post_id).map((mute) => mute.post_id as string)),
    [mutes.data],
  );
  const roomMuted = useMemo(
    () => (mutes.data ?? []).some((mute) => !mute.post_id && (!mute.room_id || mute.room_id === room.id)),
    [mutes.data, room.id],
  );

  const visiblePosts = useMemo(() => {
    const list = posts.data?.posts ?? [];
    return view.hideRead ? list.filter((post) => !readIds.has(post.id)) : list;
  }, [posts.data?.posts, view.hideRead, readIds]);

  const postCount24h = useMemo(() => {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    return (posts.data?.posts ?? []).filter((post) => new Date(post.created_at).getTime() >= midnight.getTime()).length;
  }, [posts.data?.posts]);

  const hasFilters =
    !!filters.search.trim() || filters.tagIds.length > 0 || !!filters.statusId || filters.archive !== "hide";

  const refreshPosts = useCallback(() => {
    void qc.invalidateQueries({ queryKey: forumPostsKey(room.id) });
  }, [qc, room.id]);

  const refreshAll = useCallback(() => {
    void qc.invalidateQueries({ queryKey: forumPostsKey(room.id) });
    void qc.invalidateQueries({ queryKey: forumTaxonomyKey(config.data?.id) });
    void qc.invalidateQueries({ queryKey: forumConfigKey(room.id) });
  }, [qc, room.id, config.data?.id]);

  const toggleTag = (tagId: string) =>
    setFilters((current) => ({
      ...current,
      tagIds: current.tagIds.includes(tagId)
        ? current.tagIds.filter((id) => id !== tagId)
        : [...current.tagIds, tagId],
    }));

  const toggleFollow = (tagId: string) => {
    void toggleForumTagFollow(tagId)
      .then((following) => {
        toast.success(following ? "Following that tag" : "No longer following that tag");
        void qc.invalidateQueries({ queryKey: ["forum-my-tags"] });
      })
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : "Couldn't change that follow"),
      );
  };

  const toggleRoomMute = (muted: boolean) => {
    if (!userId) return;
    void setForumMute({
      userId,
      realmId,
      roomId: room.id,
      postId: null,
      muted,
    })
      .then(() => {
        toast.success(muted ? `Muted #${room.name}` : `Unmuted #${room.name}`);
        void qc.invalidateQueries({ queryKey: ["forum-mutes"] });
      })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Couldn't change that mute"));
  };

  const togglePostMute = (postId: string, muted: boolean) => {
    if (!userId) return;
    void setForumMute({ userId, realmId, roomId: null, postId, muted })
      .then(() => {
        toast.success(muted ? "Thread muted" : "Thread unmuted");
        void qc.invalidateQueries({ queryKey: ["forum-mutes"] });
      })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Couldn't change that mute"));
  };

  const openSettings = () => {
    setSettingsOpen(true);
    // Customizing a forum that has no configuration row yet creates it, so the
    // tag, status and template forms have something to attach to.
    if (canModerate && !config.data?.id) {
      void forumEnsureConfig(room.id)
        .then(() => {
          void qc.invalidateQueries({ queryKey: forumConfigKey(room.id) });
        })
        .catch((error: unknown) =>
          toast.error(error instanceof Error ? error.message : "Couldn't open this forum's settings"),
        );
    }
  };

  if (!joined) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Join {realmName} to read and post in #${room.name}.
      </div>
    );
  }

  if (config.isError) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">This forum couldn't be loaded.</p>
        <Button type="button" variant="outline" onClick={() => void config.refetch()} className="h-10">
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div
      className="forum-shell relative flex min-h-0 flex-1 flex-col"
      style={{ "--forum-font-scale": String(view.fontScale) } as React.CSSProperties}
    >
      <div ref={scrollRef} className="chat-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-6 pt-3 sm:px-5">
        <ForumHero
          config={config.data ?? fallbackConfig(realmId, room, accentColor)}
          name={room.name}
          realmName={realmName}
          threadCount={posts.data?.posts.length ?? 0}
          postCount24h={postCount24h}
          canCustomize={canModerate}
          onNewPost={() => {
            setEditingPost(null);
            setComposerOpen(true);
          }}
          onCustomize={openSettings}
          muted={roomMuted}
        />

        <div className="sticky top-0 z-30 -mx-3 mt-3 sm:-mx-5">
          {collapsed && (
            <ForumSlimHeader
              config={config.data ?? fallbackConfig(realmId, room, accentColor)}
              name={room.name}
              accent={config.data?.accent_color ?? accentColor}
              canCustomize={canModerate}
              onNewPost={() => {
                setEditingPost(null);
                setComposerOpen(true);
              }}
              onCustomize={openSettings}
            />
          )}
          <ForumToolbar
            search={searchInput}
            onSearch={setSearchInput}
            sort={filters.sort}
            onSort={(sort) => {
              setSortTouched(true);
              setFilters((current) => ({ ...current, sort }));
            }}
            layout={view.layout}
            onLayout={(layout) => updatePrefs({ layout }, { roomId: room.id })}
            tags={tags}
            activeTagIds={filters.tagIds}
            onToggleTag={toggleTag}
            onClearTags={() => setFilters((current) => ({ ...current, tagIds: [] }))}
            trailing={
              <ForumViewOptions
                density={view.density}
                fontScale={view.fontScale}
                hideRead={view.hideRead}
                statuses={statuses}
                statusId={filters.statusId}
                archive={filters.archive}
                onDensity={(density) => updatePrefs({ density }, { roomId: room.id })}
                onFontScale={(fontScale) => updatePrefs({ fontScale }, { roomId: room.id })}
                onHideRead={(hideRead) => updatePrefs({ hideRead }, { roomId: room.id })}
                onStatus={(statusId) => setFilters((current) => ({ ...current, statusId }))}
                onArchive={(archive) => setFilters((current) => ({ ...current, archive }))}
                tags={tags}
                followingTags={myTags.data ?? new Set<string>()}
                onToggleFollow={toggleFollow}
                muted={roomMuted}
                onToggleMute={toggleRoomMute}
              />
            }
          />
        </div>

        <div className="mt-4">
          {posts.isLoading ? (
            <ForumPostList
              posts={[]}
              layout={view.layout}
              density={view.density}
              tagsById={tagById}
              statusesById={statusById}
              readIds={readIds}
              mutedIds={mutedPostIds}
              loading
              hasFilters={hasFilters}
              onOpen={() => undefined}
              onToggleTag={toggleTag}
              onNewPost={() => setComposerOpen(true)}
              onClearFilters={() => {
                setSearchInput("");
                setFilters({ ...DEFAULT_FORUM_FILTERS, sort: view.sort });
              }}
            />
          ) : (
            <ForumPostList
              posts={visiblePosts}
              layout={view.layout}
              density={view.density}
              tagsById={tagById}
              statusesById={statusById}
              readIds={readIds}
              mutedIds={mutedPostIds}
              hasFilters={hasFilters}
              onOpen={(post) => showPost(post.id)}
              onToggleTag={toggleTag}
              onNewPost={() => {
                setEditingPost(null);
                setComposerOpen(true);
              }}
              onClearFilters={() => {
                setSearchInput("");
                setFilters({ ...DEFAULT_FORUM_FILTERS, sort: view.sort });
              }}
            />
          )}
        </div>

        {posts.isFetching && !posts.isLoading && (
          <p className="mt-3 inline-flex items-center gap-2 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            Refreshing…
          </p>
        )}
      </div>

      {/* Writing is always one tap away, and only moderators lose the button
          when the forum is set to moderators-only. */}
      {(config.data?.post_permission !== "mods" || canModerate) && (
        <button
          type="button"
          onClick={() => {
            setEditingPost(null);
            setComposerOpen(true);
          }}
          aria-label="New thread"
          className="absolute bottom-5 right-5 z-30 grid h-12 w-12 place-items-center rounded-full border-0 bg-primary text-primary-foreground shadow-md transition-transform active:scale-95 sm:hidden"
        >
          <Plus className="h-5 w-5" />
        </button>
      )}

      {config.data && (
        <ForumComposer
          open={composerOpen}
          onOpenChange={(open) => {
            setComposerOpen(open);
            if (!open) setEditingPost(null);
          }}
          config={config.data}
          tags={tags}
          statuses={statuses}
          templates={templates}
          userId={userId}
          post={editingPost}
          canModerate={canModerate}
          onSaved={(newPostId) => {
            refreshPosts();
            if (newPostId) {
              showPost(newPostId);
            }
          }}
        />
      )}

      {config.data && (
        <ForumPostView
          open={!!openPostId}
          postId={openPostId}
          config={config.data}
          tags={tags}
          statuses={statuses}
          userId={userId}
          canModerate={canModerate}
          realmName={realmName}
          muted={!!openPostId && mutedPostIds.has(openPostId)}
          onClose={() => showPost(null)}
          onEdit={(post) => {
            setEditingPost(post);
            setComposerOpen(true);
            showPost(null);
          }}
          onChanged={refreshPosts}
          onToggleMute={(muted) => {
            if (openPostId) togglePostMute(openPostId, muted);
          }}
        />
      )}

      {config.data && (
        <ForumSettingsSheet
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          config={config.data}
          tags={tags}
          statuses={statuses}
          templates={templates}
          realmName={realmName}
          roomId={room.id}
          roomName={room.name}
          userId={userId}
          canModerate={canModerate}
          onSaved={refreshAll}
        />
      )}
    </div>
  );
}

/**
 * What to draw while the config row is loading, or for a forum channel whose row
 * has not been created yet: the same defaults the server applies.
 */
function fallbackConfig(realmId: string, room: RealmRoom, accentColor: string | null): ForumConfig {
  return {
    ...emptyForumConfig(realmId, room.id),
    accent_color: accentColor,
    description: room.topic ?? null,
  };
}
