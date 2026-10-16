/**
 * Failure-feedback tests: template notices + upload error mapping.
 * Pure logic only — no key, no network.
 * Run: node tests/story-feedback.test.mjs
 */
import assert from "node:assert/strict";
import { TEMPLATE_NOTICES, describeUploadError } from "../src/lib/chat-story-import.ts";

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

await check("missing-key notice points at Render env", async () => {
  assert.ok(TEMPLATE_NOTICES.missing_key.includes("GROQ_API_KEY"));
  assert.ok(TEMPLATE_NOTICES.missing_key.includes("Render"));
  assert.ok(TEMPLATE_NOTICES.request_failed.match(/key|model|again/i));
});

await check("permission failures explain sign-in", async () => {
  assert.ok(
    describeUploadError(
      new Error('new row violates row-level security policy for table "chat_stories"'),
    ).match(/sign out and back in/i),
  );
  assert.ok(describeUploadError(new Error("JWT expired")).match(/sign/i));
});

await check("network failures blame the connection, not the file", async () => {
  assert.ok(describeUploadError(new TypeError("Failed to fetch")).match(/network problem/i));
  assert.ok(describeUploadError(new Error("timeout of 30000ms exceeded")).match(/connection/i));
});

await check("unknown errors pass through safely", async () => {
  assert.equal(describeUploadError(new Error("Weird thing")), "Weird thing");
  assert.equal(describeUploadError(null), "Couldn't import that story.");
  assert.ok(describeUploadError(new Error("file too large, payload exceeded")).match(/too large/i));
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
