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

/**
 * A comment page, nested.
 *
 * The list arrives flat and chronological, which is right for the database and
 * wrong for reading: a reply could sit ten rows away from the comment it
 * answers. This groups every reply under its parent so the thread reads as a
 * conversation, while a parent that is missing from the page (deleted, or
 * outside the last hundred rows) keeps its replies instead of swallowing them.
 */
export type ThreadNode = {
  id: string;
  created_at: string;
  parent_comment_id?: string | null;
};

export type CommentTree<T extends ThreadNode> = {
  /** Top-level comments, in the surface's chosen order. */
  roots: T[];
  /** Direct replies per parent, always oldest first. */
  children: Map<string, T[]>;
  /** Every descendant below a node, so "Show 4 replies" counts the branch. */
  descendants: Map<string, number>;
  byId: Map<string, T>;
};

const chronological = <T extends ThreadNode>(a: T, b: T) =>
  a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);

/** Newest first — the "Newest" root order. */
export const newestFirst = <T extends ThreadNode>(a: T, b: T) =>
  b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id);

export function buildCommentTree<T extends ThreadNode>(
  comments: readonly T[],
  compareRoots: (a: T, b: T) => number = chronological,
): CommentTree<T> {
  const byId = new Map<string, T>();
  for (const comment of comments) byId.set(comment.id, comment);

  const children = new Map<string, T[]>();
  const roots: T[] = [];
  for (const comment of comments) {
    const parentId = comment.parent_comment_id;
    // A comment answering itself is a root, not an invisible orphan.
    const parent = parentId && parentId !== comment.id ? byId.get(parentId) : undefined;
    if (!parent) {
      roots.push(comment);
      continue;
    }
    const bucket = children.get(parent.id) ?? [];
    bucket.push(comment);
    children.set(parent.id, bucket);
  }

  for (const bucket of children.values()) bucket.sort(chronological);
  roots.sort(compareRoots);

  // A cycle in the data (A answers B, B answers A) leaves both unreachable
  // from any root, and a comment nobody renders is a comment that vanished.
  // Walk from the roots, then promote anything unreached to a root of its own.
  const reached = new Set<string>();
  const visit = (node: T) => {
    if (reached.has(node.id)) return;
    reached.add(node.id);
    for (const child of children.get(node.id) ?? []) visit(child);
  };
  for (const root of roots) visit(root);
  for (const comment of comments) {
    if (reached.has(comment.id)) continue;
    const parentId = comment.parent_comment_id;
    if (parentId) {
      const bucket = children.get(parentId);
      if (bucket) children.set(parentId, bucket.filter((child) => child.id !== comment.id));
    }
    roots.push(comment);
    visit(comment);
  }

  const descendants = new Map<string, number>();
  const count = (node: T): number => {
    const known = descendants.get(node.id);
    if (known !== undefined) return known;
    let total = 0;
    for (const child of children.get(node.id) ?? []) total += 1 + count(child);
    descendants.set(node.id, total);
    return total;
  };
  for (const comment of comments) count(comment);

  return { roots, children, descendants, byId };
}

/**
 * Which comments still deserve a row.
 *
 * A deleted comment with no surviving replies disappears entirely; one that is
 * still holding a conversation stays as a tombstone, so its replies keep the
 * branch they hang from. The callback decides what "deleted" means so the tree
 * stays independent of the row shape.
 */
export function pruneDeletedComments<T extends ThreadNode>(
  tree: CommentTree<T>,
  isDeleted: (comment: T) => boolean,
): Set<string> {
  const kept = new Set<string>();
  const walk = (node: T): boolean => {
    let keep = !isDeleted(node);
    for (const child of tree.children.get(node.id) ?? []) {
      if (walk(child)) keep = true;
    }
    if (keep) kept.add(node.id);
    return keep;
  };
  for (const root of tree.roots) walk(root);
  return kept;
}
