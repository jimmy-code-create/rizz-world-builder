import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { Badge } from "@/lib/badges";
import type { RealmRole } from "@/lib/realm-roles";
import type { ForumDensity, ForumLayout, ForumSort } from "@/lib/forum-prefs";
import type { ForumTemplateField } from "@/lib/forum-content";
import { subscribeSafely } from "@/lib/realtime";

/**
 * Forums: one channel kind inside a realm, with its own tags, statuses,
 * templates and moderation rules.
 *
 * Every write that carries a rule (permission, slowmode, lock, required tag,
 * template fields, archive) is a SECURITY DEFINER RPC, so this module is a typed
 * client and never the gate. Reads are plain PostgREST selects with the author
 * joined in, because a thread list is one round trip.
 */

// ------------------------------------------------------------------ types
export type ForumConfig = {
  id: string | null;
  realm_id: string;
  room_id: string;
  banner_url: string | null;
  icon_emoji: string | null;
  accent_color: string | null;
  description: string | null;
  guidelines: string | null;
  guidelines_post_id: string | null;
  default_layout: ForumLayout;
  default_sort: ForumSort;
  default_density: ForumDensity;
  require_tag: boolean;
  allowed_attachments: string[];
  reactions: string[];
  slowmode_seconds: number;
  post_permission: "everyone" | "mods";
  reply_permission: "everyone" | "mods";
  auto_archive_days: number | null;
};

export type ForumTag = {
  id: string;
  forum_id: string;
  name: string;
  color: string;
  emoji: string | null;
};

export type ForumStatus = {
  id: string;
  forum_id: string;
  name: string;
  color: string;
  emoji: string | null;
  position: number;
  is_default: boolean;
  is_closed: boolean;
};

export type ForumTemplate = {
  id: string;
  forum_id: string;
  name: string;
  emoji: string | null;
  description: string | null;
  fields: ForumTemplateField[];
  position: number;
};

/** The forum reuses the app's own badge chips, so it reads the same rows. */
export type ForumBadge = Badge;

export type ForumAuthor = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  accent_color: string | null;
  created_at: string | null;
  role: RealmRole | null;
  badges: ForumBadge[];
};

export type ForumPost = {
  id: string;
  forum_id: string;
  realm_id: string;
  room_id: string;
  author_id: string;
  title: string;
  body: string;
  cover_url: string | null;
  attachments: string[];
  tag_ids: string[];
  status_id: string | null;
  template_id: string | null;
  fields: Record<string, string>;
  is_pinned: boolean;
  is_locked: boolean;
  is_solved: boolean;
  best_reply_id: string | null;
  reply_count: number;
  like_count: number;
  view_count: number;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
  edited_at: string | null;
  archived_at: string | null;
  author: Omit<ForumAuthor, "role" | "badges"> | null;
  /** Filled in by the query, not by the database. */
  status?: ForumStatus | null;
  recent_repliers?: ForumReplier[];
  reactions?: ForumReactionChip[];
  liked?: boolean;
  read_at?: string | null;
};

export type ForumReplier = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export type ForumReply = {
  id: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  body: string;
  like_count: number;
  created_at: string;
  updated_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  author: (Omit<ForumAuthor, "role" | "badges"> & { role?: RealmRole | null }) | null;
  liked?: boolean;
  reactions?: ForumReactionChip[];
};

export type ForumReactionChip = {
  emoji: string;
  count: number;
  mine: boolean;
};

export type ForumMute = {
  id: string;
  realm_id: string;
  room_id: string | null;
  post_id: string | null;
};

export type ForumFilters = {
  search: string;
  sort: ForumSort;
  tagIds: string[];
  statusId: string | null;
  /** "" hides archived threads, "only" shows just them, "all" shows both. */
  archive: "hide" | "only" | "all";
  hideRead: boolean;
};

export const DEFAULT_FORUM_FILTERS: ForumFilters = {
  search: "",
  sort: "activity",
  tagIds: [],
  statusId: null,
  archive: "hide",
  hideRead: false,
};

export function emptyForumConfig(realmId: string, roomId: string): ForumConfig {
  return {
    id: null,
    realm_id: realmId,
    room_id: roomId,
    banner_url: null,
    icon_emoji: "🗂️",
    accent_color: null,
    description: null,
    guidelines: null,
    guidelines_post_id: null,
    default_layout: "card",
    default_sort: "activity",
    default_density: "comfortable",
    require_tag: false,
    allowed_attachments: ["image"],
    reactions: ["👍", "❤️", "🔥", "😂", "🎉", "👀"],
    slowmode_seconds: 0,
    post_permission: "everyone",
    reply_permission: "everyone",
    auto_archive_days: null,
  };
}

