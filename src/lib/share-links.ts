/**
 * RIZZ permalinks inside chat messages.
 *
 * When a post or a reel is shared into a conversation the link travels in the
 * message body as `<origin>/p/<postId>`. Chat rows swap that raw URL for a real
 * card (see SharedPostCards) so a shared reel looks the same in a DM, a group
 * and a realm — one renderer, three surfaces.
 */

/** Matches a RIZZ post/reel permalink in any host (dev, preview, production). */
const POST_PERMALINK = /https?:\/\/[^\s/?#]+\/p\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;

/** Post ids referenced by a message, in the order they appear, max 3. */
export function sharedPostIds(text?: string | null): string[] {
  if (!text) return [];
  const ids: string[] = [];
  for (const match of text.matchAll(POST_PERMALINK)) {
    const id = match[1];
    if (id && !ids.includes(id)) ids.push(id);
    if (ids.length >= 3) break;
  }
  return ids;
}

/**
 * The message text without its share permalinks: the card is the real payload,
 * so printing the URL underneath as well just looks like a stray link. Lines
 * that held nothing but the link disappear; a caption keeps its own line.
 */
export function withoutShareLinks(text?: string | null): string {
  if (!text) return "";
  // Untouched when there is no permalink: ordinary messages keep their spacing.
  if (sharedPostIds(text).length === 0) return text;
  return text
    .split("\n")
    .map((line) => line.replace(POST_PERMALINK, "").trim())
    .filter((line) => line.length > 0)
    .join("\n")
    .trim();
}
