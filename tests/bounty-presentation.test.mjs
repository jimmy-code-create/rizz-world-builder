/**
 * Bounty presentation + the photo-picker remount fix.
 *
 * The posting form grew Reddit-style tags, a title colour and a cover preview.
 * The same photo picker is used in DMs, groups and bounties, so the auth loader
 * guard is tested here too: a TOKEN_REFRESHED event must never unmount a route
 * that is holding a freshly selected image.
 *
 * Static guards (no DOM) per repo test convention.
 * Run: node tests/bounty-presentation.test.mjs
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

const post = read("src/components/bounties/PostBountyDialog.tsx");
const lib = read("src/lib/bounties.ts");
const card = read("src/components/bounties/BountyCard.tsx");
const drops = read("src/routes/_app/drops.tsx");
const dm = read("src/routes/_app/dm.$userId.tsx");
const group = read("src/routes/_app/g.$id.tsx");
const media = read("src/lib/chat-media.ts");
const auth = read("src/lib/auth.tsx");
const shell = read("src/components/AppShell.tsx");
const migration = read("supabase/migrations/20261115000000_bounty_presentation.sql");
const types = read("src/integrations/supabase/types.ts");

await check("the composer has real tag chips, suggestions and a five-tag cap", () => {
  assert.match(post, /const MAX_TAGS = 5/);
  assert.match(post, /const \[tags, setTags\] = useState<string\[\]>\(\[\]\)/);
  assert.match(post, /normalizeBountyTag/);
  assert.match(post, /SUGGESTED_TAGS/);
  assert.match(post, /onTagInputChange/);
  assert.match(post, /removeTag\(tag\)/);
  assert.match(post, /aria-label=\{`Remove \$\{tag\} tag`\}/);
  assert.match(post, /Type a tag and press Enter/);
});

await check("the heading colour is chosen, previewed and saved", () => {
  assert.match(post, /HEADING_COLORS/);
  assert.match(post, /const \[headingColor, setHeadingColor\]/);
  assert.match(post, /type="color"/);
  assert.match(post, /style=\{\{ color: titleColor/);
  assert.match(post, /headingColor: titleColor/);
  assert.match(lib, /_heading_color/);
  assert.match(lib, /headingColor\?: string/);
  assert.match(card, /bounty\.heading_color/);
  assert.match(card, /style=\{[\s\S]{0,120}color: titleColor/);
  assert.match(types, /heading_color: string/);
  assert.match(types, /_heading_color\?: string/);
});

await check("the cover image previews, compresses and can be replaced", () => {
  assert.match(post, /compressChatImage\(file\)/);
  assert.match(post, /const \[previewUrl, setPreviewUrl\]/);
  assert.match(post, /Add a cover image/);
  assert.match(post, /Replace/);
  assert.match(post, /Remove cover image/);
  assert.match(post, /event\.currentTarget\.value = ""/);
  assert.match(post, /MAX_COVER_BYTES/);
});

await check("every reported photo picker keeps a compressed preview", () => {
  assert.match(media, /export async function prepareChatImagePreview/);
  assert.match(media, /return URL\.createObjectURL\(blob\)/);
  assert.match(dm, /prepareChatImagePreview\(file\)/);
  assert.match(dm, /imageObjectUrlsRef\.current\.add\(preview\)/);
  assert.match(group, /prepareChatImagePreview\(file\)/);
  assert.match(group, /setImagePreview\(preview\)/);
  assert.match(post, /prepareChatImagePreview\(picked\)/);
  assert.match(post, /setPreviewUrl[\s\S]{0,140}preview/);
  for (const source of [dm, group, post]) {
    assert.match(source, /event\.currentTarget\.value = ""/, "the same file can be picked again");
  }
});

await check("tags on a card open a shareable board filter", () => {
  assert.match(card, /onTagClick\?: \(tag: string\) => void/);
  assert.match(card, /\(bounty\.tags \?\? \[\]\)/);
  assert.match(card, /aria-pressed=\{selected\}/);
  assert.match(drops, /validateSearch/);
  assert.match(drops, /const activeTag = search\.tag \?\? null/);
  assert.match(drops, /tagFiltered/);
  assert.match(drops, /onTagClick=\{setTagFilter\}/);
  assert.match(drops, /activeTag=\{activeTag\}/);
  assert.match(drops, /`No #\$\{activeTag\} bounties`/);
});

await check("a token refresh updates the profile without remounting the route", () => {
  assert.match(auth, /const sameMember = Boolean/);
  assert.match(auth, /A token refresh, not a new sign-in/);
  assert.match(auth, /Profile refresh failed/);
  assert.match(auth, /profileRef\.current/);
  assert.ok(
    !/if \(loading \|\| !user \|\| !profile\?\.username\)/.test(shell),
    "AppShell must not swap the route for AppLoader on a background loading flag",
  );
  assert.match(shell, /if \(!user \|\| !profile\?\.username\)/);
});

await check("the migration validates tags and colour for direct open calls too", () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS heading_color/);
  assert.match(migration, /drops_heading_color_check/);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS drops_tags_gin/);
  assert.match(migration, /validate_bounty_presentation/);
  assert.match(migration, /Keep it to five tags/);
  assert.match(migration, /Pick a valid six-digit heading colour/);
  assert.match(migration, /_heading_color text DEFAULT '#f2efe6'/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.post_paws_bounty/);
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
