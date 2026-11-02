// UI invariants for the bounty upgrade and the feed polish. Static checks, the
// same shape as the rest of the suite: the browser cannot be mounted here, so
// every claim the screens make is asserted at the source.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

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

const take = read("src/components/bounties/TakeBountyDialog.tsx");
const post = read("src/components/bounties/PostBountyDialog.tsx");
const card = read("src/components/bounties/BountyCard.tsx");
const actions = read("src/components/bounties/BountyActions.tsx");
const safety = read("src/components/bounties/SafetyActions.tsx");
const board = read("src/routes/_app/drops.tsx");
const moderation = read("src/routes/_app/moderation.tsx");
const permalink = read("src/routes/_app/p.$postId.tsx");
const postCard = read("src/components/PostCard.tsx");
const feed = read("src/routes/_app/feed.tsx");
const picker = read("src/components/emoji/RizzEmojiPicker.tsx");
const chatPicker = read("src/components/chat/ReactionPicker.tsx");
const commentThread = read("src/components/comments/CommentThread.tsx");
const gifPicker = read("src/components/GifPicker.tsx");

await check("taking a bounty is a full sheet that states the fee first", () => {
  assert.match(take, /h-\[94dvh\]/, "the sheet is full height");
  assert.match(take, /CANCEL_FEE/, "the fee is on the sheet");
  assert.match(take, /I understand the .* fee/s, "the fee needs an explicit tick");
  assert.match(take, /canAffordTakerCancelFee/, "the balance gate is shown");
  assert.match(take, /usePurify/, "the premium gate is shown");
  assert.match(take, /useBountyTrust/, "the poster's trust line is on the sheet");
  assert.match(take, /Premium to take/, "the locked state says what to do");
  assert.match(take, /Deadline reminders/, "reminders are offered");
  assert.match(take, /Optional message to the poster/, "the optional message is there");
  assert.match(take, /takeBounty\(bounty\.id, message\)/, "the message reaches the RPC");
  assert.match(
    take,
    /disabled=\{!ready\}/,
    "the confirm button stays disabled until every gate is met",
  );
});

await check("the post form carries the new fields", () => {
  assert.match(post, /PROOF_TYPE_OPTIONS/, "proof type");
  assert.match(post, /MIN_TRUST_OPTIONS/, "minimum trust");
  assert.match(post, /Switch/, "the premium toggle");
  assert.match(post, /premiumOnly/, "the toggle is wired");
  assert.match(post, /tags/, "tags are captured");
  assert.match(post, /A taker who hands it back/, "the taker fee is explained before posting");
});

await check("the card gates on premium, trust and the fee", () => {
  assert.match(card, /Premium to take/, "non-premium takers see an upgrade path");
  assert.match(card, /Keep .* Paws to take/s, "a thin wallet is blocked before the RPC");
  assert.match(card, /TrustLine/, "the taker's record is on the card");
  assert.match(card, /Warn taker/, "the poster can warn");
  assert.match(card, /Block user/, "the poster can block");
  assert.match(card, /setTakeOpen/, "taking opens the sheet instead of firing an RPC");
  assert.match(card, /formatNumber\(result\.fee\)/, "a hand-back reports the fee");
});

await check("warnings are one per bounty,appealable once and decided by an admin", () => {
  assert.match(safety, /WarnTakerDialog/);
  assert.match(safety, /AppealWarningDialog/);
  assert.match(safety, /WarningBanner/);
  assert.match(safety, /one appeal per warning/);
  assert.match(safety, /Pending appeals do not lift the block/);
  assert.match(moderation, /useBountyAppeals/);
  assert.match(moderation, /resolveBountyWarning/);
  assert.match(moderation, /Uphold and remove the warning/);
  assert.match(moderation, /Reject and keep the warning/);
  assert.match(moderation, /Admins only/);
});

await check("the board sweeps missed deadlines and shows the warning banner", () => {
  assert.match(board, /expireTakenBounties/, "taken bounties past the deadline are swept");
  assert.match(board, /useMyBountyWarnings/, "the banner reads the taker's warnings");
  assert.match(board, /WarningBanner/, "the banner is mounted");
  assert.match(board, /AppealWarningDialog/, "the banner can open an appeal");
  assert.match(board, /useBountyTrustMap/, "trust arrives in one call");
  assert.match(board, /bounty_warnings/, "warnings are live");
  assert.match(actions, /useBountyTrust/, "the review screen shows the taker's record");
});

await check("a post opens a full page with media, reactions and threaded comments", () => {
  assert.match(permalink, /<PostCard post=\{p\} \/>/, "the post is rendered on its own page");
  assert.match(permalink, /<CommentSection postId=\{p\.id\}/, "the thread is on the page");
  assert.match(permalink, /62dvh/, "the thread scrolls in its own panel");
  assert.match(permalink, /router\.history\.back\(\)/, "back returns where you came from");
  assert.match(postCard, /useNavigate/, "the card can navigate");
  assert.match(postCard, /nav\(\{ to: "\/p\/\$postId"/, "the card targets the post page");
  assert.match(postCard, /rizz:feed-scroll/, "the card saves the feed position");
  assert.match(postCard, /target\?\.closest\?\./, "buttons and media do not navigate");
  assert.match(feed, /rizz:feed-scroll/, "the feed restores the saved position");
  assert.match(feed, /scrollTo\(\{ top: y/, "the restore actually scrolls");
  assert.ok(!postCard.includes("rizz:open-side-discussion"), "the side sheet is retired");
});

await check("one RIZZ emoji picker is shared by every reaction surface", () => {
  assert.match(picker, /RECENT_KEY = "rizz:emoji:recent"/, "one recents list");
  assert.match(picker, /Search the RIZZ pack/, "search is part of the picker");
  assert.match(picker, /CAT_EMOJI_MANIFEST/, "the pack comes from the manifest");
  assert.match(postCard, /EmojiPicker/, "posts use the shared picker");
  assert.match(commentThread, /RizzEmojiPanel/, "comments and Reels use the cat picker");
  assert.match(chatPicker, /RizzEmojiPanel/, "messages use it");
  assert.match(gifPicker, /RizzEmojiPanel/, "the composer sheet uses it");
  assert.match(gifPicker, /onSelect\(shortcode\)/, "the picker inserts the shortcode");
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
