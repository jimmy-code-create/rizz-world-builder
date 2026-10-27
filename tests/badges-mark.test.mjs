/**
 * The Badges mark (`src/components/BadgesMark.tsx`).
 *
 * Two things are guarded here:
 *
 * 1. Wiring — the collection used to point at three different stock glyphs, and
 *    "Badges" and "Leaderboard" shared the same trophy in the nav, so the two
 *    rows were indistinguishable. This asserts every Badges entry point draws
 *    the one drawn mark, and that Leaderboard keeps its own.
 * 2. Legibility — the mark is art, and art is easy to break in a later edit
 *    (a star that grows until it eats the disc, ribbons that drift off the
 *    face). When `sharp` is available the real paths are rasterised at 20px and
 *    44px and measured: the star must stay a hole, the disc and both ribbons
 *    must stay solid, and the notched ribbon ends must stay notched.
 *
 * Run: node tests/badges-mark.test.mjs
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

const mark = read("src/components/BadgesMark.tsx");
const shell = read("src/components/AppShell.tsx");
const palette = read("src/components/CommandPalette.tsx");
const accountMenu = read("src/components/account/AccountMenu.tsx");
const badgesPage = read("src/routes/_app/badges.tsx");
const profilePage = read("src/routes/_app/u.$username.tsx");

const badgeEntryOf = (source) =>
  source
    .split("\n")
    .filter((line) => line.includes('"/badges"') || line.includes("to: \"/badges\""))
    .join("\n");

await check("the mark is one path per ribbon plus the punched medal face", () => {
  assert.ok(mark.includes("fillRule=\"evenodd\""), "the star is punched by even-odd, not a mask");
  assert.ok(mark.includes("currentColor"), "the mark inherits the surface colour");
  const discs = mark.match(/M12 3\.15/g) ?? [];
  assert.equal(discs.length, 1, "exactly one medal face");
  assert.ok(mark.includes("M8 13.4") && mark.includes("M16 13.4"), "a ribbon on each side");
});

await check("Badges no longer borrows another section's icon", () => {
  const shellBadges = badgeEntryOf(shell);
  assert.ok(shellBadges.includes("icon: BadgesMark"), `nav entry must use the mark:\n${shellBadges}`);
  assert.ok(shellBadges.includes("labelKey: \"badges\""), "the More sheet entry uses the mark too");
  assert.ok(
    shell.includes('{ to: "/leaderboard", label: "leaderboard", icon: Trophy }'),
    "Leaderboard keeps the trophy — it is the section that is actually a trophy",
  );
  assert.ok(
    palette.includes('{ to: "/badges", label: "Badges", icon: BadgesMark }'),
    "the command palette uses the mark",
  );
  assert.ok(!palette.includes("Trophy"), "and no longer imports the trophy it stopped using");
  assert.ok(
    accountMenu.includes('destRow("/badges", undefined, BadgesMark, "Badges"'),
    "the account menu uses the mark",
  );
  assert.ok(!accountMenu.includes("Medal"), "the stray medal import is gone");
});

await check("the badge shelf and the profile's Badges stat wear it", () => {
  assert.ok(badgesPage.includes("<BadgesMark"), "the shelf header shows the mark");
  assert.ok(!badgesPage.includes("Award,"), "the generic award glyph is no longer imported");
  assert.ok(
    badgesPage.includes('label: "Badges", value: badges.data?.length ?? 0, icon: BadgesMark') ||
      profilePage.includes('label: "Badges", value: badges.data?.length ?? 0, icon: BadgesMark'),
    "the profile activity row shows the mark",
  );
  assert.ok(!profilePage.includes("Award,"), "the profile stops importing the award glyph");
});

// ---- Pixel legibility -------------------------------------------------------
// Unit geometry mirrored from the component so the measurements below can be
// stated in the same 24x24 space the paths are drawn in.
const STAR_CENTRE = [12, 9.75];
const DISC_BAND = [12, 14.5];
const TALE_BODY_Y = 19.0;
const TAIL_BODY_LEFT = [8.0, TALE_BODY_Y];
const TAIL_BODY_RIGHT = [16.0, TALE_BODY_Y];
const NOTCH_ROW_Y = 20.9;
const NOTCH_X0 = 6.4;
const NOTCH_X1 = 7.8;

let sharp = null;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.log("badges-mark: pixel checks skipped (sharp is not installed)");
}

if (sharp) {
  const ribbonPaths = [...mark.matchAll(/d="(M8 [^"]+|M16 [^"]+)"/g)].map((m) => m[1]);
  const discPath = mark.match(/d="(M12 3\.15[^"]+)"/)?.[1];

  // The width/height attributes carry the target size on purpose: sharp ras-
  // terises an SVG at its declared size, so asking it to "resize" a 24px render
  // up to 44px would measure a blur instead of the 44px icon.
  const svgAt = (size) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" color="#101010">
    <rect width="24" height="24" fill="#ffffff"/>
    ${ribbonPaths.map((d) => `<path fill="currentColor" d="${d}"/>`).join("")}
    <path fill="currentColor" fill-rule="evenodd" d="${discPath}"/>
  </svg>`;

  /** Mean luminance (0-255) of a unit-space box rendered at `size` px. */
  const meanAt = async (size, [ux, uy], w = 0.6, h = 0.6) => {
    const scale = size / 24;
    const left = Math.max(0, Math.round(ux * scale - (w * scale) / 2));
    const top = Math.max(0, Math.round(uy * scale - (h * scale) / 2));
    const width = Math.max(1, Math.min(size - left, Math.round(w * scale)));
    const height = Math.max(1, Math.min(size - top, Math.round(h * scale)));
    const png = await sharp(Buffer.from(svgAt(size))).png().toBuffer();
    // Cropping and measuring in two passes on purpose: `stats()` on a chained
    // `extract()` reports the whole image, which would make every reading below
    // silently the same number.
    const crop = await sharp(png).extract({ left, top, width, height }).png().toBuffer();
    const { channels } = await sharp(crop).stats();
    return channels[0].mean;
  };

  for (const size of [20, 44]) {
    await check(`at ${size}px the star stays a punched hole, not a blob`, async () => {
      const hole = await meanAt(size, STAR_CENTRE, 1.6, 1.6);
      const band = await meanAt(size, DISC_BAND);
      assert.ok(hole > 200, `the star must read as background (mean ${hole.toFixed(1)})`);
      assert.ok(band < 80, `the face around it must stay solid (mean ${band.toFixed(1)})`);
    });

    await check(`at ${size}px both ribbons stay solid`, async () => {
      const left = await meanAt(size, TAIL_BODY_LEFT);
      const right = await meanAt(size, TAIL_BODY_RIGHT);
      assert.ok(left < 90, `left ribbon solid (mean ${left.toFixed(1)})`);
      assert.ok(right < 90, `right ribbon solid (mean ${right.toFixed(1)})`);
    });

    await check(`at ${size}px the ribbon ends stay notched`, async () => {
      const notch = await meanAt(size, [NOTCH_X0 + (NOTCH_X1 - NOTCH_X0) / 2, NOTCH_ROW_Y], 1.4, 0.5);
      const body = await meanAt(size, [NOTCH_X0 + (NOTCH_X1 - NOTCH_X0) / 2, TALE_BODY_Y], 1.4, 0.5);
      assert.ok(
        notch > body + 20,
        `the notch must read lighter than the ribbon body (notch ${notch.toFixed(1)} vs body ${body.toFixed(1)})`,
      );
    });
  }

  await check("the mark covers its box like an icon, not a solid tile", async () => {
    const png = await sharp(Buffer.from(svgAt(24))).png().toBuffer();
    const { channels } = await sharp(png).stats();
    const mean = channels[0].mean;
    assert.ok(mean > 140 && mean < 230, `ink coverage in range (mean ${mean.toFixed(1)})`);
  });
}

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
