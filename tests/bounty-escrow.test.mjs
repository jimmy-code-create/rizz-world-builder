/**
 * Bounty escrow guards.
 *
 * The escrow board is the only place in RIZZ where one member's Paws are held
 * on behalf of a decision another member makes later, so the invariants are
 * checked here rather than trusted:
 *
 *   1. the prize leaves the poster's wallet when the bounty goes live,
 *   2. it pays out exactly once, through one shared money path,
 *   3. an unreviewed submission pays out on its own after the review window,
 *   4. backing out costs a fine that doubles once somebody is on it,
 *   5. the client shows the same numbers the database will charge,
 *   6. proof is private to the poster and the worker,
 *   7. the legacy free open call cannot be used as a back door into a prize.
 *
 * Static guards (no DOM, no database) per repo test convention.
 * Run: node tests/bounty-escrow.test.mjs
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

// The contract is split across two migrations: escrow first, trust/fees second.
// Later definitions win, so `fnBody` below reads the newest version.
const sql = [
  read("supabase/migrations/20261107000000_bounty_escrow.sql"),
  read("supabase/migrations/20261108000000_bounty_trust.sql"),
].join("\n\n");
const lib = read("src/lib/bounties.ts");
const page = read("src/routes/_app/drops.tsx");
const card = read("src/components/bounties/BountyCard.tsx");
const actions = read("src/components/bounties/BountyActions.tsx");
const postDialog = read("src/components/bounties/PostBountyDialog.tsx");

/** The body of one `CREATE OR REPLACE FUNCTION public.<name>` block. */
function fnBody(name) {
  const start = sql.lastIndexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  assert.ok(start >= 0, `migration is missing public.${name}()`);
  const end = sql.indexOf("\n$$;", start);
  assert.ok(end > start, `public.${name}() is not terminated`);
  return sql.slice(start, end);
}

await check("the prize leaves the poster's wallet when a bounty goes live", () => {
  const post = fnBody("post_paws_bounty");
  assert.ok(post.includes("paw_balance = paw_balance - _prize"), "post does not debit the poster");
  assert.ok(post.includes("'bounty_escrow'"), "escrow debit is not in the Paws ledger");
  assert.ok(post.includes("FOR UPDATE"), "post does not lock the wallet row");
  assert.ok(post.includes("You need % Paws in escrow"), "post can overdraw the wallet");
  assert.ok(post.includes("'held', 'open'"), "bounty is not stored as held/open");
  assert.match(post, /claim_limit, expires_at, prize_paws/, "prize bounty is stored like a normal one");
  assert.match(post, /_media_url,\s*\n\s*1,/, "an escrow bounty is not exclusive (claim_limit is not 1)");
  // Escrow writes are the only ones allowed past the wallet guard.
  assert.ok(
    post.includes("set_config('rizz.paw_writer', 'on', true)") &&
      post.includes("set_config('rizz.paw_writer', 'off', true)"),
    "post does not bracket its wallet write with the paw_writer flag",
  );
  assert.ok(
    postDialog.includes("postPawsBounty(") && postDialog.includes("Paws move to escrow now"),
    "the poster is not told the Paws leave now",
  );
});

await check("escrow pays out exactly once, through one shared money path", () => {
  const payout = fnBody("payout_bounty");
  assert.ok(payout.includes("SET paw_balance = paw_balance + v_drop.prize_paws"));
  assert.ok(payout.includes("bounties_completed = bounties_completed + 1"), "no reputation credit");
  assert.ok(payout.includes("'bounty_payout'"), "payout is not in the Paws ledger");
  assert.ok(payout.includes("escrow_state <> 'held'"), "a settled bounty can be paid twice");
  assert.ok(payout.includes("escrow_state = 'paid'"), "escrow is not marked paid");

  // The one money path is reachable only from approval and from the clock.
  assert.ok(fnBody("review_bounty_submission").includes("RETURN public.payout_bounty(_drop_id, v_note)"));
  assert.ok(fnBody("release_overdue_bounty_payout").includes("RETURN public.payout_bounty("));
  assert.ok(
    sql.includes("REVOKE ALL ON FUNCTION public.payout_bounty(uuid, text)"),
    "the payout function is callable without a decision",
  );
});

