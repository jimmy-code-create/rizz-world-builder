/**
 * The composer: a real face, and a photo everywhere.
 *
 * Two things that used to be inconsistent:
 *
 *  1. The comment box drew a lime letter where the writer's photo belongs. It
 *     now shows their avatar, and falls back to the account's own cat — never a
 *     bare initial.
 *  2. Photo attachments existed in DMs and groups but not in realms, whose
 *     composer offered a bare `+` with polls and scheduling inside. The trigger
 *     wears the photo now, and the realm send path can carry an attachment.
 *
 * Run: node tests/composer-media.test.mjs
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

const composer = read("src/components/comments/CommentComposer.tsx");
const realm = read("src/routes/_app/r.$slug.tsx");
const group = read("src/routes/_app/g.$id.tsx");
const dm = read("src/routes/_app/dm.$userId.tsx");
const realmsLib = read("src/lib/realms.ts");
const gif = read("src/components/GifPicker.tsx");
const attach = read("src/components/chat/ChatAttachSheet.tsx");
const reactions = read("src/lib/reactions.ts");
const cat = read("src/components/emoji/CatEmoji.tsx");

await check("the comment box shows the writer's face, not a letter", () => {
  assert.match(composer, /const avatarSrc =\s*profile\?\.avatar_url \?\? defaultAvatarFor\(profile\?\.username \?\? user\?\.id \?\? "you"\)/);
  assert.match(composer, /<AvatarImage src=\{avatarSrc\} alt="" \/>/);
  assert.match(composer, /<AvatarFallback className="bg-primary\/20 text-\[10px\] font-bold text-primary">/);
  assert.ok(
    !composer.includes("bg-primary text-[10px] font-bold text-primary-foreground"),
    "the lime initial bubble is gone",
  );
});

await check("realm composers can send a photo", () => {
  assert.match(realm, /const \[imageFile, setImageFile\] = useState<File \| null>\(null\)/);
  assert.match(realm, /const \[imagePreview, setImagePreview\] = useState<string \| null>\(null\)/);
  assert.match(realm, /accept="image\/\*"/);
  assert.match(realm, /compressChatImage\(imageFile\)/);
  assert.match(realm, /\.from\("chat-media"\)\s*\n\s*\.upload\(path, blob, \{ contentType: "image\/jpeg" \}\)/);
  assert.match(realm, /sendRealmRoomMessage\(activeRoomId, user\.id, body\.trim\(\), attachmentUrl\)/);
  assert.match(realm, /sendRealmMessage\(c\.id, user\.id, body\.trim\(\), attachmentUrl\)/);
  assert.match(realm, /Photo compresses before upload/);
});

await check("the + is Discord's attach sheet, with photo, camera, poll and schedule", () => {
  assert.match(realm, /<ChatAttachButton[\s\S]{0,900}?label: "Photo"[\s\S]{0,300}?label: "Camera"[\s\S]{0,300}?label: "Poll"[\s\S]{0,300}?label: "Schedule"/);
  assert.match(realm, /capture="environment"/, "the camera opens the lens, not the library");
  assert.ok(
    !/aria-label="Attach a photo, or add a poll or scheduled message"/.test(realm),
    "the photo-only icon and its dropdown are gone",
  );
});

await check("the attach sheet is a grid of squares, and the Rizz library is out of it", () => {
  assert.match(attach, /export function ChatAttachButton\(/);
  assert.match(attach, /<Plus className="h-4 w-4" \/>/, "it wears the + people know");
  assert.match(attach, /rounded-xl border border-white\/10 bg-white\/\[0\.04\]/, "the trigger is a square tile");
  assert.match(attach, /aspect-square/, "every action is a square tile");
  assert.match(attach, /grid-cols-3/, "three squares to a row");
  assert.ok(!attach.includes("onInsertSticker"), "the library sub-view is gone");
  assert.ok(!attach.includes("Rizz library</span>"), "the + no longer advertises the library");
  assert.ok(!attach.includes("RIZZ_PACKS"), "the sheet no longer imports the emoji packs");
  for (const source of [realm, group, dm]) {
    assert.ok(!source.includes("insertRizzItem"), "no composer still wires the library");
  }
  // The curated reaction set moved into the shared reactions module; the
  // library's packs, search and insert helpers are gone with their only user.
  assert.match(reactions, /export const RIZZ_REACTIONS/);
  assert.ok(!attach.includes("RizzLibrary"), "no library component survives");
});

await check("DMs and groups can start a poll", () => {
  for (const [name, source] of [["DMs", dm], ["groups", group], ["realms", realm]]) {
    assert.match(source, /label: "Poll"/, `${name} offer a poll from the +`);
    assert.match(source, /<PollDialog/, `${name} mount the poll dialog`);
  }
  assert.match(dm, /dmUserId=\{userId/);
  assert.match(group, /groupId=\{id\}/);
  assert.match(dm, /const pollCard = asChatPollCard\(\(m as \{ card\?: unknown \}\)\.card\)/);
  assert.match(group, /const pollCard = asChatPollCard\(m\.card\)/);
  assert.match(dm, /<ChatPollCard card=\{pollCard\}/);
  assert.match(group, /<ChatPollCard card=\{pollCard\}/);
  const card = read("src/components/chat/PollCard.tsx");
  assert.match(card, /fullWidth\?: boolean/);
  assert.match(card, /fullWidth \? "" : "max-w-md"/, "DM/group polls drop the compact cap");
  assert.match(card, /min-w-0 flex-1 break-words/, "option text wraps instead of truncating");
  for (const [name, source] of [["DMs", dm], ["groups", group]]) {
    assert.match(
      source,
      /className=\{pollCard \? "w-full" : undefined\}/,
      `${name} give the poll the whole message row`,
    );
  }
  const dialog = read("src/components/chat/PollDialog.tsx");
  assert.match(dialog, /dmUserId\?: string/);
  assert.match(dialog, /groupId\?: string/);
  assert.match(dialog, /await createChatPoll\(\{ \.\.\.target/);
  const migration = read("supabase/migrations/20261110000000_dm_group_polls.sql");
  assert.match(migration, /ADD COLUMN IF NOT EXISTS card jsonb/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.chat_polls/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.chat_poll_votes/);
  assert.match(migration, /public\.is_blocked_pair\(v_user, _other_user\)/, "a blocked pair cannot be polled");
  assert.match(migration, /public\.is_group_member\(_group_id, v_user\)/, "group polls check membership");
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.vote_chat_poll/);
  assert.match(migration, /ALTER PUBLICATION supabase_realtime ADD TABLE/);
});

await check("replying opens the keyboard and re-pins the chat", () => {
  // Discord: reply is a composer state, so the box takes focus (keyboard up)
  // and the list follows the viewport while it settles.
  assert.match(dm, /useEffect\(\(\) => \{\s*if \(!replyTo\) return;\s*composerRef\.current\?\.focus\(\{ preventScroll: true \}\);\s*scrollChatToLatest\(scrollRef\.current\);/);
  assert.match(group, /composerRef\.current\?\.focus\(\{ preventScroll: true \}\);\s*scrollChatToLatest\(messagesListRef\.current\);/);
  assert.match(group, /label: "Reply",\s*icon: CornerUpLeft/);
  assert.match(group, /const quoted = replyTo \? `↪ \$\{replyTo\.body\.slice\(0, 120\)\}\\n` : "";/);
  // The reply strip moved into the shared composer, so the close button and
  // the lime bar live there once for both chats.
  const chatComposer = read("src/components/chat/MessageComposer.tsx");
  assert.match(chatComposer, /aria-label="Cancel reply"/);
  assert.match(chatComposer, /w-\[3px\] shrink-0 bg-primary/, "the strip has no lime bar");
  assert.match(group, /reply=\{replyTo \? \{/);
  assert.match(dm, /reply=\{replyTo \? \{/);
});

await check("a photo caption is never parsed as a slash command", () => {
  assert.match(realm, /const parsed = imageFile \? null : parseSlashCommand\(body\)/);
});

await check("a photo can be sent with no text at all", () => {
  assert.match(realm, /if \(!user \|\| \(!body\.trim\(\) && !imageFile\)\) return;/);
  assert.match(
    realm,
    /disabled=\{!joined \|\| \(!body\.trim\(\) && !imageFile\) \|\| sending/,
  );
  assert.match(realm, /if \(!file\.type\.startsWith\("image\/"\)\)/);
  assert.match(realm, /chatUploadLimitBytes\(myProfile\)/);
});

await check("both realm inserts carry attachment_url when there is one", () => {
  const inserts = realmsLib.match(/\.insert\(\{[\s\S]*?\}\)/g) ?? [];
  const messageInserts = inserts.filter((block) => block.includes("sender_id: senderId"));
  assert.equal(messageInserts.length, 2, "realm and room sends both insert a message");
  for (const block of messageInserts) {
    assert.match(block, /\.\.\.\(attachmentUrl \? \{ attachment_url: attachmentUrl \} : \{\}\)/);
  }
  assert.match(realmsLib, /export async function sendRealmMessage\(\s*realmId: string,\s*senderId: string,\s*body: string,\s*attachmentUrl\?: string \| null,/);
  assert.match(realmsLib, /export async function sendRealmRoomMessage\(\s*roomId: string,\s*senderId: string,\s*body: string,\s*attachmentUrl\?: string \| null,/);
});

await check("every chat composer opens the same attach sheet", () => {
  for (const [name, source] of [["DMs", dm], ["groups", group], ["realms", realm]]) {
    assert.match(source, /<ChatAttachButton/, `${name} use the shared + sheet`);
    assert.match(source, /label: "Photo"/, `${name} can pick a photo`);
    assert.match(source, /label: "Camera"/, `${name} can use the camera`);
    assert.match(source, /capture="environment"/, `${name} wire the lens`);
    assert.match(source, /accept="image\/\*"/, `${name} accept images`);
  }
});

await check("chat composers share the one 44px row", () => {
  assert.match(gif, /triggerClassName\?: string/);
  assert.match(gif, /className=\{`shrink-0 text-primary \$\{triggerClassName \?\? ""\}`\}/);
  assert.match(realm, /triggerClassName="h-11 w-11"/, "the picker matches a 44px row");
  assert.match(attach, /appearance === "circle"/, "the attach disc has no circle variant");
  assert.match(attach, /border-\[rgba\(255,255,255,0\.14\)\] bg-\[#171717\]/, "the disc is not #171717");
  const chatComposer = read("src/components/chat/MessageComposer.tsx");
  assert.match(dm, /<MessageComposer/, "DM does not use the shared composer");
  assert.match(group, /<MessageComposer/, "groups do not use it either");
  assert.match(dm, /appearance="circle"/, "DM's attach is not the 44px disc");
  assert.match(group, /appearance="circle"/, "the group attach does not match");
  assert.match(chatComposer, /minHeight: 44/, "the input pill is not 44px tall");
  assert.match(chatComposer, /rounded-\[22px\]/, "the pill is not 22px radius");
  assert.match(chatComposer, /h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/, "the action is not a 44px lime circle");
  assert.match(
    chatComposer,
    /aria-label=\{recording \? "Release to send voice message" : "Voice message"\}/,
    "the mic lost its label",
  );
  assert.match(chatComposer, /aria-label="Stickers"/, "the cat lost its label");
  assert.match(chatComposer, /aria-label="Emoji"/, "the smiley lost its label");
  assert.match(chatComposer, /SLIDE_CANCEL_PX/, "the mic cannot slide to cancel");
  assert.match(chatComposer, /focus-within:ring-primary\/\[0\.16\]/, "no lime focus ring");
  assert.match(realm, /className="h-11 w-11 shrink-0 border-0 bg-primary/);
  assert.match(composer, /triggerClassName=\{compact \? "h-9 w-9" : "h-10 w-10"\}/);
});

await check("the cat pack is nine shared stickers, not twelve drawings", () => {
  const manifest = read("src/components/emoji/cat-emoji-manifest.ts");
  assert.match(cat, /catImageForName/, "faces resolve to a shared image");
  assert.match(cat, /<img/, "the pack is served as images");
  assert.ok(!/<svg/.test(cat), "the old drawn faces are gone");
  assert.ok(!cat.includes("EmojiFace"), "the per-face switch is gone");
  for (const file of [
    "101448-002-cathappy", "231129-002-catcry", "261171-002-catachu",
    "311127-002-catsleepy", "360487-002-cattried", "671657-002-catangry",
    "825154-002-catsurprise", "839601-002-catclap", "873539-002-cathm",
  ]) {
    assert.ok(manifest.includes(file), `${file} is in the pack`);
  }
  // Legacy shortcodes survive as aliases, so old badges, games and messages
  // keep drawing instead of printing `:cat_gg:`.
  assert.ok(manifest.includes('":cat_gg:"'), "legacy shortcodes survive as aliases");
  assert.ok(manifest.includes("LEGACY_NAME_ALIAS"), "legacy component names resolve too");
});

await check("only a running loop pays for an observer", () => {
  assert.match(cat, /if \(!el \|\| mode !== "loop"\) return;/);
  assert.ok(
    !/if \(!el \|\| mode === "static"\) return;/.test(cat),
    "hover and once used to create observers they never needed",
  );
  assert.match(cat, /if \(liveLoops < 3\)/, "the loop budget stays");
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