const POST_AUTHOR = "author:profiles!realm_forum_posts_author_id_fkey(id,username,display_name,avatar_url,accent_color,created_at)";
const REPLY_AUTHOR = "author:profiles!realm_forum_replies_author_id_fkey(id,username,display_name,avatar_url,accent_color,created_at)";

// ------------------------------------------------------------------ keys
export const forumConfigKey = (roomId: string | null | undefined) => ["forum-config", roomId ?? ""] as const;
export const forumTaxonomyKey = (forumId: string | null | undefined) => ["forum-taxonomy", forumId ?? ""] as const;
export const forumPostsKey = (roomId: string | null | undefined) => ["forum-posts", roomId ?? ""] as const;
export const forumThreadKey = (postId: string | null | undefined) => ["forum-thread", postId ?? ""] as const;
export const forumMyTagsKey = (realmId: string | null | undefined, userId: string | null | undefined) =>
  ["forum-my-tags", realmId ?? "", userId ?? ""] as const;
export const forumMutesKey = (realmId: string | null | undefined, userId: string | null | undefined) =>
  ["forum-mutes", realmId ?? "", userId ?? ""] as const;
export const forumRolesKey = (realmId: string | null | undefined) => ["forum-roles", realmId ?? ""] as const;

// ------------------------------------------------------------------ reads
export async function fetchForumConfig(realmId: string, roomId: string): Promise<ForumConfig> {
  const { data, error } = await (supabase.from as any)("realm_forums")
    .select("*")
    .eq("room_id", roomId)
    .maybeSingle();
  // A forum channel that has no configuration row yet is normal — it just means
  // nobody has opened the customization screen. Defaults keep it usable.
  if (error) throw error;
  if (!data) return emptyForumConfig(realmId, roomId);
  const row = data as Partial<ForumConfig>;
  return {
    ...emptyForumConfig(realmId, roomId),
    ...row,
    id: (row.id as string) ?? null,
    default_layout: (row.default_layout as ForumLayout) ?? "card",
    default_sort: (row.default_sort as ForumSort) ?? "activity",
    default_density: (row.default_density as ForumDensity) ?? "comfortable",
    allowed_attachments: (row.allowed_attachments as string[]) ?? ["image"],
    reactions: (row.reactions as string[]) ?? [],
  };
}

export function useForumConfig(realmId: string | null | undefined, roomId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: forumConfigKey(roomId),
    enabled: enabled && !!realmId && !!roomId,
    staleTime: 30_000,
    queryFn: () => fetchForumConfig(realmId!, roomId!),
  });
}

function parseTemplateFields(value: Json): ForumTemplateField[] {
  if (!Array.isArray(value)) return [];
  const fields: ForumTemplateField[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    const label = typeof record.label === "string" ? record.label.trim() : "";
    if (!label) continue;
    fields.push({
      label,
      placeholder: typeof record.placeholder === "string" ? record.placeholder : undefined,
      required: record.required === true,
    });
  }
  return fields;
}

export async function fetchForumTaxonomy(forumId: string | null | undefined): Promise<{
  tags: ForumTag[];
  statuses: ForumStatus[];
  templates: ForumTemplate[];
}> {
  if (!forumId) return { tags: [], statuses: [], templates: [] };
  const [tags, statuses, templates] = await Promise.all([
    (supabase.from as any)("realm_forum_tags").select("*").eq("forum_id", forumId).order("position").order("created_at"),
    (supabase.from as any)("realm_forum_statuses").select("*").eq("forum_id", forumId).order("position").order("created_at"),
    (supabase.from as any)("realm_forum_templates").select("*").eq("forum_id", forumId).order("position").order("created_at"),
  ]);
  if (tags.error) throw tags.error;
  if (statuses.error) throw statuses.error;
  if (templates.error) throw templates.error;
  // `fields` arrives as JSON and leaves as a typed list of labels.
  type TemplateRow = Omit<ForumTemplate, "fields"> & { fields: Json };
  return {
    tags: (tags.data ?? []) as ForumTag[],
    statuses: (statuses.data ?? []) as ForumStatus[],
    templates: ((templates.data ?? []) as unknown as TemplateRow[]).map((row) => ({
      ...row,
      fields: parseTemplateFields(row.fields),
    })),
  };
}

