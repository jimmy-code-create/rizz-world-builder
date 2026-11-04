/**
 * The Rizz Library ("+") and the composer plumbing behind it.
 *
 *  1. The `+` opens a media sheet with a 4-column grid, tabs, multi-select and a
 *     quick-action pill — but DMs and groups keep the old tile grid.
 *  2. Files are compressed to 1920px with a 256px thumbnail before anything is
 *     uploaded.
 *  3. The composer isolates its state, handles IME and paste, keeps the caret,
 *     and debounces drafts per channel.
 *
 * Run: node tests/rizz-library.test.mjs
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

const attach = read("src/components/chat/ChatAttachSheet.tsx");
const librarySheet = read("src/components/chat/RizzLibrarySheet.tsx");
const library = read("src/lib/rizz-library.ts");
const composer = read("src/components/chat/RealmComposer.tsx");
const realm = read("src/routes/_app/r.$slug.tsx");
const dm = read("src/routes/_app/dm.$userId.tsx");
const css = read("src/components/emoji/picker.css");

await check("the + sheet opens the library in a realm and keeps the tiles elsewhere", () => {
  assert.match(attach, /export function ChatAttachButton/);
  assert.match(attach, /library\?: ChatAttachLibrary/);
  assert.match(attach, /<RizzLibrarySheet/);
  assert.match(attach, /<SheetTitle className="sr-only">\{library \? "Rizz Library" : "Attachments"\}/);
  assert.match(attach, /grid grid-cols-3 gap-2/, "the fallback grid is intact");
  assert.match(attach, /aspect-square/);
});

await check("the library is a 4-column square grid with the two action tiles first", () => {
  assert.match(css, /\.rizz-library__grid \{[\s\S]{0,120}?grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(librarySheet, /className="rizz-tile rizz-tile--action"/);
  assert.match(librarySheet, /aria-label="Take a photo or video"/);
  assert.match(librarySheet, /aria-label="Upload from device"/);
  assert.match(librarySheet, /accept="image\/\*,video\/\*"/);
  assert.match(librarySheet, /multiple/);
});

await check("Recent, Uploads and Saved are tabs over real data", () => {
  assert.match(librarySheet, /{ id: "recent", label: "Recent" }/);
  assert.match(librarySheet, /{ id: "uploads", label: "Uploads" }/);
  assert.match(librarySheet, /{ id: "saved", label: "Saved" }/);
  assert.match(library, /\.eq\("sender_id", userId\)/);
  assert.match(library, /\.not\("attachment_url", "is", null\)/);
  assert.match(library, /export function bucketLibrary/);
  assert.match(library, /saveLibraryItem/);
});

await check("multi-select is capped at ten with numbered badges", () => {
  assert.match(librarySheet, /const MAX_SELECTION = 10;/);
  assert.match(librarySheet, /current\.length >= MAX_SELECTION/);
  assert.match(librarySheet, /rizz-tile__badge/);
  assert.match(librarySheet, /\{index \+ 1\}/);
  assert.match(librarySheet, /Add \{selected\.length\}/);
});

await check("long-press previews full screen, and Save keeps the item", () => {
  assert.match(librarySheet, /window\.setTimeout\(\(\) => setPreview\(item\), 450\)/);
  assert.match(librarySheet, /className="rizz-preview"/);
  assert.match(librarySheet, /aria-modal="true"/);
  assert.match(librarySheet, /savePreview/);
});

await check("the sheet drags from half to full height with a transform", () => {
  assert.match(librarySheet, /const COLLAPSED_TAB = 34;/);
  assert.match(librarySheet, /translate3d\(0, \$\{offset\}, 0\)/);
  assert.match(librarySheet, /transition: dragOffset === null \? "transform 240ms cubic-bezier\(0\.22, 1, 0\.36, 1\)"/);
  assert.match(librarySheet, /if \(delta < -28\) setExpanded\(true\);/);
});

await check("quick actions keep Photo, Poll, Schedule and Files working", () => {
  for (const label of ["Photo", "Poll", "Schedule", "Files"]) {
    assert.match(librarySheet, new RegExp(`>\\s*${label}\\s*<`), `${label} is in the pill`);
  }
  assert.match(librarySheet, /disabled=\{scheduleDisabled\}/);
  assert.match(attach, /onPoll=\{\(\) => run\(find\("poll"\)\)\}/);
  assert.match(attach, /onSchedule=\{\(\) => run\(find\("schedule"\)\)\}/);
});

await check("images are compressed to 1920px with a 256px webp thumbnail", () => {
  assert.match(library, /const MAX_EDGE = 1920;/);
  assert.match(library, /const THUMB_EDGE = 256;/);
  assert.match(library, /"image\/webp"/);
  assert.match(library, /"image\/jpeg"/);
  assert.match(library, /export async function prepareLibraryFiles/);
  assert.match(librarySheet, /Preparing \$\{done\} of \$\{total\}/);
  assert.match(librarySheet, /label: "Retry"/);
});

await check("the composer owns text, caret, attachments and slash state", () => {
  assert.match(composer, /const \[text, setText\] = useState\(""\)/);
  assert.match(composer, /const \[caret, setCaret\] = useState\(0\)/);
  assert.match(composer, /const MAX_ATTACHMENTS = 10;/);
  assert.match(composer, /const slashQuery = parseSlashCommand\(text\)/);
  assert.match(composer, /export type RealmComposerHandle/);
  assert.match(realm, /const \[scheduleDraft, setScheduleDraft\] = useState\(""\)/);
});

await check("emoji insertion respects the selection and keeps focus", () => {
  assert.match(composer, /const start = node\?\.selectionStart \?\? caret \?\? value\.length;/);
  assert.match(composer, /const end = node\?\.selectionEnd \?\? start;/);
  assert.match(composer, /node\?\.setSelectionRange\(nextCaret, nextCaret\)/);
  assert.ok(
    !/node\?\.blur\(\)/.test(composer),
    "inserting an emoji never blurs the textarea (that closes the keyboard)",
  );
});

await check("IME composition is respected on Android keyboards", () => {
  assert.match(composer, /const composing = useRef\(false\)/);
  assert.match(composer, /onCompositionStart=/);
  assert.match(composer, /onCompositionEnd=/);
  assert.match(composer, /if \(!composing\.current\) \{/);
  assert.match(composer, /Never transform the value here/);
});

await check("auto-resize happens once per frame, not per keystroke", () => {
  assert.match(composer, /window\.requestAnimationFrame\(\(\) => \{/);
  assert.match(composer, /node\.style\.height = "auto";/);
  assert.match(composer, /Math\.min\(MAX_HEIGHT, Math\.max\(MIN_HEIGHT, node\.scrollHeight\)\)/);
  assert.match(composer, /className="composer-input glass max-h-\[140px\]/);
});

await check("paste stays plain text, keeps newlines and never freezes on a wall of text", () => {
  assert.match(composer, /const handlePaste = \(event: React\.ClipboardEvent<HTMLTextAreaElement>\) => \{/);
  assert.match(composer, /clipboard\.getData\("text\/plain"\)/);
  assert.match(composer, /clipboard\.getData\("text\/html"\)/);
  assert.match(composer, /replace\(\/\\r\\n\?\/g, "\\n"\)/);
  assert.match(composer, /event\.preventDefault\(\)/);
  assert.match(composer, /const fileItems = Array\.from\(clipboard\.items \?\? \[\]\)/);
  assert.match(composer, /addFiles\(files\)/);
  assert.match(composer, /That paste is longer than one message/);
  assert.match(composer, /const fragment = normalized\.slice\(0, available\)/);
});

await check("drafts save once per channel after a pause", () => {
  assert.match(composer, /`rizz:realm-draft:\$\{userId\}:\$\{channelKey\}`/);
  assert.match(composer, /window\.setTimeout\(\(\) => \{[\s\S]{0,200}?localStorage\.setItem\(draftKey, text\)/);
  assert.match(composer, /\}, 500\);/);
});

await check("typing broadcasts are throttled to one every three seconds", () => {
  assert.match(dm, /if \(now - lastTypingBroadcastAtRef\.current < 3000\) return;/);
});

await check("multi-file sends keep one attachment per row, caption on the first", () => {
  assert.match(realm, /const \[first, \.\.\.rest\] = urls;/);
  assert.match(realm, /sendRealmRoomMessage\(activeRoomId, user\.id, text\.trim\(\), first \?\? null\)/);
  assert.match(realm, /for \(const url of rest\) await sendRealmRoomMessage\(activeRoomId, user\.id, "", url\)/);
  assert.match(realm, /for \(const url of rest\) await sendRealmMessage\(c\.id, user\.id, "", url\)/);
});

await check("the suite runs this file", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.match(pkg.scripts.test, /node tests\/rizz-library\.test\.mjs/);
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
