/**
 * Bounty security guards.
 *
 * Static checks for the two money paths that are easy to get wrong: a browser
 * must not be able to invent escrow, and a proof URL must not be able to run
 * script in the poster's session. The SQL is also written in the migration;
 * these checks keep a future refactor from quietly dropping it.
 *
 * Run: node tests/bounty-security.test.mjs
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

const security = read("supabase/migrations/20261114000000_bounty_security.sql");
const escrow = read("supabase/migrations/20261107000000_bounty_escrow.sql");
const trust = read("supabase/migrations/20261108000000_bounty_trust.sql");
const server = read("render-server.mjs");
const actions = read("src/components/bounties/BountyActions.tsx");
const moderation = read("src/routes/_app/moderation.tsx");

await check("a browser can only create a free open call", () => {
  assert.ok(
    security.includes('CREATE POLICY "users create free open drops"'),
    "the drops insert policy was not replaced",
  );
  assert.ok(security.includes("AND prize_paws = 0"), "a client can still set a prize");
  assert.ok(security.includes("AND escrow_state = 'none'"), "a client can still claim escrow");
  assert.ok(security.includes("AND assigned_to IS NULL"), "a client can still assign a taker");
  assert.ok(
    security.includes("AND review_deadline IS NULL"),
    "a client can still start the review clock",
  );
});

await check("settling an escrow requires a matching funding ledger row", () => {
  assert.ok(security.includes("require_funded_bounty_escrow"), "no escrow ledger guard");
  assert.ok(
    security.includes("t.kind = 'bounty_escrow'"),
    "the guard does not look for the escrow entry",
  );
  assert.ok(
    security.includes("t.amount = -NEW.prize_paws"),
    "the guard does not match the funded amount",
  );
  assert.ok(
    security.includes("AFTER UPDATE OF escrow_state"),
    "the guard is not attached to settlement",
  );
  assert.match(escrow, /kind, reference_id, description\)[\s\S]*'bounty_escrow'/);
});

await check("proof links and media must be ordinary http(s) URLs", () => {
  assert.ok(security.includes("validate_bounty_submission"), "no submission URL validator");
  assert.ok(security.includes("link !~* '^https?://'"), "links are not scheme-checked");
  assert.ok(security.includes("media !~* '^https?://'"), "media is not scheme-checked");
  assert.ok(security.includes("char_length(link) > 2048"), "links are not length-capped");
  assert.ok(actions.includes("function proofHref"), "the review card has no URL sanitiser");
  assert.ok(actions.includes("if (!href) return null;"), "unsafe old links still render");
});

await check("only an admin can decide an appeal", () => {
  assert.match(trust, /resolve_bounty_warning[\s\S]*has_role\(v_user, 'admin'\)/);
  assert.match(trust, /bounty_appeal_queue[\s\S]*has_role\(v_user, 'admin'\)/);
  assert.ok(moderation.includes("useBountyAppeals"), "the queue page does not use the guarded query");
  assert.ok(
    moderation.includes("resolveBountyWarning"),
    "the queue page does not use the guarded decision RPC",
  );
});

await check("taking a bounty is checked server-side", () => {
  assert.match(trust, /take_bounty[\s\S]*purify_until/);
  assert.match(trust, /take_bounty[\s\S]*cancel_fee/);
  assert.match(trust, /take_bounty[\s\S]*bounty_blocks/);
  assert.match(trust, /take_bounty[\s\S]*min_trust/);
});

await check("the standalone server sets the safe response headers", () => {
  assert.ok(server.includes("setSecurityHeaders(req, res)"), "headers are never applied");
  for (const header of [
    "X-Content-Type-Options",
    "X-Frame-Options",
    "Referrer-Policy",
    "Permissions-Policy",
    "Content-Security-Policy",
    "Strict-Transport-Security",
  ]) {
    assert.ok(server.includes(header), `missing ${header}`);
  }
});

await check("the new server code does not use raw HTML sinks", () => {
  for (const [name, source] of [
    ["BountyActions", actions],
    ["moderation route", moderation],
  ]) {
    assert.ok(!source.includes("dangerouslySetInnerHTML"), `${name} uses a raw HTML sink`);
  }
});

console.log(`\n${passed} checks passed.`);
