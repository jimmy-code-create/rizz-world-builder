/**
 * GIF marker parsing. A media-only body used to throw
 * "Cannot read properties of undefined (reading 'toLowerCase')" because
 * `String.match` with a /g regex has no capture groups; the anchored twin
 * fixed it. These checks keep that regression closed.
 *
 * Run: node tests/gif-content.test.mjs
 */
import assert from "node:assert/strict";
import { parseMediaOnly, renderGifSegments } from "../src/lib/gif-content.ts";

const GIF = "![gif](https://media.giphy.com/media/abc123/giphy.gif)";
const STICKER = "![sticker](/stickers/black-cat/peek.webm)";

assert.deepEqual(parseMediaOnly(GIF), {
  src: "https://media.giphy.com/media/abc123/giphy.gif",
  kind: "gif",
});
console.log("ok - a media-only gif parses (used to crash)");

assert.deepEqual(parseMediaOnly(STICKER), { src: "/stickers/black-cat/peek.webm", kind: "sticker" });
console.log("ok - a media-only sticker parses");

assert.deepEqual(parseMediaOnly(`  ${GIF}\n`), {
  src: "https://media.giphy.com/media/abc123/giphy.gif",
  kind: "gif",
});
console.log("ok - surrounding whitespace is trimmed");

assert.equal(parseMediaOnly(`look ${GIF}`), null);
assert.equal(parseMediaOnly(`${GIF} nice`), null);
console.log("ok - a marker inside text is not media-only");

assert.equal(parseMediaOnly(""), null);
assert.equal(parseMediaOnly("just text"), null);
assert.equal(parseMediaOnly(undefined), null);
assert.equal(parseMediaOnly(null), null);
console.log("ok - empty and non-string bodies return null instead of throwing");

assert.equal(
  parseMediaOnly("![gif](https://evil.example.com/x.gif)"),
  null,
  "only giphy and the sticker folders are accepted",
);
console.log("ok - unknown hosts stay plain text");

const mixed = renderGifSegments(`hi ${GIF} bye`);
assert.equal(mixed.length, 3);
assert.equal(mixed[0].value, "hi ");
assert.equal(mixed[1].isGif, true);
assert.equal(mixed[1].value, "https://media.giphy.com/media/abc123/giphy.gif");
assert.equal(mixed[1].marker, GIF);
assert.equal(mixed[2].value, " bye");
console.log("ok - inline gifs split the text without losing characters");

const only = renderGifSegments(GIF);
assert.equal(only.length, 1);
assert.equal(only[0].isGif, true);
assert.equal(only[0].isSticker, false);
console.log("ok - a media-only body renders as one media segment");

const stickerOnly = renderGifSegments(STICKER);
assert.equal(stickerOnly[0].isSticker, true);
console.log("ok - stickers keep their kind");

assert.deepEqual(renderGifSegments(""), []);
assert.deepEqual(renderGifSegments(undefined), []);
console.log("ok - empty bodies render nothing");

const withQuery = renderGifSegments("![gif](https://i.giphy.com/media/x/giphy.gif?cid=abc)");
assert.equal(withQuery[0].isGif, true);
console.log("ok - query strings survive");

console.log("\nAll gif marker checks passed.");
