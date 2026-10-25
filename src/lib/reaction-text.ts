/**
 * Pure reaction text/layout helpers. Kept free of Supabase imports so they can
 * be unit-tested in plain Node.
 */

/**
 * "jimmy, ana and 3 others reacted" — names only when they add information.
 * At most three names are shown, with "You" already substituted by the caller.
 */
export function describeReactors(names: string[], total: number): string {
  if (total <= 0) return "No reactions yet";
  const cleaned = [...new Set(names.filter((name) => !!name && !!name.trim()))];
  // Never claim more names than the item has reactions.
  const unique = cleaned.slice(0, Math.min(3, total));
  if (unique.length === 0) return total === 1 ? "1 reaction" : `${total} reactions`;
  const others = Math.max(0, total - unique.length);
  if (others === 0) {
    const list =
      unique.length === 1
        ? unique[0]
        : `${unique.slice(0, -1).join(", ")} and ${unique[unique.length - 1]}`;
    return `${list} reacted`;
  }
  // With a tail count, commas read better than a second "and".
  return `${unique.join(", ")} and ${others} other${others === 1 ? "" : "s"} reacted`;
}

/** Chips read the way Discord sorts them: most used first, then oldest. */
export function sortReactionGroups<T extends { emoji: string; count: number; firstAt?: string | null }>(
  groups: T[],
): T[] {
  return [...groups].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (a.firstAt && b.firstAt) return a.firstAt.localeCompare(b.firstAt);
    return a.emoji.localeCompare(b.emoji);
  });
}