export function useForumTaxonomy(forumId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: forumTaxonomyKey(forumId),
    enabled: enabled && !!forumId,
    staleTime: 30_000,
    queryFn: () => fetchForumTaxonomy(forumId),
  });
}

/** Who replied recently, so a card can show their faces. */
async function fetchRecentRepliers(postIds: string[]): Promise<Map<string, ForumReplier[]>> {
  const map = new Map<string, ForumReplier[]>();
  if (postIds.length === 0) return map;
  const { data, error } = await (supabase.from as any)("realm_forum_replies")
    .select(`post_id, author_id, created_at, ${REPLY_AUTHOR}`)
    .in("post_id", postIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(400);
  if (error) throw error;
  for (const row of (data ?? []) as { post_id: string; author: ForumReplier | null }[]) {
    const author = row.author;
    if (!author) continue;
    const list = map.get(row.post_id) ?? [];
    if (list.some((person) => person.id === author.id)) continue;
    if (list.length >= 4) continue;
    list.push(author);
    map.set(row.post_id, list);
  }
  return map;
}

async function fetchMyPostState(userId: string | null, postIds: string[]) {
  const liked = new Set<string>();
  const readAt = new Map<string, string>();
  const reactions = new Map<string, ForumReactionChip[]>();
  if (!userId || postIds.length === 0) return { liked, readAt, reactions };

  const [likes, reads, chips] = await Promise.all([
    (supabase.from as any)("realm_forum_likes").select("post_id").eq("user_id", userId).in("post_id", postIds),
    (supabase.from as any)("realm_forum_reads").select("post_id,last_seen_at").eq("user_id", userId).in("post_id", postIds),
    (supabase.from as any)("realm_forum_reactions").select("post_id,emoji,user_id").in("post_id", postIds),
  ]);
  if (likes.error) throw likes.error;
  if (reads.error) throw reads.error;
  if (chips.error) throw chips.error;

  for (const row of (likes.data ?? []) as { post_id: string }[]) liked.add(row.post_id);
  for (const row of (reads.data ?? []) as { post_id: string; last_seen_at: string }[]) {
    readAt.set(row.post_id, row.last_seen_at);
  }
  const counts = new Map<string, Map<string, { count: number; mine: boolean }>>();
  for (const row of (chips.data ?? []) as { post_id: string; emoji: string; user_id: string }[]) {
    const perPost = counts.get(row.post_id) ?? new Map();
    const entry = perPost.get(row.emoji) ?? { count: 0, mine: false };
    entry.count += 1;
    if (row.user_id === userId) entry.mine = true;
    perPost.set(row.emoji, entry);
    counts.set(row.post_id, perPost);
  }
  for (const [postId, perPost] of counts) {
    reactions.set(
      postId,
      [...perPost.entries()].map(([emoji, entry]) => ({ emoji, count: entry.count, mine: entry.mine })),
    );
  }
  return { liked, readAt, reactions };
}

export type ForumQueryResult = {
  posts: ForumPost[];
  /** Threads the reader has already opened, so "hide read" can hold them back. */
  readIds: Set<string>;
  counts: { pinned: number; solved: number; unanswered: number; archived: number };
};

/**
 * The forum's thread list. Search, tag, status and archive filters run in the
 * database; "hide read" is applied here because read state lives per reader and
 * the list is already in memory.
 */
export async function fetchForumPosts(input: {
  realmId: string;
  roomId: string;
  forumId: string | null;
  userId: string | null;
  filters: ForumFilters;
  limit?: number;
}): Promise<ForumQueryResult> {
  const { filters } = input;
  let query = (supabase.from as any)("realm_forum_posts")
    .select(`*, ${POST_AUTHOR}`)
    .eq("room_id", input.roomId)
    .is("deleted_at", null);

  if (filters.archive === "hide") query = query.is("archived_at", null);
  if (filters.archive === "only") query = query.not("archived_at", "is", null);
  if (filters.statusId) query = query.eq("status_id", filters.statusId);
  if (filters.tagIds.length > 0) query = query.overlaps("tag_ids", filters.tagIds);
  if (filters.sort === "unanswered") query = query.eq("reply_count", 0);
  const search = filters.search.trim();
  if (search) {
    const safe = search.replace(/[%,()]/g, " ").trim();
    if (safe) query = query.or(`title.ilike.%${safe}%,body.ilike.%${safe}%`);
  }

  const sortColumn =
    filters.sort === "new" ? "created_at" : filters.sort === "top" ? "like_count" : "last_activity_at";
  const { data, error } = await query
    .order("is_pinned", { ascending: false })
    .order(sortColumn, { ascending: false })
    .limit(input.limit ?? 60);
  if (error) throw error;

  const posts = (data ?? []) as ForumPost[];
  const postIds = posts.map((post) => post.id);
  const [repliers, mine] = await Promise.all([
    fetchRecentRepliers(postIds),
    fetchMyPostState(input.userId, postIds),
  ]);

  const withState: ForumPost[] = posts.map((post) => {
    const readAt = mine.readAt.get(post.id) ?? null;
    const hasNewReplies = !!readAt && new Date(post.last_activity_at).getTime() > new Date(readAt).getTime();
    return {
      ...post,
      author: (post.author ?? null) as ForumPost["author"],
      recent_repliers: repliers.get(post.id) ?? [],
      liked: mine.liked.has(post.id),
      read_at: hasNewReplies ? null : readAt,
      reactions: mine.reactions.get(post.id) ?? [],
    } as ForumPost;
  });

  const readIds = new Set(withState.filter((post) => post.read_at).map((post) => post.id));
  const all = await (supabase.from as any)("realm_forum_posts")
    .select("id,is_pinned,is_solved,reply_count,archived_at")
    .eq("room_id", input.roomId)
    .is("deleted_at", null);
  const counts = { pinned: 0, solved: 0, unanswered: 0, archived: 0 };
  for (const row of (all.data ?? []) as {
    is_pinned: boolean;
    is_solved: boolean;
    reply_count: number;
    archived_at: string | null;
  }[]) {
    if (row.is_pinned) counts.pinned += 1;
    if (row.is_solved) counts.solved += 1;
    if (row.reply_count === 0) counts.unanswered += 1;
    if (row.archived_at) counts.archived += 1;
  }

  return { posts: withState, readIds, counts };
}

export function useForumPosts(input: {
  realmId: string | null | undefined;
  roomId: string | null | undefined;
  forumId: string | null | undefined;
  userId: string | null | undefined;
  filters: ForumFilters;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: [...forumPostsKey(input.roomId), input.userId ?? "", JSON.stringify(input.filters)],
    enabled: (input.enabled ?? true) && !!input.realmId && !!input.roomId && !!input.forumId,
    staleTime: 15_000,
    queryFn: () =>
      fetchForumPosts({
        realmId: input.realmId!,
        roomId: input.roomId!,
        forumId: input.forumId ?? null,
        userId: input.userId ?? null,
        filters: input.filters,
      }),
  });
}

