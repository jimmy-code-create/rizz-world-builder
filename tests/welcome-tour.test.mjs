/**
 * Welcome tour — every new member meets Rizzy before the app opens.
 *
 * These guards cover the paths that used to skip onboarding: an invite link
 * handled before the tour, and a direct join page. They also lock the welcome
 * scene's personalized greeting and hero presentation in place.
 *
 * Run: bun tests/welcome-tour.test.mjs
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [login, signup, join, tutorial, shell, tour, tourCss, onboarding] = await Promise.all([
  read("src/routes/login.tsx"),
  read("src/routes/signup.tsx"),
  read("src/routes/join.$code.tsx"),
  read("src/routes/tutorial.tsx"),
  read("src/components/AppShell.tsx"),
  read("src/components/onboarding/RizzyTour.tsx"),
  read("src/components/onboarding/rizzy-tour.css"),
  read("src/lib/onboarding.ts"),
]);

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

await check("the tour is the gate for accounts without tutorial_seen", async () => {
  assert.match(onboarding, /if \(!profile\.tutorial_seen\) return "\/tutorial";/);
  assert.match(shell, /else if \(!profile\.tutorial_seen\) nav\(\{ to: "\/tutorial", search: \{ replay: false \} \}\)/);
  // The shell must also hold the app behind the loader until the tour is done.
  assert.match(shell, /if \(loading \|\| !user \|\| !profile\?\.username \|\| !profile\.tutorial_seen\) \{/);
});

await check("a new member is sent to the tour before a pending invite", async () => {
  for (const [name, source] of [
    ["login", login],
    ["signup", signup],
  ]) {
    const tourAt = source.indexOf('nav({ to: "/tutorial", search: { replay: false } })');
    const inviteAt = source.indexOf("getPendingInvitePath()");
    assert.ok(tourAt > -1, `${name} never routes new members to the tour`);
    assert.ok(inviteAt > -1, `${name} lost the pending-invite handoff`);
    assert.ok(tourAt < inviteAt, `${name} checks the invite before the welcome tour`);
    assert.match(source, /if \(profile\?\.username && !profile\.tutorial_seen\)/, `${name} gate`);
  }
});

await check("the join page keeps the invite and waits for the tour", async () => {
  assert.match(join, /const \{ user, profile, loading \} = useAuth\(\)/);
  assert.match(join, /if \(!profile\.tutorial_seen\) \{[\s\S]*?sessionStorage\.setItem\(PENDING_INVITE_KEY, code\)/);
  assert.match(join, /if \(!user \|\| autoJoinStarted\.current \|\| !profile\?\.tutorial_seen\) return;/);
});

await check("only finishing or skipping writes tutorial_seen", async () => {
  assert.match(tutorial, /\.update\(\{ tutorial_seen: true \}\)/);
  assert.equal((tutorial.match(/tutorial_seen: true/g) ?? []).length, 1, "one completion write");
  assert.ok(
    !/tutorial_seen: true/.test(tour) && !/tutorial_seen: true/.test(onboarding),
    "the tour component must not mark itself complete",
  );
  // Finishing still resolves the invite that the tour preserved.
  assert.match(tutorial, /getPendingInvitePath\(\)/);
});

await check("welcome is a personalized brand moment, not a generic slide", async () => {
  assert.match(tour, /const firstName = \(profile\?\.display_name \|\| profile\?\.username/, "greets by name");
  assert.match(tour, /`Hey \$\{firstName\} — welcome to RIZZ\.`/, "personal welcome headline");
  assert.match(tour, /rz-stage--welcome/, "welcome gets its own stage treatment");
  assert.match(tour, /rz-welcome-halo/);
  assert.match(tour, /rz-welcome-wordmark/);
  assert.match(tour, /\[\"Feed\", \"Realms\", \"Voice\", \"DMs\"\]/, "brand feature trail");
  assert.match(tourCss, /\.rz-stage--welcome \.rz-mascot \{[\s\S]*?width: min\(70%, 290px\)/);
  assert.match(tourCss, /\.rz-welcome-halo \{[\s\S]*?rgba\(201, 255, 61/);
  assert.match(tourCss, /\.rz-welcome-chip \{/);
});

await check("the welcome copy matches what ships: one effect, no spider", async () => {
  assert.ok(tour.includes("Puppy Love"));
  assert.ok(tour.includes("Biscuit"));
  assert.ok(!/web[- ]slinger/i.test(tour), "the retired effect is still advertised in the tour");
  assert.ok(!tour.includes("avatar decoration"), "removed decoration shelf is still advertised");
  assert.ok(!tour.includes("nameplate"), "removed nameplate is still advertised");
});

console.log(`\n${passed} checks passed.`);
