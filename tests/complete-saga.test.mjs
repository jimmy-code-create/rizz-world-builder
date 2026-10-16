/**
 * Saga-completion tests (pure rewire/lane logic — no key, no network).
 * Run: node tests/complete-saga.test.mjs
 */
import assert from "node:assert/strict";
import { assembleSagaFinale, insertChaptersBeforeFinale } from "../src/lib/story-length.ts";

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

const line = (idx, speaker, next_idx, chapter = "c1") => ({
  idx,
  speaker,
  body: `B${idx}`,
  body_en: `B${idx}`,
  chapter,
  next_idx,
});

await check("insertion moves the choice point, preserves goto lanes", async () => {
  const lines = [line(1, "me", 2), line(2, "them", null)];
  const choices = [
    {
      at_idx: 2,
      position: 0,
      label: "A",
      label_en: "A",
      reply_body: "r",
      reply_body_en: "r",
      goto_idx: 100,
    },
    {
      at_idx: 2,
      position: 1,
      label: "B",
      label_en: "B",
      reply_body: "r",
      reply_body_en: "r",
      goto_idx: 200,
    },
  ];
  const added = [line(0, "narrator", null, ""), line(0, "Dada", null, "")];
  const { lines: merged, choices: moved } = insertChaptersBeforeFinale(
    lines,
    choices,
    added,
    "chapter-2",
  );
  assert.equal(merged.length, 4);
  const head = merged.find((l) => l.idx === 2);
  assert.equal(head.next_idx, 1002);
  assert.equal(merged.find((l) => l.idx === 1002).next_idx, 1003);
  assert.equal(merged.find((l) => l.idx === 1003).next_idx, null);
  assert.ok(moved.every((c) => c.at_idx === 1003));
  assert.deepEqual(
    moved.map((c) => c.goto_idx),
    [100, 200],
  );
  assert.equal(merged.find((l) => l.idx === 1002).chapter, "chapter-2");
});

await check("insertion without choices extends the terminal", async () => {
  const lines = [line(1, "me", 2), line(2, "them", null)];
  const { lines: merged, choices } = insertChaptersBeforeFinale(
    lines,
    [],
    [line(0, "me", null, "")],
    "c2",
  );
  assert.equal(choices.length, 0);
  assert.equal(merged.find((l) => l.idx === 2).next_idx, 1002);
  assert.equal(merged.find((l) => l.idx === 1002).next_idx, null);
});

await check("empty inputs return unchanged", async () => {
  const lines = [line(1, "me", null)];
  assert.deepEqual(insertChaptersBeforeFinale([], [], [line(0, "x", null, "")], "c"), {
    lines: [],
    choices: [],
  });
  assert.deepEqual(insertChaptersBeforeFinale(lines, [], [], "c").lines, lines);
});

await check("finale lanes clear existing indexes", async () => {
  const main = [line(1, "me", 2), line(1500, "them", null)];
  const branches = [
    {
      label: "A",
      label_en: "A",
      reply_body: "r",
      reply_body_en: "r",
      lines: [line(0, "x", null, "")],
    },
  ];
  const { lines, choices } = assembleSagaFinale(main, branches, 1500 + 10_000);
  assert.ok(choices[0].goto_idx > 1500);
  assert.ok(lines.every((l) => l.idx <= 1500 || l.idx >= choices[0].goto_idx));
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