async function fetchMyReplyLikes(userId: string | null, replyIds: string[]) {
  const liked = new Set<string>();
  const reactions = new Map<string, ForumReactionChip[]>();
  if (!userId || replyIds.length === 0) return { liked, reactions };

  const [likes, chips] = await Promise.all([
    (supabase.from as any)("realm_forum_reply_likes").select("reply_id").eq("user_id", userId).in("reply_id", replyIds),
    (supabase.from as any)("realm_forum_reply_reactions").select("reply_id,emoji,user_id").in("reply_id", replyIds),
  ]);
  if (likes.error) throw likes.error;
  if (chips.error) throw chips.error;

  for (const row of (likes.data ?? []) as { reply_id: string }[]) liked.add(row.reply_id);
  const counts = new Map<string, Map<string, { count: number; mine: boolean }>>();
  for (const row of (chips.data ?? []) as { reply_id: string; emoji: string; user_id: string }[]) {
    const perReply = counts.get(row.reply_id) ?? new Map();
    const entry = perReply.get(row.emoji) ?? { count: 0, mine: false };
    entry.count += 1;
    if (row.user_id === userId) entry.mine = true;
    perReply.set(row.emoji, entry);
    counts.set(row.reply_id, perReply);
  }
  for (const [replyId, perReply] of counts) {
    reactions.set(
      replyId,
      [...perReply.entries()].map(([emoji, entry]) => ({ emoji, count: entry.count, mine: entry.mine })),
    );
  }
  return { liked, reactions };
}

