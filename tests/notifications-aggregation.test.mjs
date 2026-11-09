import assert from "node:assert/strict";

import {
  aggregateNotifications,
  exampleSingle,
  exampleTwo,
  exampleThree,
  exampleFifteen,
  exampleThirteenHourGap,
} from "../src/lib/notifications-aggregation.ts";

let passed = 0;
const check = async (name, fn) => {
  try {
    await fn();
    passed += 1;
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`FAIL - ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
};

const BASE = 1_700_000_000_000; // fixed reference "now"

const event = (overrides = {}) => ({
  id: "evt-1",
  resource_id: "post-1",
  type: "reaction",
  actor: "alice",
  created_at: new Date(BASE).toISOString(),
  body: null,
  target_url: "/p/post-1",
  ...overrides,
});

await check("single event -> one card, count 1", () => {
  const cards = aggregateNotifications(exampleSingle(), BASE, "reacted to your post");
  assert.equal(cards.length, 1);
  assert.equal(cards[0].count, 1);
  assert.equal(cards[0].actorList, "@alice");
  assert.equal(cards[0].summary, "@alice reacted to your post");
});

await check("two actors -> '@a and @b'", () => {
  const cards = aggregateNotifications(exampleTwo(), BASE, "reacted to your post");
  assert.equal(cards.length, 1);
  assert.equal(cards[0].count, 2);
  assert.equal(cards[0].actorList, "@alice and @bob");
  assert.equal(cards[0].summary, "@alice and @bob reacted to your post");
});

await check("three actors -> '@a, @b and 1 others'", () => {
  const cards = aggregateNotifications(exampleThree(), BASE, "reacted to your post");
  assert.equal(cards.length, 1);
  assert.equal(cards[0].count, 3);
  assert.equal(cards[0].actorList, "@alice, @bob and 1 others");
  assert.equal(cards[0].summary, "@alice, @bob and 1 others reacted to your post");
});

await check("fifteen actors -> '@a, @b and 13 others'", () => {
  const cards = aggregateNotifications(exampleFifteen(), BASE, "reacted to your post");
  assert.equal(cards.length, 1);
  assert.equal(cards[0].count, 15);
  assert.equal(cards[0].actorList, "@alice, @bob and 13 others");
});

await check("12h boundary stays in one group (gap not greater than window)", () => {
  const twelveHoursMs = 12 * 60 * 60 * 1000;
  const cards = aggregateNotifications([
    event({ id: "a", created_at: new Date(BASE).toISOString(), actor: "alice" }),
    event({
      id: "b",
      created_at: new Date(BASE - twelveHoursMs).toISOString(),
      actor: "bob",
    }),
  ]);
  assert.equal(cards.length, 1, "exactly 12h apart should not split");
  assert.equal(cards[0].count, 2);
});

await check("13h gap splits into two cards", () => {
  const cards = aggregateNotifications(exampleThirteenHourGap(), BASE);
  assert.equal(cards.length, 2, "13h gap must split into two cards");
  assert.equal(cards[0].count, 1);
  assert.equal(cards[1].count, 1);
});

await check("different types do not group", () => {
  const cards = aggregateNotifications([
    event({ id: "a", type: "reaction", actor: "alice" }),
    event({ id: "b", type: "mention", actor: "bob" }),
  ]);
  assert.equal(cards.length, 2);
});

await check("different resource_id do not group", () => {
  const cards = aggregateNotifications([
    event({ id: "a", resource_id: "post-1", actor: "alice" }),
    event({ id: "b", resource_id: "post-2", actor: "bob" }),
  ]);
  assert.equal(cards.length, 2);
});

console.log(`${passed} checks passed`);