await check("an unreviewed submission pays out on its own", () => {
  const submit = fnBody("submit_bounty_proof");
  assert.ok(submit.includes("make_interval(hours => (v_cfg ->> 'review_hours')::integer)"));
  assert.ok(submit.includes("review_deadline = v_deadline"), "the review clock is never started");
  assert.ok(submit.includes("'submitted'"), "the submission is not recorded");

  const auto = fnBody("release_overdue_bounty_payout");
  assert.ok(auto.includes("review_deadline > now()"), "auto-payout can fire inside the review window");
  assert.ok(auto.includes("Auto-paid"), "auto-payout does not say why it happened");
  assert.ok(
    sql.includes("GRANT EXECUTE ON FUNCTION public.release_overdue_bounty_payout(uuid)") &&
      sql.includes("TO authenticated"),
    "the worker cannot trigger the auto-payout",
  );
  assert.ok(
    lib.includes('"release_overdue_bounty_payout"') && card.includes("Release my"),
    "the worker has no way to release an overdue payout",
  );
});

await check("backing out costs a fine that doubles once somebody is on it", () => {
  const fee = fnBody("bounty_fee");
  assert.ok(fee.includes("'taken_fee_multiplier'"), "the taken multiplier is not the config's");
  assert.ok(fee.includes("LEAST("), "the fine can exceed the prize");
  assert.ok(fee.includes("GREATEST("), "the fine has no floor");

  const cancel = fnBody("cancel_bounty");
  assert.ok(cancel.includes("v_taken := v_drop.state IN ('taken', 'submitted')"));
  assert.ok(cancel.includes("public.bounty_fee(v_drop.prize_paws, v_taken)"));
  assert.ok(cancel.includes("SET paw_balance = paw_balance + v_refund"), "the refund never lands");
  assert.ok(cancel.includes("'bounty_fine'"), "the fine is not a ledger entry");
  assert.ok(cancel.includes("bounties_cancelled = bounties_cancelled + 1"), "cancel is not counted");

  // Free to let it run out: expiry refunds the whole prize with no fee.
  const expire = fnBody("settle_expired_bounties");
  assert.ok(expire.includes("paw_balance = paw_balance + v_drop.prize_paws"));
  assert.ok(!expire.includes("bounty_fee"), "letting it expire should not be charged");
});

await check("the client shows the numbers the database will charge", () => {
  // `cancelFee` mirrors `bounty_fee`; both read the same config, so the dialog
  // can never promise a different fee than the one charged.
  const rules = lib.slice(lib.indexOf("export const BOUNTY_RULES"), lib.indexOf("export type BountyCreator"));
  for (const [field, key] of [
    ["minPrize", "min_prize"],
    ["maxPrize", "max_prize"],
    ["feePercent", "fee_percent"],
    ["feeMin", "fee_min"],
    ["takenFeeMultiplier", "taken_fee_multiplier"],
    ["reviewHours", "review_hours"],
    ["minHours", "min_hours"],
    ["maxHours", "max_hours"],
    ["maxRejections", "max_rejections"],
    ["maxLinks", "max_links"],
    ["maxMedia", "max_media"],
  ]) {
    assert.ok(rules.includes(`${field}:`), `BOUNTY_RULES is missing ${field}`);
    assert.ok(sql.includes(`'${key}'`), `the SQL config is missing ${key}`);
  }
  const value = (field) => Number(rules.match(new RegExp(`${field}:\\s*([\\d_]+)`))?.[1]?.replace(/_/g, ""));
  const sqlValue = (key) => Number(sql.match(new RegExp(`'${key}',\\s*([\\d_]+)`))?.[1]?.replace(/_/g, ""));
  assert.equal(value("feePercent"), sqlValue("fee_percent"), "fee percent drifted between UI and SQL");
  assert.equal(value("feeMin"), sqlValue("fee_min"), "fee floor drifted between UI and SQL");
  assert.equal(
    value("takenFeeMultiplier"),
    sqlValue("taken_fee_multiplier"),
    "taken multiplier drifted between UI and SQL",
  );
  assert.equal(value("maxPrize"), sqlValue("max_prize"), "prize cap drifted between UI and SQL");
  assert.equal(value("reviewHours"), sqlValue("review_hours"), "review window drifted between UI and SQL");
  assert.ok(lib.includes("feeMin"), "the fine floor is not applied in cancelFee");

  // The fee doubles, is floored, and is capped in the browser too.
  assert.ok(lib.includes("base * (taken ? rules.takenFeeMultiplier : 1)"));
  assert.ok(lib.includes("Math.min(prize, base"));
  assert.ok(actions.includes("cancelling is not free"), "the cancel warning is missing");
  assert.ok(actions.includes("The fee doubles"), "the doubled fee is not explained");
  assert.ok(card.includes("Paws fee"), "the card does not name the fee");
});

