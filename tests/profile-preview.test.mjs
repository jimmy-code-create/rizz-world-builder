/**
 * Profile preview card (the Discord-style popout opened from an avatar).
 *
 * These guards cover the two things that went wrong on the live card: a bio
 * full of markdown rendered as literal `**asterisks**`, and a name row with no
 * badges on it. They also lock the Discord anatomy in place — banner, ringed
 * avatar with a presence dot, ABOUT ME, MEMBER SINCE and the action row.
 *
 * Run: node tests/profile-preview.test.mjs
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

const card = readFileSync(new URL("../src/components/ProfilePreview.tsx", import.meta.url), "utf8");
const profileCard = readFileSync(
  new URL("../src/components/profile/ProfileCard.tsx", import.meta.url),
  "utf8",
);
const profilePage = readFileSync(
  new URL("../src/routes/_app/u.$username.tsx", import.meta.url),
  "utf8",
);
const profileHeader = readFileSync(
  new URL("../src/components/profile/ProfileHeader.tsx", import.meta.url),
  "utf8",
);

await check("the bio renders markdown instead of raw asterisks", async () => {
  assert.ok(card.includes('from "@/components/MarkdownText"'));
  assert.match(card, /<MarkdownText\s+text=\{p\.bio\}/);
  assert.ok(
    !/\{p\.bio\}/.test(card.replace(/<MarkdownText[\s\S]*?\/>/, "")),
    "the bio must not also be printed as plain text",
  );
});

await check("distinct earned badges sit on the name row and are tappable", async () => {
  assert.ok(card.includes("fetchUserBadges"));
  assert.ok(card.includes("distinctBadges(canonBadges(earned))"));
  assert.ok(
    card.includes("profileBadgeLineup(") && card.includes("withPurifyBadge("),
    "the five-mark lineup decides what the name row shows",
  );
  assert.ok(card.includes("BadgeLine badges={markBadges}"), "the name row renders the badge line");
  assert.ok(card.includes("wornSlug={wornSlug}"), "the worn mark is called out");
  assert.ok(
    !card.includes('nav({ to: "/badges" })'),
    "tapping a badge shows its story instead of leaving the profile",
  );
  assert.ok(
    card.includes('from "@/components/profile/BadgeInfoPopover"'),
    "the badge line owns the tap-for-info behaviour",
  );
  assert.ok(!card.includes("BadgeDetailDialog"), "the cut-off popout is gone");
});

await check("Discord anatomy: shared banner, avatar, presence dot, sections", async () => {
  assert.ok(card.includes("<ProfileHeader"), "the preview renders the shared header");
  assert.ok(card.includes("bannerMode: p.banner_mode"), "the preview honours banner_mode");
  assert.ok(card.includes("bannerGradient: p.banner_gradient"), "the preview honours the gradient");
  assert.ok(!card.includes("effects="), "the effects shelf is retired, so the header carries none");
  assert.ok(!card.includes("useEquipped"), "the preview no longer queries equipped cosmetics");
  assert.ok(card.includes("Close profile preview"), "the preview has a visible close control");
  assert.ok(card.includes("About Me"));
  assert.ok(card.includes("UserRound"), "About Me carries a profile icon");
  assert.ok(card.includes("Member since"), "member since is its own compact row");
  assert.ok(card.includes("Calendar"), "the member-since row carries a calendar icon");
  assert.ok(!card.includes('className="h-px bg-white'), "no divider eating header space");
  assert.ok(card.includes("profile-sheet"), "phones use the swipe-down sheet");
  assert.ok(card.includes("dragTransition"), "the sheet springs back instead of snapping");
  assert.ok(card.includes("bg-[#111214]"), "the card uses Discord's popout colour");

  assert.ok(
    profileHeader.includes('aspectRatio: "3 / 1"'),
    "the banner keeps one wide ratio on every surface",
  );
  assert.ok(profileHeader.includes("overflow-hidden"), "banner art is clipped");
  assert.ok(profileHeader.includes("<AvatarImage src={avatarSrc}"), "the header owns the avatar");
  assert.ok(
    !profileHeader.includes("<VerifiedSeal"),
    "verification is the Verified badge itself, not a second seal",
  );
  assert.ok(profileHeader.includes("flex-nowrap"), "the name row never wraps its badges");
  assert.ok(profileHeader.includes("<StatusDotButton"), "the header owns the presence dot");
  assert.ok(
    profileHeader.includes("onPointerDown={onBannerPointerDown}"),
    "the sheet can drag from the banner",
  );
});

await check("the hover card keeps badges on the name row, with no badge sheet", async () => {
  assert.ok(profileCard.includes("featuredBadge={"), "the worn badge still sits beside the name");
  assert.ok(!profileCard.includes("Badges ({computedBadges.length})"), "the badge sheet is gone");
  assert.ok(!profileCard.includes("badgePreview"), "no separate badge row on the card");
});

await check("one avatar treatment across card, preview and full profile", async () => {
  assert.ok(profileCard.includes("<ProfileHeader"), "profile card uses the shared header");
  assert.ok(profilePage.includes("<ProfileHeader"), "full profile uses the shared header");
  assert.ok(profileCard.includes("avatarRing={ringColor}"), "profile card passes its accent");
  assert.ok(
    profilePage.includes("avatarRing={profileSurface}"),
    "full profile rings against its theme",
  );
  assert.ok(
    profilePage.includes("background: pageBanner.profileBackground"),
    "full profile paints the gradient",
  );
  assert.ok(profileHeader.includes("boxShadow: `0 0 0 2px ${avatarRing}`"), "one accent ring");
  assert.ok(profileHeader.includes('"--avatar-size"'), "the avatar scales from the container");
  assert.ok(card.includes("Profile activity"), "the preview lists the same activity numbers");
});

await check("preview is compact, scroll-safe and keeps every action", async () => {
  assert.ok(card.includes("compact"), "the preview asks for the compact header");
  assert.ok(card.includes("avatarGlow={false}"), "no glowing halo around the avatar");
  assert.ok(card.includes("grid-cols-4 divide-x"), "four evenly divided activity columns");
  assert.ok(card.includes("overflow-y-auto"), "the sheet body scrolls when content grows");
  assert.ok(card.includes("overscroll-contain"), "the feed must not scroll with the sheet");
  assert.ok(card.includes("safe-area-inset-bottom"), "the sheet respects the bottom inset");
  assert.ok(card.includes("View Full Profile"), "the full profile button survives the redesign");
  assert.ok(card.includes("handleMessage") && card.includes("toggleFollow.mutate"), "message/follow still work");
});

await check("actions: Message with follow, own profile gets a single button", async () => {
  assert.match(card, /<MessageCircle className="h-4 w-4" \/>\s*Message/);
  assert.ok(card.includes("toggleFollow.mutate"));
  assert.ok(card.includes("isOwnProfile"));
  assert.ok(card.includes("View Full Profile"));
  // Discord puts Message/Call above the bio tabs; ours keeps that order so
  // nobody scrolls past a long bio to send a message.
  assert.ok(
    card.indexOf("Primary actions sit directly under the identity") < card.indexOf("About Me"),
    "primary actions must precede the bio",
  );
});

await check("the sheet drags as one surface, so no bare theme strip can open up", async () => {
  // The tinted surface used to sit on the static Radix box while only the
  // content translated, which exposed a tall empty gradient band above the
  // cover on every pull. The card itself is the dragged layer now.
  assert.ok(
    card.includes("overflow-visible border-0 bg-transparent p-0 shadow-none"),
    "the Radix box paints nothing of its own",
  );
  const dragged = card.slice(card.indexOf("if (isMobile)"), card.indexOf("<Dialog open={open}"));
  assert.ok(dragged.includes("rounded-t-3xl bg-[#0b0b0c]"), "the dragged layer owns the radius");
  assert.ok(dragged.includes("safe-area-inset-bottom"), "and the safe-area padding");
  assert.ok(
    dragged.includes("background: previewBanner.profileBackground"),
    "the theme tint travels with the card",
  );
  assert.ok(card.includes("setDismissing(true)"), "a past-threshold swipe keeps moving instead of snapping back");
  assert.ok(card.includes("onAnimationComplete"), "and closes once the card is off screen");
});

await check("one sheet animation, and the panel does not re-scale on load", async () => {
  const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const opens = styles.match(/\.profile-sheet\[data-state="open"\]\s*\{/g) ?? [];
  assert.equal(opens.length, 1, "a second keyframe set only overrode the first");
  assert.match(styles, /\.account-sheet\[data-state="open"\]\s*\{\s*animation: sheet-rise/);
  assert.ok(!card.includes("scale: 0.985"), "the arriving profile must not shrink the cover");
});

await check("the skeleton reserves the finished height", async () => {
  assert.ok(card.includes("aspect-[3/1]"), "the placeholder cover keeps the real ratio");
  const skeleton = card.slice(card.indexOf("profile.isLoading"), card.indexOf("profile.isError"));
  assert.ok(skeleton.includes("h-11"), "action rows are reserved");
  assert.ok(skeleton.includes("h-24"), "bio and activity blocks are reserved");
  assert.ok(skeleton.includes("ring-[#111214]"), "the avatar overlaps its cover here too");
});

await check("a cover is never transparent while its photo decodes", async () => {
  const banner = readFileSync(new URL("../src/lib/banner.ts", import.meta.url), "utf8");
  assert.ok(
    banner.includes('#141416 url('),
    "image banners keep an opaque base — without it the sheet tint showed through",
  );
});

await check("a nested avatar never opens a second preview sheet", async () => {
  assert.ok(card.includes('data-profile-preview-trigger=""'), "the trigger marks its subtree");
  const avatar = readFileSync(new URL("../src/components/ui/avatar.tsx", import.meta.url), "utf8");
  assert.ok(avatar.includes("[data-profile-preview-trigger]"), "the avatar checks for an owning trigger");
  assert.ok(avatar.includes("username && !insideTrigger"), "and leaves the preview to that trigger");
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
