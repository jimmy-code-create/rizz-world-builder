/**
 * Reply depth for flat comment lists.
 *
 * Post comments are stored with a real `parent_comment_id` but they are read
 * back as one flat, chronological list. The renderers used to ask a single
 * yes/no question — "does this comment have a parent?" — and answer it with one
 * hard-coded indent, so a reply to a reply sat at exactly the same level as a
 * reply to a top-level comment and the thread had no shape past depth one.
 *
 * This walks the parent chain instead, so every renderer can indent by how
 * deep the comment actually is.
 */

export type CommentNode = {
  id: string;
  parent_comment_id?: string | null;
};

/** How deep a reply chain may get before the indent stops growing. */
export const MAX_COMMENT_INDENT_DEPTH = 6;

/** Pixel step per depth level. */
export const COMMENT_INDENT_STEP = 12;

/**
 * Depth of every comment in the list. A top-level comment is 0; a reply to it
 * is 1, and so on. A comment whose parent is missing from the list (deleted
 * parent, or a parent outside the page) counts as a top-level comment rather
 * than disappearing.
 */
export function commentDepths<T extends CommentNode>(comments: readonly T[]): Map<string, number> {
  const byId = new Map<string, T>();
  for (const comment of comments) byId.set(comment.id, comment);

  const depths = new Map<string, number>();
  const walk = (comment: T, seen: Set<string>): number => {
    const known = depths.get(comment.id);
    if (known !== undefined) return known;
    // A cycle in the data must not hang the list.
    if (seen.has(comment.id)) return 0;
    seen.add(comment.id);
    const parentId = comment.parent_comment_id;
    const parent = parentId ? byId.get(parentId) : undefined;
    const depth = parent ? Math.min(walk(parent, seen) + 1, MAX_COMMENT_INDENT_DEPTH) : 0;
    depths.set(comment.id, depth);
    return depth;
  };

  for (const comment of comments) walk(comment, new Set());
  return depths;
}

/** The margin a comment at `depth` should carry. */
export function commentIndent(depth: number): number {
  return Math.max(0, Math.min(depth, MAX_COMMENT_INDENT_DEPTH)) * COMMENT_INDENT_STEP;
}
