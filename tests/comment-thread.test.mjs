/**
 * Nested comments, everywhere.
 *
 * Four surfaces used to grow four different comment threads: only the
 * full-screen post sheet knew about nesting and votes, the feed card fetched
 * reactions one comment at a time, the desktop pane had no delete, and reel
 * comments were a flat list with no reply at all. They now render one section.
 * These checks hold the shape that makes that true:
 *
 *  1. `CommentSection` is the only thread: each surface mounts it, and nobody
 *     queries `post_comments` or renders a comment body on their own.
 *  2. Replies nest under the comment they answer, a deleted parent keeps its
 *     branch as a tombstone, and a cycle in the data cannot hide a comment.
 *  3. A row can be answered, voted, reacted to and deleted — soft-deleted, and
 *     only by the person who wrote it.
 *
 * Run: node tests/comment-thread.test.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let passed = 0;
async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`FAIL - ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const data = read("src/lib/comment-thread.ts");
const tree = read("src/lib/comment-tree.ts");
const section = read("src/components/comments/CommentSection.tsx");
const thread = read("src/components/comments/CommentThread.tsx");
const composer = read("src/components/comments/CommentComposer.tsx");
const body = read("src/components/comments/CommentBody.tsx");

const sheet = read("src/components/PostCommentsSheet.tsx");
const card = read("src/components/PostCard.tsx");
const side = read("src/components/FeedSideDiscussion.tsx");
const reels = read("src/routes/_app/reels.tsx");

await check("one module owns the reads, the writes and the cache keys", () => {
  assert.match(data, /export const COMMENT_PAGE = 100/);
  assert.match(data, /export function timeAgo\(/);
  assert.match(data, /export const commentKeys = \{/);
  assert.match(data, /list: \(postId: string\) => \["comments", postId\] as const/);
  assert.match(data, /export async function fetchCommentPage/);
  assert.match(data, /export async function addComment/);
  assert.match(data, /export async function softDeleteComment/);
  assert.match(data, /export async function toggleCommentLike/);
  assert.match(data, /export async function toggleCommentReaction/);
});

await check("projects without parent_comment_id / deleted_at still load", () => {
  assert.match(data, /const LEGACY_COMMENT_COLUMNS =/);
  assert.match(data, /error && \/deleted_at\|parent_comment_id\|schema cache\/i\.test/);
  assert.match(data, /\.select\(LEGACY_COMMENT_COLUMNS\)/, "the fallback query runs");
  assert.match(
    data,
    /throw new Error\("Replies need the comment setup/,
    "a reply on an old schema says what is missing instead of failing silently",
  );
});

await check("a batch of comments is two reads, not two per row", () => {
  assert.match(data, /\("comment_likes"\)[\s\S]{0,120}?\.in\("comment_id", slice\)/);
  assert.match(data, /\("comment_reactions"\)[\s\S]{0,120}?\.in\("comment_id", slice\)/);
  assert.match(data, /for \(let i = 0; i < commentIds\.length; i \+= 100\)/, "chunked for the IN limit");
  assert.ok(
    !/\bcomment_reactions["'`]\)\s*\.select\([\s\S]{0,80}?\.eq\("comment_id"/.test(section),
    "the section never asks per comment",
  );
});

await check("replies nest under the comment they answer", () => {
  assert.match(tree, /export function buildCommentTree/);
  assert.match(tree, /const bucket = children\.get\(parent\.id\) \?\? \[\];/);
  assert.match(tree, /bucket\.sort\(chronological\)/, "a branch reads oldest first");
  assert.match(tree, /roots\.sort\(compareRoots\)/, "only the roots follow the sort toggle");
  assert.match(tree, /export const newestFirst/);
});

await check("a broken parent chain cannot swallow a comment", () => {
  assert.match(tree, /parentId !== comment\.id/, "self-parented rows are roots");
  assert.match(tree, /if \(!parent\) \{\s*roots\.push\(comment\);/, "an orphan is a root, not a loss");
  assert.match(
    tree,
    /for \(const comment of comments\) \{\s*if \(reached\.has\(comment\.id\)\) continue;/,
    "a cycle is promoted out of the loop",
  );
  assert.match(tree, /descendants\.set\(node\.id, total\)/, "a branch knows how big it is");
});

await check("a deleted comment keeps the branch under it", () => {
  assert.match(tree, /export function pruneDeletedComments/);
  assert.match(tree, /let keep = !isDeleted\(node\);/);
  assert.match(tree, /if \(walk\(child\)\) keep = true;/, "a reply keeps the tombstone alive");
  assert.match(section, /pruneDeletedComments\(tree, \(comment\) => Boolean\(comment\.deleted_at\)\)/);
  assert.match(thread, /This comment was deleted\./);
  assert.match(thread, /replying to a deleted comment/);
});

await check("deleting is a soft delete, and only the author's own row", () => {
  assert.match(data, /\.update\(\{ deleted_at: new Date\(\)\.toISOString\(\) \}\)/);
  assert.match(data, /\.eq\("author_id", authorId\)/, "the author filter is part of the update");
  assert.match(thread, /const owned = signedIn && !deleted && !!myId && comment\.author_id === myId;/);
  assert.match(thread, /\{owned && \(/, "Delete only renders on your own comment");
  assert.match(section, /Delete this comment\?/, "there is a confirmation, not a one-tap mistake");
});

await check("votes and reactions update on screen first and roll back on failure", () => {
  assert.match(section, /qc\.setQueryData<CommentVotes>\(votesKey, \{ counts, mine \}\)/, "optimistic vote");
  assert.match(section, /if \(context\?\.previous\) qc\.setQueryData\(votesKey, context\.previous\)/, "vote rolls back");
  assert.match(section, /qc\.setQueryData<CommentReactionMap>\(reactionsKey, next\)/, "optimistic reaction");
  assert.match(
    section,
    /if \(context\?\.previous\) qc\.setQueryData\(reactionsKey, context\.previous\)/,
    "reaction rolls back",
  );
  assert.match(section, /placeholderData: keepPreviousData/, "a new page does not flash counts back to zero");
});

await check("the thread row offers reply, react, vote, delete and collapse", () => {
  assert.match(thread, /data-comment-vote/);
  assert.match(thread, /onClick=\{\(\) => onReply\(comment\)\}/);
  assert.match(thread, /setPickerOpen\(\(open\) => !open\)/);
  assert.match(thread, /<ReactionTray/);
  assert.match(thread, /MAX_COMMENT_INDENT_DEPTH/, "deep replies stop indenting instead of squeezing");
  assert.match(thread, /`Show \$\{branchSize\} \$\{branchSize === 1 \? "reply" : "replies"\}`/);
  assert.match(thread, /collapsed \? \(\s*<ChevronDown/, "a branch can be folded away");
});

await check("the composer keeps the draft and answers the right person", () => {
  assert.match(composer, /Replying to <span/);
  assert.match(composer, /onKeyDown=\{\(event\) => \{\s*if \(event\.key === "Enter" && !event\.shiftKey\)/);
  assert.match(composer, /if \(value\.trim\(\) && !pending\) onSend\(\);/);
  assert.match(composer, /Shift \+ Enter for a new line/);
  assert.match(composer, /Sign in to join the conversation\./, "signed-out readers get a way in");
});

await check("every surface mounts the same section", () => {
  assert.match(sheet, /<CommentSection postId=\{postId\} className="min-h-0 flex-1" \/>/);
  assert.match(card, /<CommentSection postId=\{postId\} compact showToolbar=\{false\} \/>/);
  assert.match(side, /<CommentSection postId=\{activePost\.id\} className="min-h-0 flex-1" \/>/);
  assert.match(reels, /<CommentSection[\s\S]{0,120}?postId=\{postId\}/);
  assert.match(reels, /maxLength=\{REEL_COMMENT_MAX_LENGTH\}/, "reels keep their shorter limit");
});

await check("both comment sorts are always offered", () => {
  // This used to be one button showing the *current* order, and it only
  // appeared with more than one thread — so a fresh reel looked like comments
  // had no sort at all.
  assert.match(section, /aria-label="Sort comments"/);
  assert.match(section, /\["top", "Top voted"\]/);
  assert.match(section, /\["new", "Newest"\]/);
  assert.match(section, /aria-pressed=\{sort === id\}/);
  assert.ok(!/rootCount > 1 && \(/.test(section), "the sort control must not hide");
  assert.ok(!section.includes("ArrowDownUp"), "the old flip button is gone");
});

await check("no surface grew its own comment list back", () => {
  for (const [name, source] of [
    ["post card", card],
    ["post sheet", sheet],
    ["side discussion", side],
    ["reels", reels],
  ]) {
    assert.ok(
      !/from\("post_comments"\)/.test(source),
      `${name} must read comments through the shared layer`,
    );
    assert.ok(
      !/commentDepths|commentIndent/.test(source),
      `${name} must not hand-roll indentation again`,
    );
  }
  assert.ok(!/function CommentsThread\(\{ postId \}\)[\s\S]{0,200}?fetchComments/.test(card));
});

await check("a comment body keeps mentions, tags, links and GIFs", () => {
  assert.match(body, /export function CommentBody\(\{ body \}: \{ body: string \}\)/);
  assert.match(body, /renderGifSegments\(body\)/);
  assert.match(body, /renderCaptionWithTags\(segment\.value\)/);
  assert.match(body, /className="mention-highlight font-semibold"/);
  assert.match(thread, /<CommentBody body=\{comment\.body\} \/>/);
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