export async function fetchForumThread(
  postId: string,
  userId: string | null,
): Promise<{ post: ForumPost; replies: ForumReply[] }> {
  const [postResult, replyResult] = await Promise.all([
    (supabase.from as any)("realm_forum_posts").select(`*, ${POST_AUTHOR}`).eq("id", postId).maybeSingle(),
    (supabase.from as any)("realm_forum_replies")
      .select(`*, ${REPLY_AUTHOR}`)
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
      .limit(300),
  ]);
  if (postResult.error) throw postResult.error;
  if (replyResult.error) throw replyResult.error;
  if (!postResult.data) throw new Error("That thread is gone");

  const post = postResult.data as ForumPost;
  const replies = (replyResult.data ?? []) as ForumReply[];
  const [mine, replyLikes] = await Promise.all([
    fetchMyPostState(userId, [post.id]),
    fetchMyReplyLikes(userId, replies.map((reply) => reply.id)),
  ]);

  return {
    post: {
      ...post,
      liked: mine.liked.has(post.id),
      read_at: mine.readAt.get(post.id) ?? null,
      reactions: mine.reactions.get(post.id) ?? [],
    },
    replies: replies.map((reply) => ({
      ...reply,
      liked: replyLikes.liked.has(reply.id),
      reactions: replyLikes.reactions.get(reply.id) ?? [],
    })),
  };
}

export function useForumThread(postId: string | null | undefined, userId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: [...forumThreadKey(postId), userId ?? ""],
    enabled: enabled && !!postId,
    staleTime: 5_000,
    queryFn: () => fetchForumThread(postId!, userId ?? null),
  });
}

/** Every tag this reader follows. The container matches them against the forum
 *  on screen, so one query answers for every forum. */
export async function fetchForumMyTags(userId: string): Promise<Set<string>> {
  const { data, error } = await (supabase.from as any)("realm_forum_tag_follows")
    .select("tag_id")
    .eq("user_id", userId);
  if (error) throw error;
  return new Set((data ?? []).map((row: { tag_id: string }) => row.tag_id));
}

export function useForumMyTags(realmId: string | null | undefined, userId: string | null | undefined) {
  return useQuery({
    queryKey: forumMyTagsKey(realmId, userId),
    enabled: !!realmId && !!userId,
    staleTime: 60_000,
    queryFn: () => fetchForumMyTags(userId!),
  });
}

export async function fetchForumMutes(realmId: string, userId: string): Promise<ForumMute[]> {
  const { data, error } = await (supabase.from as any)("realm_forum_mutes")
    .select("id,realm_id,room_id,post_id")
    .eq("realm_id", realmId)
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []) as ForumMute[];
}

export function useForumMutes(realmId: string | null | undefined, userId: string | null | undefined) {
  return useQuery({
    queryKey: forumMutesKey(realmId, userId),
    enabled: !!realmId && !!userId,
    staleTime: 60_000,
    queryFn: () => fetchForumMutes(realmId!, userId!),
  });
}

/** A mute row covers the whole realm, one forum channel, or one thread. */
export function forumMuteState(
  mutes: ForumMute[],
  target: { roomId?: string | null; postId?: string | null },
): { anyMute: boolean; realm: ForumMute | null; room: ForumMute | null; post: ForumMute | null } {
  const realm = mutes.find((mute) => !mute.room_id && !mute.post_id) ?? null;
  const room = mutes.find((mute) => mute.room_id && !mute.post_id && mute.room_id === target.roomId) ?? null;
  const post = mutes.find((mute) => mute.post_id && mute.post_id === target.postId) ?? null;
  return { anyMute: !!realm || !!room || !!post, realm, room, post };
}

/** Author roles, so reply names can carry the realm's role colour. */
export async function fetchForumMemberRoles(realmId: string): Promise<Map<string, RealmRole>> {
  const { data, error } = await (supabase.from as any)("realm_members")
    .select("user_id,role")
    .eq("realm_id", realmId);
  if (error) return new Map();
  const roles = new Map<string, RealmRole>();
  for (const row of (data ?? []) as { user_id: string; role: RealmRole }[]) roles.set(row.user_id, row.role);
  return roles;
}

export function useForumMemberRoles(realmId: string | null | undefined) {
  return useQuery({
    queryKey: forumRolesKey(realmId),
    enabled: !!realmId,
    staleTime: 120_000,
    queryFn: () => fetchForumMemberRoles(realmId!),
  });
}

