/**
 * Profile interests are a `text[]` column written by more than one surface, so
 * a row can contain null or blank entries. The suggestion rail called
 * `.toLowerCase()` straight on them, which threw
 * "Cannot read properties of undefined (reading 'toLowerCase')" and replaced
 * the whole feed route with the error page.
 *
 * Run: node tests/profile-interests.test.mjs
 */
import assert from "node:assert/strict";
import { normalizeInterests } from "../src/lib/profile-interests.ts";

assert.deepEqual(normalizeInterests(undefined), []);
assert.deepEqual(normalizeInterests(null), []);
assert.deepEqual(normalizeInterests("Music"), []);
assert.deepEqual(normalizeInterests({ 0: "music" }), []);
console.log("ok - a missing or non-array value behaves like no interests");

assert.deepEqual(
  normalizeInterests(["Music", null, undefined, "", "  ", 42, "Gaming"]),
  ["music", "gaming"],
);
console.log("ok - null, blank and non-string entries are dropped, the rest lowercased");

assert.deepEqual(normalizeInterests(["Music", "music", " MUSIC "]), ["music"]);
console.log("ok - duplicates collapse after trimming and lowercasing");

// The exact shape that crashed: an array with a hole.
const withHole = ["music"];
withHole[2] = undefined;
assert.deepEqual(normalizeInterests(withHole), ["music"]);
console.log("ok - a sparse array no longer throws");

console.log("\nAll profile interest checks passed.");