await check("every RPC the client calls exists in the migration", () => {
  const called = [...lib.matchAll(/callBountyRpc[^(]*\(\s*"([a-z_]+)"/g)].map((m) => m[1]);
  assert.ok(called.length >= 6, `expected the escrow RPC wrappers, found ${called.length}`);
  for (const name of called) {
    assert.ok(sql.includes(`FUNCTION public.${name}(`), `${name} has no migration`);
  }
  // `bounty_submissions` is a new table, so the client reaches it the same
  // untyped way the realm RPC helpers do.
  assert.ok(lib.includes('(supabase.from as any)("bounty_submissions")'));
});

await check("proof is private to the pair, and only the RPCs may write it", () => {
  assert.ok(sql.includes("ALTER TABLE public.bounty_submissions ENABLE ROW LEVEL SECURITY"));
  const policy = sql.slice(sql.indexOf('CREATE POLICY "bounty submissions for the pair"'));
  assert.ok(policy.includes("auth.uid() = user_id"), "the worker cannot read their own proof");
  assert.ok(policy.includes("creator_id FROM public.drops"), "the poster cannot read the proof");
  assert.ok(
    sql.includes("No INSERT/UPDATE/DELETE policies"),
    "submissions can be written without going through the RPCs",
  );
  assert.ok(sql.includes("status IN ('submitted', 'approved', 'rejected', 'withdrawn')"));
});

await check("the free open call is not a back door into a prize bounty", () => {
  const trigger = fnBody("reward_bounty_claim");
  assert.ok(trigger.includes("prize_paws > 0"), "claiming pays a prize bounty twice");
  assert.ok(trigger.includes("public.bounty_paw_reward()"), "the flat open-call reward was dropped");

  const validate = fnBody("validate_bounty_claim");
  assert.ok(validate.includes("prize_paws > 0"), "a prize bounty can be claimed through claim_bounty");
  assert.ok(validate.includes("Take that bounty from the bounty page"));

  // Escrow bounties are exclusive: exactly one member at a time.
  const take = fnBody("take_bounty");
  assert.ok(take.includes("assigned_to IS NOT NULL"), "a taken bounty can be taken twice");
  assert.ok(take.includes("assigned_to = v_user"), "taking the same bounty twice is not a no-op");
  assert.ok(take.includes("ON CONFLICT DO NOTHING"), "re-taking breaks the claim history");
  assert.ok(take.includes("'bounty_taken'"), "the poster is not notified");
});

await check("every bounty event reaches the inbox with copy for it", () => {
  const notifications = read("src/routes/_app/notifications.tsx");
  const i18n = read("src/lib/i18n.ts");
  const types = [
    ...new Set(
      [...sql.matchAll(/INSERT INTO public\.notifications[^;]*?'(bounty_[a-z_]+)',/gs)].map(
        (match) => match[1],
      ),
    ),
  ];
  assert.ok(types.length >= 6, `expected one type per event, found ${types.length}: ${types}`);
  for (const type of types) {
    assert.ok(notifications.includes(`${type}:`), `${type} has no icon and copy mapping`);
    assert.ok(notifications.includes(`${type}: "notif_${type}"`), `${type} maps to the wrong copy key`);
    const key = `notif_${type}:`;
    assert.ok(
      i18n.split(key).length - 1 >= 2,
      `${key} is missing a translation (needs every locale)`,
    );
  }
  assert.ok(
    notifications.includes('n.type.startsWith("bounty")'),
    "a bounty alert has nowhere to go when tapped",
  );
});

await check("the board tells each side what happens next", () => {
  assert.ok(page.includes("<BountyCard"), "the board does not render the bounty card");
  assert.ok(page.includes("bountiesNeedingYou"), "the \"your desk\" rail is missing");
  assert.ok(page.includes("viewerRole"), "the page cannot tell who is looking");
  assert.ok(page.includes("settleExpiredBounties"), "expiry housekeeping never runs");
  assert.ok(page.includes("escrowHeld") && page.includes("held in escrow"), "held Paws are not shown");
  assert.ok(card.includes("bountyNextStep"), "the card does not say what to do next");
  assert.ok(card.includes("Review the work") && card.includes("Submit work"), "an action is missing");
  assert.ok(card.includes("Hand it back"), "a worker cannot walk away");
  assert.ok(actions.includes("Ask for more"), "a poster cannot send work back");
  assert.ok(actions.includes("rejectionsLeft"), "the review limit is not shown");
  // One confirm dialog shell for the whole app, never window.confirm.
  assert.ok(card.includes("ConfirmDialog") && !page.includes("window.confirm"));
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