export async function fetchForumAuthorBadges(userIds: string[]): Promise<Map<string, ForumBadge[]>> {
  const map = new Map<string, ForumBadge[]>();
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return map;
  const { data, error } = await supabase
    .from("user_badges")
    .select("user_id, badges!inner(id,slug,name,description,icon,color,rarity)")
    .in("user_id", ids);
  if (error) return map;
  for (const row of (data ?? []) as unknown as { user_id: string; badges: ForumBadge }[]) {
    if (!row.badges) continue;
    const list = map.get(row.user_id) ?? [];
    list.push(row.badges);
    map.set(row.user_id, list);
  }
  return map;
}

// ------------------------------------------------------------------ realtime
/** Threads appear, move and change live — `realtime.subscribe` is the shared,
 *  throw-proof subscribe the chat uses. */
export function useForumRealtime(roomId: string | null | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`forum-posts-${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "realm_forum_posts", filter: `room_id=eq.${roomId}` },
        () => {
          void qc.invalidateQueries({ queryKey: forumPostsKey(roomId) });
          void qc.invalidateQueries({ queryKey: ["forum-thread"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "realm_forum_replies" },
        () => {
          void qc.invalidateQueries({ queryKey: forumPostsKey(roomId) });
        },
      );
    subscribeSafely(channel);
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, qc]);
}

export function useForumThreadRealtime(postId: string | null | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!postId) return;
    const channel = supabase
      .channel(`forum-thread-${postId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "realm_forum_replies", filter: `post_id=eq.${postId}` },
        () => {
          void qc.invalidateQueries({ queryKey: forumThreadKey(postId) });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "realm_forum_posts", filter: `id=eq.${postId}` },
        () => {
          void qc.invalidateQueries({ queryKey: forumThreadKey(postId) });
        },
      );
    subscribeSafely(channel);
    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId, qc]);
}

// ------------------------------------------------------------------ helpers
function unwrap(data: unknown, fallback: string): Record<string, unknown> {
  const payload = (data ?? {}) as Record<string, unknown>;
  if (payload.ok === false) {
    throw new Error(typeof payload.error === "string" ? payload.error : fallback);
  }
  return payload;
}

async function call(name: string, args: Record<string, unknown>, fallback: string) {
  const { data, error } = await (supabase.rpc as any)(name, args);
  if (error) throw new Error(error.message || fallback);
  return unwrap(data, fallback);
}

