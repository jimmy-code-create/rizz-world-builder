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
const realmComposer = read("src/components/chat/RealmComposer.tsx");
const library = read("src/components/chat/RizzLibrarySheet.tsx");
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

await check("realm composers can send photos and videos, and paste an image", () => {
  assert.match(realmComposer, /const MAX_ATTACHMENTS = 10;/);
  assert.match(realmComposer, /onPaste=\{handlePaste\}/);
  assert.match(realmComposer, /file\.type\.startsWith\("video\/"\)/);
  assert.match(realmComposer, /Photo compresses before upload/);
  assert.match(library, /accept="image\/\*,video\/\*"/);
  assert.match(realm, /compressChatImage\(file\)/);
  assert.match(realm, /\.from\("chat-media"\)/);
  assert.match(realm, /sendRealmRoomMessage\(activeRoomId, user\.id, text\.trim\(\), first \?\? null\)/);
  assert.match(realm, /sendRealmMessage\(c\.id, user\.id, text\.trim\(\), first \?\? null\)/);
});

await check("the + is the Rizz Library in a realm, with every old action still reachable", () => {
  assert.match(realm, /<RealmComposer/);
  assert.match(realmComposer, /<ChatAttachButton[\s\S]{0,300}?library=\{\{/);
  assert.match(realmComposer, /label: "Poll"/);
  assert.match(realmComposer, /label: "Schedule"/);
  assert.match(library, /Take a photo or video/);
  assert.match(library, /Upload from device/);
  assert.match(library, />\s*Files\s*</);
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
  assert.match(attach, /RizzLibrarySheet/, "the library lives inside the + sheet again");
});

await check("groups and realms can start a poll, DMs only read legacy ones", () => {
  assert.match(realmComposer, /label: "Poll"/, "realms offer a poll from the library pill");
  assert.match(group, /label: "Poll"/, "groups offer a poll from the +");
  for (const [name, source] of [["groups", group], ["realms", realm]]) {
    assert.match(source, /<PollDialog/, `${name} mount the poll dialog`);
  }
  assert.match(group, /groupId=\{id\}/);
  // DMs removed poll creation: the + sheet has no entry and the route mounts
  // no dialog, but old poll messages still render as cards.
  assert.ok(!dm.includes("PollDialog"), "DMs mount no poll dialog");
  assert.ok(!dm.includes('label: "Poll"'), "the DM + sheet has no poll entry");
  assert.match(dm, /const pollCard = asChatPollCard\(\(m as \{ card\?: unknown \}\)\.card\)/);
  assert.match(group, /const pollCard = asChatPollCard\(m\.card\)/);
  assert.match(dm, /<ChatPollCard card=\{pollCard\}/);
  assert.match(group, /<ChatPollCard card=\{pollCard\}/);
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
  assert.match(group, /aria-label="Cancel reply"/);
});

await check("a photo caption is never parsed as a slash command", () => {
  assert.match(realm, /const parsed = files\.length \? null : parseSlashCommand\(text\)/);
});

await check("a photo can be sent with no text at all", () => {
  assert.match(realm, /if \(!user \|\| \(!text\.trim\(\) && !files\.length\)\) return false;/);
  assert.match(
    realmComposer,
    /disabled=\{blocked \|\| \(!text\.trim\(\) && !attachments\.length\)\}/,
  );
  assert.match(library, /accept="image\/\*,video\/\*"/);
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

await check("every chat composer opens the same + control", () => {
  for (const [name, source] of [["DMs", dm], ["groups", group]]) {
    assert.match(source, /<ChatAttachButton/, `${name} use the shared + sheet`);
    assert.match(source, /label: "Photo"/, `${name} can pick a photo`);
    assert.match(source, /label: "Camera"/, `${name} can use the camera`);
    assert.match(source, /capture="environment"/, `${name} wire the lens`);
    assert.match(source, /accept="image\/\*"/, `${name} accept images`);
  }
  assert.match(realmComposer, /<ChatAttachButton/, "realms use the shared + control");
  assert.match(library, /capture="environment"/, "the camera opens the lens in the library");
});

await check("composer rows share one height", () => {
  assert.match(gif, /triggerClassName\?: string/);
  assert.match(gif, /className=\{`shrink-0 text-primary \$\{triggerClassName \?\? ""\}`\}/);
  assert.match(realmComposer, /triggerClassName="h-11 w-11"/, "the picker matches a 44px row");
  assert.match(attach, /grid h-11 w-11 shrink-0 place-items-center rounded-xl/);
  assert.match(dm, /<ChatAttachButton\s*className="h-9 w-9"/, "DM's composer is a 36px row");
  assert.match(group, /<ChatAttachButton\s*className="h-9 w-9"/, "groups match it");
  assert.match(realmComposer, /className="h-11 w-11 shrink-0 border-0 bg-primary/);
  assert.match(composer, /triggerClassName=\{compact \? "h-9 w-9" : "h-10 w-10"\}/);
});

await check("the cat set stays one silhouette with per-face features", () => {
  assert.ok(!/<text/.test(cat), "no text glyphs — a phone font would move the z's");
  for (const hook of ["fx-heart", "fx-glint", "fx-z", "fx-z2", "fx-pupil", "fx-slide", "fx-flick", "fx-crown", "fx-tear", "fx-paw", "fx-dot1", "fx-dot2", "fx-dot3"]) {
    assert.ok(cat.includes(hook), `${hook} keeps its animation hook`);
  }
  for (const name of [
    "cat_love", "cat_cool", "cat_sleep", "cat_lol", "cat_wow", "cat_sus",
    "cat_music", "cat_hype", "cat_gg", "cat_sad", "cat_wave", "cat_think",
  ]) {
    assert.ok(cat.includes(`case "${name}":`), `${name} is drawn`);
  }
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
