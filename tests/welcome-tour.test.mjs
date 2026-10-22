/**
 * Welcome tour — new members meet Rizzy over the real app, not a slide deck.
 *
 * The guards below cover the handoff from profile setup into the feed, the
 * invite that must survive the tour, the single completion write, and the
 * coach marks that spotlight real controls instead of a mock-up.
 *
 * Run: bun tests/welcome-tour.test.mjs
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [login, signup, join, tutorial, shell, host, overlay, tourCss, onboarding, settings, accountMenu, feed, postCard, settingsProfile] =
  await Promise.all([
    read("src/routes/login.tsx"),
    read("src/routes/signup.tsx"),
    read("src/routes/join.$code.tsx"),
    read("src/routes/tutorial.tsx"),
    read("src/components/AppShell.tsx"),
    read("src/components/onboarding/WelcomeTourHost.tsx"),
    read("src/components/onboarding/WelcomeTourOverlay.tsx"),
    read("src/components/onboarding/welcome-tour.css"),
    read("src/lib/onboarding.ts"),
    read("src/routes/_app/settings/index.tsx"),
    read("src/components/account/AccountMenu.tsx"),
    read("src/routes/_app/feed.tsx"),
    read("src/components/PostCard.tsx"),
    read("src/routes/_app/settings/profile.tsx"),
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

await check("new members finish onboarding on the feed", async () => {
  assert.match(onboarding, /if \(!profile\.tutorial_seen\) return "\/tutorial";/);
  // The shell sends new members to the feed, where the coach marks can point
  // at the real composer, stories, nav and account menu.
  assert.match(
    shell,
    /if \(!profile\.tutorial_seen && path !== "\/feed"\) nav\(\{ to: "\/feed" \}\)/,
  );
  assert.ok(
    !/if \(loading \|\| !user \|\| !profile\?\.username \|\| !profile\.tutorial_seen\)/.test(shell),
    "the shell must render the feed while the tour is open",
  );
  assert.match(host, /if \(path !== "\/feed"\) return;/);
  assert.match(host, /setOpen\(true\)/);
});

await check("the profile steps still come before the tour", async () => {
  for (const [name, source] of [
    ["login", login],
    ["signup", signup],
  ]) {
    const profileAt = source.indexOf('nav({ to: "/tutorial", search: { replay: false } })');
    const inviteAt = source.indexOf("getPendingInvitePath()");
    assert.ok(profileAt > -1, `${name} never routes new members through profile setup`);
    assert.ok(inviteAt > -1, `${name} lost the pending-invite handoff`);
    assert.ok(profileAt < inviteAt, `${name} checks the invite before onboarding`);
    assert.match(source, /if \(profile\?\.username && !profile\.tutorial_seen\)/, `${name} gate`);
  }
  assert.match(tutorial, /setTourPending\(user\.id, true\)/);
  assert.match(tutorial, /nav\(\{ to: "\/feed" \}\)/);
  assert.ok(!tutorial.includes("RizzyTour"), "the slide deck must be gone");
});

await check("the join page keeps the invite and waits for the tour", async () => {
  assert.match(join, /const \{ user, profile, loading \} = useAuth\(\)/);
  assert.match(join, /if \(!profile\.tutorial_seen\) \{[\s\S]*?sessionStorage\.setItem\(PENDING_INVITE_KEY, code\)/);
  assert.match(join, /if \(!user \|\| autoJoinStarted\.current \|\| !profile\?\.tutorial_seen\) return;/);
});

await check("only the overlay marks the tour complete", async () => {
  assert.match(overlay, /\.update\(\{ tutorial_seen: true \}\)/);
  assert.equal((overlay.match(/tutorial_seen: true/g) ?? []).length, 1, "one completion write");
  assert.ok(
    !/tutorial_seen: true/.test(host) && !/tutorial_seen: true/.test(tutorial),
    "the host and profile steps must not mark the tour complete",
  );
  assert.match(overlay, /getPendingInvitePath\(\)/);
  assert.match(host, /setTourPending\(user\.id, false\)/);
});

await check("the tour is a transparent cat over the real controls", async () => {
  assert.match(overlay, /className="wt-root"/);
  assert.match(overlay, /className="wt-spot"/);
  assert.match(overlay, /className=\"wt-cat\"/);
  assert.match(overlay, /<Rizzy pose=\{step\.pose\} \/>/);
  for (const target of [
    "\"#feed-composer\"",
    "\"[data-tour='stories']\"",
    "\"[data-tour='post-like']\"",
    "\"[data-tour='account']\"",
    "\"[data-tour='nav-realms']\"",
    "\"[data-tour='mobile-more']\"",
  ]) {
    assert.ok(overlay.includes(target), `the tour stopped pointing at ${target}`);
  }
  // The app really exposes those hooks.
  assert.match(feed, /data-tour="stories"/);
  assert.match(feed, /data-tour="composer"/);
  assert.match(postCard, /data-tour="post"/);
  assert.match(postCard, /data-tour="post-like"/);
  assert.match(shell, /"nav-realms"/);
  assert.match(shell, /data-tour="mobile-more"/);
  assert.match(accountMenu, /data-tour="account"/);
  assert.match(tourCss, /\.wt-root \{[\s\S]*?pointer-events: none;/, "the layer must not block the page");
  assert.match(tourCss, /\.wt-spot \{[\s\S]*?9999px/, "the spotlight must dim everything but the control");
  assert.match(tourCss, /\.wt-cat \{[\s\S]*?animation: wt-float/);
  assert.match(tourCss, /prefers-reduced-motion: reduce/);
});

await check("the old slide deck is retired", async () => {
  for (const path of [
    "src/components/onboarding/RizzyTour.tsx",
    "src/components/onboarding/rizzy-tour.css",
  ]) {
    assert.ok(!existsSync(new URL(`../${path}`, import.meta.url)), `${path} still exists`);
  }
});

await check("welcome is still a personal greeting", async () => {
  assert.match(overlay, /const firstName = displayName\.trim\(\)/);
  assert.match(overlay, /`Hi \$\{firstName\} — I'm Rizzy\.`/);
});

await check("the tour is first-run only — no manual replay survives", async () => {
  assert.ok(!onboarding.includes("WELCOME_TOUR_EVENT"), "the replay event must be gone");
  assert.ok(!onboarding.includes("startWelcomeTour"), "the replay entry point must be gone");
  assert.ok(!host.includes("WELCOME_TOUR_EVENT"), "the host must not listen for a replay");
  assert.ok(!host.includes("addEventListener"), "nothing can re-open the tour by hand");
  assert.ok(!settings.includes("Welcome tour"), "Settings must not offer the tour");
  assert.ok(!accountMenu.includes("Welcome tour"), "the account menu must not offer the tour");
  assert.ok(!accountMenu.includes("Replay the welcome tour"));
  assert.match(host, /if \(profile\.tutorial_seen\) return;/, "only new members start it");
  assert.match(host, /path !== "\/feed"/, "it still opens over the real feed");
});

await check("Settings has a way back and previews the joined date", async () => {
  assert.match(settings, /aria-label="Back"/, "the settings hub needs a back control");
  assert.match(settingsProfile, /handleExtra=/, "the live preview prints the handle row detail");
  assert.match(settingsProfile, /Joined \{joined\}/, "the joined month sits beside the handle");
  assert.ok(settingsProfile.includes("/brand/rizz-cat-logo.svg"), "the joined date carries the mark");
});

console.log(`\n${passed} checks passed.`);
