/**
 * Reel Party + mention highlights.
 *
 * Two things a future edit can quietly undo:
 *
 *  1. The party is host-authoritative. Guests must not autoplay, scroll or
 *     advance on their own, while the host must publish the reel, play/pause
 *     and seek. If the guard disappears, the room drifts apart.
 *  2. Comments must render the same @mention chip as chat and reel captions.
 *     Falling back to plain <GifContent> makes mentions inert again.
 *
 * Run: node tests/reel-party.test.mjs
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
const party = read("src/lib/reel-party.ts");
const reels = read("src/routes/_app/reels.tsx");
const commentBody = read("src/components/comments/CommentBody.tsx");

const sheet = read("src/components/reels/ReelPartySheet.tsx");
const sprite = read("public/badges/badges.svg");

await check("a party code is short, random and unambiguous", () => {
  assert.match(party, /export const REEL_PARTY_CODE_LENGTH = 6/);
  assert.match(party, /crypto\.getRandomValues\(bytes\)/);
  assert.ok(
    party.includes('ABCDEFGHJKLMNPQRSTUVWXYZ23456789'),
    "the alphabet must skip I, O, 0 and 1 so a code can be read aloud",
  );
  assert.match(party, /byte % CODE_ALPHABET\.length/);
});

await check("pasted invite links and messy codes both normalize", () => {
  assert.match(party, /export function normalizeReelPartyCode/);
  assert.match(party, /\[\?&\]party=\(\[A-Z0-9\]\{6\}\)/, "invite links are understood");
  assert.match(party, /replace\(\/\[\^A-Z0-9\]\/g, ""\)/, "spaces and dashes are tolerated");
  assert.match(party, /code\.length === REEL_PARTY_CODE_LENGTH/, "wrong lengths are rejected");
});

await check("the room is presence + broadcast, with no table", () => {
  assert.match(party, /supabase\.channel\(`reel-party-\$\{code\}`/);
  assert.match(party, /config: \{ presence: \{ key: presenceKey \} \}/);
  assert.match(party, /channel\.on\("presence", \{ event: "sync" \}/);
  assert.match(party, /event: "sync"/);
  assert.match(party, /event: "hello"/);
  assert.match(party, /subscribeSafely\(channel/);
  assert.match(party, /supabase\.removeChannel\(channel\)/);
  assert.doesNotMatch(party, /supabase\s*\.from\(/, "a party never writes to the database");
});

await check("only the host publishes, and a heartbeat keeps late guests aligned", () => {
  assert.match(party, /if \(!hostRef\.current\) return;[\s\S]{0,80}sendSync/, "publish is host-only");
  assert.match(party, /window\.setInterval\([\s\S]{0,220}?\}, 2500\)/, "the host heartbeats");
  assert.match(party, /if \(hostRef\.current\) \{[\s\S]{0,140}?sendSync\(channel, snapshot\)/, "subscribe resyncs the room");
  assert.match(party, /else \{[\s\S]{0,160}?event: "hello"/, "a guest announces itself on subscribe");
  assert.match(party, /onSyncRef\.current\(\{[\s\S]{0,420}?at: sync\.at/, "guests receive the host clock");
});

await check("the feed has a party entry point and a shareable /reels?party= link", () => {
  assert.match(reels, /validateSearch:[\s\S]{0,160}?party/);
  assert.match(reels, /const \{ party: partyParam \} = Route\.useSearch\(\)/);
  assert.match(reels, /<ReelPartySheet/);
  assert.match(reels, /aria-label=\{party\.code \? "Reel party controls" : "Start a reel party"\}/);
  assert.match(party, /`\$\{origin\}\/reels\?party=\$\{encodeURIComponent\(code\)\}`/);
  assert.match(reels, /navigator\.clipboard\.writeText\(reelPartyInviteUrl/);
  assert.match(sheet, /value=\{reelPartyInviteUrl\(code\)\}/);
});

await check("a guest follows the host instead of fighting it", () => {
  assert.match(
    reels,
    /const partyControlled = !!party\.code && !party\.isHost && party\.hostPresent/,
  );
  assert.match(
    reels,
    /partyControlled \? "overflow-y-hidden" : "overflow-y-auto"/,
    "a controlled guest cannot swipe away from the host",
  );
  assert.match(reels, /partyControlled=\{partyControlled\}/);
  assert.match(reels, /if \(partyControlled\) \{[\s\S]{0,160}?return \(\) => \{ cancelled = true; \};/, "no guest autoplay");
  assert.match(reels, /if \(!video \|\| !isActive \|\| partyControlled\) return;/, "no guest play/pause");
  assert.match(reels, /!isExternal && !partyControlled && <button/, "the guest loses the pause control");
  assert.match(reels, /if \(!partyControlled && autoplay && isActive\) onEnded\(\);/, "the guest never advances the room");
});

await check("the host publishes swipe, play, pause and seek", () => {
  assert.match(reels, /publishPartySnapshot\(\);[\s\S]{0,80}?\}, \[activeIndex, publishPartySnapshot\]\)/);
  assert.match(reels, /scroller\.addEventListener\("play", onPlayback, true\)/);
  assert.match(reels, /scroller\.addEventListener\("pause", onPlayback, true\)/);
  assert.match(reels, /scroller\.addEventListener\("seeked", onPlayback, true\)/);
  assert.match(reels, /scroller\.scrollTo\(\{ top, behavior: "smooth" \}\)/);
  assert.match(reels, /Date\.now\(\) - sync\.at\) \/ 1000/, "guests age the playhead during flight");
});

await check("joining by link works, and a signed-out invite asks for a login", () => {
  assert.match(reels, /normalizeReelPartyCode\(partyParam\)/);
  assert.match(reels, /if \(party\.join\(normalizedPartyParam\)\)/);
  assert.match(reels, /setPartyOpen\(true\);[\s\S]{0,80}?toast\.info\("Sign in to join the reel party"\)/);
  assert.match(sheet, /to="\/login"/);
});

await check("no floating status pill sits over the reel — the icon is the room", () => {
  assert.ok(!reels.includes("ReelPartyBar"), "the floating pill is gone");
  assert.ok(!reels.includes("Reel party ·"), "no status line is painted over the video");
  assert.match(
    reels,
    /aria-label=\{party\.code \? "Reel party controls" : "Start a reel party"\}/,
    "the toolbar icon is the single entry point",
  );
  assert.match(reels, /members=\{party\.members\}/, "the icon's sheet gets the roster");
});

await check("the party sheet lists who is watching", () => {
  assert.match(sheet, /Watching now/);
  assert.match(sheet, /members: ReelPartyMember\[\]/);
  assert.match(sheet, /members\.map\(\(member\)/);
  assert.match(sheet, /member\.self/, "a watcher can tell which row is them");
  assert.match(sheet, /member\.host/, "the host is called out");
  assert.match(sheet, /aria-label="Party invite link"/);
  assert.match(sheet, /Leave party/);
});

await check("each tab is its own presence entry, so the host is never overwritten", () => {
  assert.match(party, /function makePresenceKey\(userId: string\)/);
  assert.match(party, /\$\{userId\}#\$\{suffix\}/, "key is account + tab");
  assert.match(
    party,
    /config: \{ presence: \{ key: presenceKey \} \}/,
    "the channel tracks under that key",
  );
  assert.doesNotMatch(
    party,
    /config: \{ presence: \{ key: userId \} \}/,
    "an account-wide key lets a second window clobber the host flag",
  );
});

await check("watchers announce their name and avatar for the roster", () => {
  assert.match(party, /identity\?: ReelPartyIdentity \| null/);
  assert.match(party, /name: self\?\.name/);
  assert.match(party, /avatar: self\?\.avatar/);
  assert.match(party, /username: self\?\.username/);
  assert.match(party, /setMembers\(roster\)/);
  assert.match(party, /self: key === presenceKey/, "a watcher can tell which row is them");
  assert.match(reels, /const partyIdentity = useMemo/);
});

await check("host liveness comes from the playhead itself, not presence alone", () => {
  assert.match(party, /lastSyncAt\.current = Date\.now\(\);/, "every sync proves the host is alive");
  assert.match(party, /setHostPresent\(true\);\s*\n\s*onSyncRef\.current/, "and opens the lock");
  assert.match(party, /HOST_ABSENCE_MS/);
  assert.match(party, /Date\.now\(\) - lastSyncAt\.current > HOST_ABSENCE_MS/);
  assert.match(party, /roster\.some\(\(member\) => member\.host\)/, "presence agrees");
});

await check("the sheet can start, join, copy, leave and host a fresh room", () => {
  assert.match(sheet, /Start a reel party/);
  assert.match(sheet, /or join with a code/);
  assert.match(sheet, /placeholder="ABC123"/);
  assert.match(sheet, /Leave party/);
  assert.match(sheet, /Start a new party/);
  assert.match(sheet, /Anyone with the link can join/);
});

await check("reel comments go through the shared thread, mentions included", () => {
  assert.match(
    reels,
    /<CommentSection[\s\S]{0,160}?postId=\{postId\}/,
    "reel comments must mount the shared thread, not a private flat list",
  );
  assert.ok(
    !/<GifContent>\{c\.body\}<\/GifContent>/.test(reels),
    "the plain body renderer leaves mentions inert",
  );
  assert.match(reels, /className="mention-highlight font-semibold underline underline-offset-2"/);
});

await check("post comments render the same mention chip", () => {
  assert.match(commentBody, /export function CommentBody\(\{ body \}: \{ body: string \}\)/);
  assert.match(commentBody, /renderGifSegments\(body\)/);
  assert.match(commentBody, /renderCaptionWithTags\(segment\.value\)/);
  assert.match(commentBody, /className="mention-highlight font-semibold"/);
  assert.ok(
    !commentBody.includes("<GifContent>{comment.body}</GifContent>"),
    "mentions in ordinary post comments must not stay plain text",
  );
});

await check("a guest reads comments with the host", () => {
  // Reading together: the comments sheet is part of the room. The sync carries
  // it, the host reports it, and the guest's sheet follows on the same reel.
  assert.match(party, /comments: boolean;/);
  assert.match(party, /comments: sync\.comments === true/);
  assert.match(reels, /const \[partyComments, setPartyComments\] = useState\(false\)/);
  assert.match(reels, /setPartyComments\(sync\.comments\)/);
  assert.match(reels, /comments: hostCommentsRef\.current/);
  assert.match(reels, /if \(!party\.isHost \|\| hostCommentsRef\.current === open\) return;/);
  assert.match(reels, /onCommentsOpenChange=\{activeIndex === index \? reportHostComments : undefined\}/);
  assert.match(reels, /setCommentsOpen\(partyComments\)/);
  assert.match(reels, /Host is reading/);
  // A guest may still open comments themselves: the follower only reacts to a
  // change in the host's state.
  assert.match(reels, /\}, \[partyComments, partyControlled\]\);/);
});

await check("the Purify mark is an amethyst orbiting crystal", () => {
  const start = sprite.indexOf('<symbol id="purify"');
  assert.ok(start > -1, "the sprite carries the Purify symbol");
  const symbol = sprite.slice(start, sprite.indexOf("</symbol>", start));
  assert.ok(symbol.includes('id="bzg-purify"'), "the amethyst crystal gradient is present");
  assert.ok(symbol.includes('fill="url(#bzg-purify)"'), "the crystal uses the gradient");
  assert.ok(symbol.includes('transform="rotate(-27 12 12)"'), "the violet orbit surrounds the crystal");
  assert.ok(!symbol.includes("<filter"), "the sprite stays filter-free for cheap 20px drawing");
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
