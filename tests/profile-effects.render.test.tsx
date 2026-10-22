/**
 * Profile effects on every profile surface.
 *
 * The preview card, the hover card and the full profile all render the shared
 * <ProfileHeader>. This test executes that header with all three equipped
 * slots and proves the layers are really in the HTML — Puppy Love over the
 * banner, Dark Moon's frame, and Bloodweb on the avatar — so a worn cosmetic
 * can never silently disappear from the preview or the full profile.
 *
 * Run: bun tests/profile-effects.render.test.tsx
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProfileHeader } from "../src/components/profile/ProfileHeader.tsx";

let passed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`FAIL - ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

const html = renderToStaticMarkup(
  createElement(ProfileHeader, {
    user: {
      id: "member-1",
      username: "jimmy",
      displayName: "Jimmy",
      avatarUrl: null,
      bannerUrl: null,
      bannerMode: "gradient" as const,
      bannerGradient: null,
      updatedAt: null,
      accentColor: "#c8ff3d",
    },
    effects: {
      profile_effect: { slug: "fx-puppy-love" },
      avatar_decoration: { slug: "fx-bloodweb" },
      profile_frame: { slug: "fx-dark-moon" },
    },
    statusEnabled: false,
  }),
);

const page = readFileSync(new URL("../src/routes/_app/u.$username.tsx", import.meta.url), "utf8");
const settings = readFileSync(
  new URL("../src/routes/_app/settings/profile.tsx", import.meta.url),
  "utf8",
);
const preview = readFileSync(new URL("../src/components/ProfilePreview.tsx", import.meta.url), "utf8");
const card = readFileSync(
  new URL("../src/components/profile/ProfileCard.tsx", import.meta.url),
  "utf8",
);
const header = readFileSync(
  new URL("../src/components/profile/ProfileHeader.tsx", import.meta.url),
  "utf8",
);

const glowHtml = renderToStaticMarkup(
  createElement(ProfileHeader, {
    user: {
      id: "member-1",
      username: "jimmy",
      displayName: "Jimmy",
      avatarUrl: null,
      bannerUrl: null,
      bannerMode: "none" as const,
      bannerGradient: null,
      updatedAt: null,
      accentColor: "#3b82f6",
    },
    avatarGlow: "#3b82f6",
    statusEnabled: false,
  }),
);

check("all three worn looks render in the shared header", () => {
  assert.ok(html.includes('class="plx'), "Puppy Love must paint the banner");
  assert.ok(html.includes("dmf"), "Dark Moon must frame the banner");
  assert.ok(html.includes("pl-bw"), "Bloodweb must wrap the avatar");
});

check("the effects stay clipped inside the banner, above the scrim", () => {
  assert.ok(
    html.indexOf("plx") < html.indexOf("dmf"),
    "the banner effect paints before the frame",
  );
  assert.match(header, /absolute inset-0 z-\[22\] overflow-hidden/, "Puppy Love is clipped");
  assert.match(header, /absolute inset-0 z-\[25\] overflow-hidden/, "the frame is clipped");
  assert.match(header, /pointer-events-none/, "effects never eat taps");
});

check("every profile surface wears the equipped looks", () => {
  for (const source of [page, settings, preview, card]) {
    assert.ok(source.includes("<ProfileHeader"), "a surface stopped using the shared header");
    assert.ok(source.includes("effects="), "a surface forgot its equipped effects");
  }
  assert.ok(page.includes("profile_effect: shownEffect"));
  assert.ok(page.includes("avatar_decoration: shownDecoration"));
  assert.ok(page.includes("profile_frame: shownFrame"));
  assert.ok(preview.includes("effects={equipped.data}"));
  assert.ok(card.includes("effects={equipped.data}"));
  assert.ok(settings.includes("effects={equipped.data}"));
});

check("the preview avatar glows instead of wearing a hard ring", () => {
  assert.ok(preview.includes("avatarGlow={p.accent_color}"), "the preview must pass the accent glow");
  assert.ok(!preview.includes("avatarRing="), "the preview must not draw the blue ring");
  assert.ok(glowHtml.includes("color-mix(in srgb"), "the glow must paint a soft halo");
  assert.ok(!glowHtml.includes("0 0 0 2px"), "no hard ring may render when a glow is asked for");
});

check("the avatar sits flush left with the name row", () => {
  assert.ok(
    !header.includes('marginLeft: "calc(var(--avatar-size) * 0.1 + 8px)"'),
    "the old inset that pushed the avatar right is gone",
  );
  assert.match(header, /marginLeft: "calc\(var\(--avatar-size\) \* 0\.08\)"/);
});

check("no profile-card download is offered anywhere", () => {
  for (const source of [page, preview, card, settings]) {
    assert.ok(!/Download profile card|Download card/i.test(source), "a download control survived");
  }
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
