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

await check("realm composers can send photos, videos and files, and paste media", () => {
  const files = read("src/lib/chat-files.ts");
  const shared = read("src/components/chat/MessageComposer.tsx");
  assert.match(realmComposer, /const MAX_ATTACHMENTS = 10;/);
  assert.match(realmComposer, /onPasteFiles=\{\(files\) => addFiles\(files\)\}/);
  assert.match(files, /startsWith\("video\/"\)/);
  assert.match(files, /compressChatImage/);
  assert.match(files, /\.from\("chat-media"\)/);
  assert.match(shared, /chat-pending-file/);
  assert.match(realm, /sendRealmRoomMessage\([\s\S]{0,180}?first\?\.url \?\? null/);
  assert.match(realm, /sendRealmMessage\(c\.id, user\.id, text\.trim\(\), first\?\.url \?\? null/);
});

await check("the + opens the shared dock with every realm action", () => {
  const panel = read("src/components/chat/ChatDockPanel.tsx");
  assert.match(realm, /<RealmComposer/);
  assert.match(realmComposer, /<ChatComposer/);
  assert.match(panel, /label="Poll"/);
  assert.match(panel, /label="Schedule"/);
  assert.match(panel, /label="Photos"/);
  assert.match(panel, /label="Camera"/);
  assert.match(panel, /label="Files"/);
});

await check("the attach dock opens on the chat's media, actions underneath", () => {
  const panel = read("src/components/chat/ChatDockPanel.tsx");
  assert.match(panel, /chat-dock-camera-tile/, "the camera leads the grid");
  assert.match(panel, /aria-label="Take a photo"/);
  assert.match(panel, /grid-cols-4/, "recent media tiles are squares");
  assert.match(panel, /recentPhotos\.map/, "it takes the photos already in the chat");
  assert.match(panel, /onPickRecentPhoto\?\.\(photo\.url\)/, "one tap sends one again");
  for (const source of [realm, group, dm]) {
    assert.ok(!source.includes("insertRizzItem"), "no composer still wires the old library");
  }
  assert.match(reactions, /export const RIZZ_REACTIONS/);
  // Every chat hands the dock the media already sent in that conversation.
  assert.match(dm, /recentPhotos=\{recentPhotos\}/);
  assert.match(group, /recentPhotos=\{recentPhotos\}/);
  assert.match(realmComposer, /recentPhotos=\{photos\}/);
  for (const label of ["Photos", "Camera", "Files", "Schedule"]) {
    assert.ok(panel.includes(`label="${label}"`), `the dock offers ${label}`);
  }
});

await check("groups and realms can start a poll, DMs only read legacy ones", () => {
  const panel = read("src/components/chat/ChatDockPanel.tsx");
  assert.match(panel, /label="Poll"/, "the dock offers a poll");
  assert.match(realmComposer, /onPoll=\{onPoll\}/, "realms wire the poll action");
  assert.match(group, /onPoll=\{\(\) => setPollOpen\(true\)\}/, "groups wire the poll action");
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
  const shared = read("src/components/chat/MessageComposer.tsx");
  assert.match(
    shared,
    /if \(reply && !hadReply\.current\) \{[\s\S]{0,100}?field\.current\?\.focus\(\)/,
    "the shared composer focuses the field for a new quote",
  );
  assert.match(shared, /aria-label="Cancel reply"/);
  assert.match(dm, /if \(!replyTo\) return;\s*composerRef\.current\?\.focus\(\);\s*scrollChatToLatest\(scrollRef\.current\)/);
  assert.match(group, /if \(!replyTo\) return;\s*composerRef\.current\?\.focus\(\);\s*scrollChatToLatest\(messagesListRef\.current\)/);
  assert.match(group, /label: "Reply",\s*icon: CornerUpLeft/);
});

await check("a photo caption is never parsed as a slash command", () => {
  assert.match(realm, /const parsed = files\.length \? null : parseSlashCommand\(text\)/);
});

await check("a photo can be sent with no text at all", () => {
  assert.match(realm, /if \(!user \|\| \(!text\.trim\(\) && !files\.length\)\) return false;/);
  assert.match(
    realmComposer,
    /canSend=\{Boolean\(body\.trim\(\) \|\| attachments\.length\)\}/,
  );
  assert.match(read("src/components/chat/MessageComposer.tsx"), /accept="image\/\*,video\/\*"/);
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
  const shared = read("src/components/chat/MessageComposer.tsx");
  for (const [name, source] of [["DMs", dm], ["groups", group]]) {
    assert.match(source, /<ChatComposer/, `${name} use the shared composer`);
    assert.match(source, /onFilesSelected=\{addFiles\}/, `${name} hand picked files to the uploader`);
  }
  assert.match(realmComposer, /<ChatComposer/, "realms use the shared composer");
  assert.match(shared, /onClick=\{\(\) => openPanel\("attach"\)\}/, "one + opens the dock");
  assert.match(shared, /ref=\{cameraRef\}[\s\S]{0,120}?capture="environment"/, "the lens opens from the dock");
  assert.match(shared, /accept="image\/\*"/, "the camera input accepts images");
  assert.match(shared, /<input ref=\{filesRef\} type="file" multiple hidden/, "files accept anything");
});

await check("composer rows share one height", () => {
  const shared = read("src/components/chat/MessageComposer.tsx");
  const styles = read("src/styles.css");
  assert.match(shared, /grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border/, "the + is a 40px disc");
  assert.match(shared, /chat-composer-avatar/, "the sticker button is the member's face");
  assert.match(styles, /\.chat-composer-avatar \{[\s\S]{0,120}?width: 36px/, "36px, per the dock design");
  assert.match(shared, /grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/, "send is 40px");
  assert.match(composer, /triggerClassName=\{compact \? "h-9 w-9" : "h-10 w-10"\}/, "the comment box still matches its row");
});

await check("the cat set is still artwork with one loop budget", () => {
  const manifest = read("src/components/emoji/cat-emoji-manifest.ts");
  assert.ok(!/<text/.test(cat), "no text glyphs — the faces are artwork");
  assert.match(cat, /catImageForName/, "every face resolves through the manifest");
  for (const name of [
    "cat_love", "cat_cool", "cat_sleep", "cat_lol", "cat_wow", "cat_sus",
    "cat_music", "cat_hype", "cat_gg", "cat_sad", "cat_wave", "cat_think",
  ]) {
    assert.ok(manifest.includes(name), `${name} exists`);
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