// ------------------------------------------------------------------ writes
export async function forumEnsureConfig(roomId: string): Promise<string> {
  const { data, error } = await (supabase.rpc as any)("forum_ensure_config", { _room_id: roomId });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function forumSaveSettings(roomId: string, settings: Partial<ForumConfig>): Promise<void> {
  await call("forum_save_settings", { _room_id: roomId, _settings: settings }, "Couldn't save the forum");
}

export async function createForumPost(input: {
  roomId: string;
  title: string;
  body: string;
  tagIds: string[];
  statusId: string | null;
  templateId: string | null;
  fields: Record<string, string>;
  coverUrl: string | null;
  attachments: string[];
  asGuidelines?: boolean;
}): Promise<string> {
  const payload = await call(
    "forum_create_post",
    {
      _room_id: input.roomId,
      _title: input.title,
      _body: input.body,
      _tag_ids: input.tagIds,
      _status_id: input.statusId,
      _template_id: input.templateId,
      _fields: input.fields,
      _cover_url: input.coverUrl,
      _attachments: input.attachments,
      _as_guidelines: input.asGuidelines === true,
    },
    "Couldn't publish that thread",
  );
  return payload.id as string;
}

export async function updateForumPost(input: {
  postId: string;
  title: string;
  body: string;
  tagIds: string[];
  statusId: string | null;
  fields: Record<string, string>;
  coverUrl: string | null;
  attachments: string[];
}): Promise<void> {
  await call(
    "forum_update_post",
    {
      _post_id: input.postId,
      _title: input.title,
      _body: input.body,
      _tag_ids: input.tagIds,
      _status_id: input.statusId,
      _fields: input.fields,
      _cover_url: input.coverUrl,
      _attachments: input.attachments,
    },
    "Couldn't save those changes",
  );
}

export async function deleteForumPost(postId: string): Promise<void> {
  await call("forum_delete_post", { _post_id: postId }, "Couldn't delete that thread");
}

export async function createForumReply(input: { postId: string; body: string; parentId?: string | null }): Promise<string> {
  const payload = await call(
    "forum_create_reply",
    { _post_id: input.postId, _body: input.body, _parent_id: input.parentId ?? null },
    "Couldn't post that reply",
  );
  return payload.id as string;
}

export async function deleteForumReply(replyId: string): Promise<void> {
  await call("forum_delete_reply", { _reply_id: replyId }, "Couldn't delete that reply");
}

export async function toggleForumLike(postId: string): Promise<{ liked: boolean; like_count: number }> {
  const payload = await call("forum_toggle_like", { _post_id: postId }, "Couldn't update that like");
  return { liked: payload.liked === true, like_count: Number(payload.like_count ?? 0) };
}

export async function toggleForumReplyLike(replyId: string): Promise<{ liked: boolean; like_count: number }> {
  const payload = await call("forum_toggle_reply_like", { _reply_id: replyId }, "Couldn't update that like");
  return { liked: payload.liked === true, like_count: Number(payload.like_count ?? 0) };
}

export async function toggleForumReaction(postId: string, emoji: string): Promise<ForumReactionChip> {
  const payload = await call("forum_toggle_reaction", { _post_id: postId, _emoji: emoji }, "Couldn't react to that");
  return { emoji: String(payload.emoji ?? emoji), count: Number(payload.count ?? 0), mine: payload.mine === true };
}

export async function toggleForumReplyReaction(replyId: string, emoji: string): Promise<ForumReactionChip> {
  const payload = await call(
    "forum_toggle_reply_reaction",
    { _reply_id: replyId, _emoji: emoji },
    "Couldn't react to that reply",
  );
  return { emoji: String(payload.emoji ?? emoji), count: Number(payload.count ?? 0), mine: payload.mine === true };
}

export async function markForumPostRead(postId: string): Promise<void> {
  await call("forum_mark_read", { _post_id: postId }, "Couldn't remember that you read this");
}

export async function setForumBestAnswer(postId: string, replyId: string | null): Promise<void> {
  await call(
    "forum_set_best_answer",
    { _post_id: postId, _reply_id: replyId },
    "Couldn't mark the best answer",
  );
}

export type ForumModerationAction =
  | "pin"
  | "unpin"
  | "lock"
  | "unlock"
  | "solve"
  | "unsolve"
  | "archive"
  | "unarchive";

export async function moderateForumPost(postId: string, action: ForumModerationAction): Promise<void> {
  await call("forum_moderate_post", { _post_id: postId, _action: action }, "Couldn't do that");
}

export async function archiveStaleForumPosts(realmId: string): Promise<number> {
  const { data, error } = await (supabase.rpc as any)("forum_archive_stale", { _realm_id: realmId });
  if (error) return 0;
  return Number(data ?? 0);
}

export async function toggleForumTagFollow(tagId: string): Promise<boolean> {
  const payload = await call("forum_toggle_tag_follow", { _tag_id: tagId }, "Couldn't follow that tag");
  return payload.following === true;
}

/** Muting is one row per target: the whole realm, one forum, or one thread. */
export async function setForumMute(input: {
  userId: string;
  realmId: string;
  roomId: string | null;
  postId: string | null;
  muted: boolean;
}): Promise<void> {
  if (input.muted) {
    const { error } = await (supabase.from as any)("realm_forum_mutes").insert({
      user_id: input.userId,
      realm_id: input.realmId,
      room_id: input.roomId,
      post_id: input.postId,
    });
    if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message);
    return;
  }
  let query = (supabase.from as any)("realm_forum_mutes")
    .delete()
    .eq("user_id", input.userId)
    .eq("realm_id", input.realmId);
  query = input.roomId ? query.eq("room_id", input.roomId) : query.is("room_id", null);
  query = input.postId ? query.eq("post_id", input.postId) : query.is("post_id", null);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

/**
 * Uploads one attachment into the app's existing public `post-media` bucket.
 *
 * The forum does not get its own bucket on purpose: media already lives in one
 * place, and the storage policy that lets a signed-in member write their own
 * prefix is the same policy that guards the feed.
 */
export async function uploadForumAttachment(input: { userId: string; file: File }): Promise<string> {
  const MAX_BYTES = 50 * 1024 * 1024;
  if (input.file.size === 0) throw new Error("That file is empty. Pick another one.");
  if (input.file.size > MAX_BYTES) {
    throw new Error(`That file is ${(input.file.size / 1024 / 1024).toFixed(1)}MB — the limit is 50MB.`);
  }
  const rawExt = (input.file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6) || "bin";
  const path = `${input.userId}/forum-${Date.now()}-${crypto.randomUUID()}.${rawExt}`;
  const { error } = await supabase.storage
    .from("post-media")
    .upload(path, input.file, { contentType: input.file.type || undefined, upsert: false });
  if (error) {
    const message = error.message || "";
    if (/exceeded|too large|payload/i.test(message)) throw new Error("That upload is too large. Compress it and retry.");
    if (/permission|unauth|forbidden|rls/i.test(message)) throw new Error("You're not signed in. Sign back in and try again.");
    throw new Error(`Upload failed: ${message}`);
  }
  const { data } = supabase.storage.from("post-media").getPublicUrl(path);
  const url = data?.publicUrl ?? null;
  if (!url || !/^https?:\/\//i.test(url)) {
    await supabase.storage.from("post-media").remove([path]);
    throw new Error("The upload finished but no public URL came back. Please try again.");
  }
  return url;
}

/** Which of the forum's allowed attachment kinds a file belongs to. */
export function attachmentKind(file: File): "image" | "video" | "audio" | "file" {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "file";
}

// ------------------------------------------------------- admin: tags, statuses, templates
export async function saveForumTag(input: {
  id?: string;
  forumId: string;
  name: string;
  color: string;
  emoji: string | null;
  position: number;
}): Promise<void> {
  if (input.id) {
    const { error } = await (supabase.from as any)("realm_forum_tags")
      .update({ name: input.name, color: input.color, emoji: input.emoji })
      .eq("id", input.id);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await (supabase.from as any)("realm_forum_tags").insert({
    forum_id: input.forumId,
    name: input.name,
    color: input.color,
    emoji: input.emoji,
    position: input.position,
  });
  if (error) throw new Error(error.message);
}

export async function deleteForumTag(tagId: string): Promise<void> {
  const { error } = await (supabase.from as any)("realm_forum_tags").delete().eq("id", tagId);
  if (error) throw new Error(error.message);
}

export async function saveForumStatus(input: {
  id?: string;
  forumId: string;
  name: string;
  color: string;
  emoji: string | null;
  position: number;
  isDefault: boolean;
  isClosed: boolean;
}): Promise<void> {
  if (input.isDefault) {
    const cleared = await (supabase.from as any)("realm_forum_statuses")
      .update({ is_default: false })
      .eq("forum_id", input.forumId);
    if (cleared.error) throw new Error(cleared.error.message);
  }
  if (input.id) {
    const { error } = await (supabase.from as any)("realm_forum_statuses")
      .update({
        name: input.name,
        color: input.color,
        emoji: input.emoji,
        is_default: input.isDefault,
        is_closed: input.isClosed,
      })
      .eq("id", input.id);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await (supabase.from as any)("realm_forum_statuses").insert({
    forum_id: input.forumId,
    name: input.name,
    color: input.color,
    emoji: input.emoji,
    position: input.position,
    is_default: input.isDefault,
    is_closed: input.isClosed,
  });
  if (error) throw new Error(error.message);
}

export async function deleteForumStatus(statusId: string): Promise<void> {
  const { error } = await (supabase.from as any)("realm_forum_statuses").delete().eq("id", statusId);
  if (error) throw new Error(error.message);
}

export async function saveForumTemplate(input: {
  id?: string;
  forumId: string;
  name: string;
  emoji: string | null;
  description: string | null;
  fields: ForumTemplateField[];
  position: number;
}): Promise<void> {
  const payload = {
    name: input.name,
    emoji: input.emoji,
    description: input.description,
    fields: input.fields as unknown as Json,
  };
  if (input.id) {
    const { error } = await (supabase.from as any)("realm_forum_templates").update(payload).eq("id", input.id);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await (supabase.from as any)("realm_forum_templates").insert({
    ...payload,
    forum_id: input.forumId,
    position: input.position,
  });
  if (error) throw new Error(error.message);
}

export async function deleteForumTemplate(templateId: string): Promise<void> {
  const { error } = await (supabase.from as any)("realm_forum_templates").delete().eq("id", templateId);
  if (error) throw new Error(error.message);
}
