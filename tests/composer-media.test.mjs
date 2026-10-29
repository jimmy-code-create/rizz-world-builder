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
const rizz = read("src/lib/rizz-library.ts");
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
  assert.match(realm, /onInsertSticker=\{\(item\) => setBody\(\(current\) => insertRizzItem\(current, item\)\)\}/);
  assert.match(realm, /capture="environment"/, "the camera opens the lens, not the library");
  assert.ok(
    !/aria-label="Attach a photo, or add a poll or scheduled message"/.test(realm),
    "the photo-only icon and its dropdown are gone",
  );
});

await check("the attach sheet is the Rizz library's front door", () => {
  assert.match(attach, /export function ChatAttachButton\(/);
  assert.match(attach, /<Plus className="h-5 w-5" \/>/, "it wears the + people know");
  assert.match(attach, /onInsertSticker\?: \(item: string\) => void/);
  assert.match(attach, /Rizz library/);
  assert.match(attach, /onPick=\{\(item\) => \{/, "picking an item inserts it into the draft");
  assert.match(rizz, /export function insertRizzItem/);
  assert.match(rizz, /export const RIZZ_PACKS/);
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

await check("composer rows share one height", () => {
  assert.match(gif, /triggerClassName\?: string/);
  assert.match(gif, /className=\{`shrink-0 text-primary \$\{triggerClassName \?\? ""\}`\}/);
  assert.match(realm, /triggerClassName="h-11 w-11"/, "the picker matches a 44px row");
  assert.match(attach, /grid h-11 w-11 shrink-0 place-items-center rounded-full/);
  assert.match(dm, /<ChatAttachButton\s*className="h-9 w-9"/, "DM's composer is a 36px row");
  assert.match(group, /<ChatAttachButton\s*className="h-9 w-9"/, "groups match it");
  assert.match(realm, /className="h-11 w-11 shrink-0 border-0 bg-primary/);
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
