/**
 * Badge artwork tests: the sprite and the catalog are data, so verify them
 * like data. A missing symbol, a typo'd gradient id or a raster reference all
 * fail silently in the UI (the badge simply renders blank), which is exactly
 * what these checks exist to catch.
 *
 * Run: bun test tests/badge-sprite.test.mjs
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { BADGE_SET, LEGACY_BADGE_SET } from "../src/lib/badge-set.ts";

const svg = await readFile(new URL("../public/badges/badges.svg", import.meta.url), "utf8");

const symbols = new Map();
for (const match of svg.matchAll(/<symbol\s+id="([^"]+)"\s+viewBox="([^"]+)">([\s\S]*?)<\/symbol>/g)) {
  symbols.set(match[1], { viewBox: match[2], body: match[3] });
}

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

const catalog = [...BADGE_SET, ...LEGACY_BADGE_SET];

await check("every catalog badge has artwork in the sprite", async () => {
  assert.ok(symbols.size >= 12, `sprite only has ${symbols.size} symbols`);
  for (const badge of catalog) {
    assert.ok(symbols.has(badge.symbol), `${badge.slug} → #${badge.symbol} is missing`);
    assert.equal(
      badge.art,
      `/badges/badges.svg#${badge.symbol}`,
      `${badge.slug} art must point at its symbol`,
    );
  }
});

await check("no two catalog awards draw the same emblem", async () => {
  // Profile rows render earned badges side by side; a shared symbol reads as
  // the same award repeated. `no-cap` is the documented alias of `verified`.
  const bySymbol = new Map();
  for (const badge of catalog) {
    if (badge.slug === "no-cap") continue;
    const other = bySymbol.get(badge.symbol);
    assert.equal(other, undefined, `${badge.slug} reuses #${badge.symbol} from ${other}`);
    bySymbol.set(badge.symbol, badge.slug);
  }
});

await check("symbols stay on the 24 grid the app renders", async () => {
  // Badge.tsx wraps <use> in a 0 0 24 24 viewBox and badge-share.ts extracts
  // the inner markup into its own 0 0 24 24 document. Any other grid crops.
  for (const [id, symbol] of symbols) {
    assert.equal(symbol.viewBox, "0 0 24 24", `#${id} must be drawn on the 24 grid`);
  }
});

await check("gradient ids are unique and every url(#…) resolves inside its symbol", async () => {
  const ids = [...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const symbolIds = new Set(symbols.keys());
  const defIds = ids.filter((id) => !symbolIds.has(id));
  assert.equal(new Set(defIds).size, defIds.length, "duplicate gradient/def id shadows another fill");

  for (const [id, symbol] of symbols) {
    for (const ref of symbol.body.matchAll(/url\(#([^)]+)\)/g)) {
      assert.ok(
        symbol.body.includes(`id="${ref[1]}"`),
        `#${id} references url(#${ref[1]}) but does not define it`,
      );
    }
  }
});

await check("share-card extraction finds every symbol's markup", async () => {
  // Mirrors loadBadgeSymbol(): the sprite text is fetched, the symbol body is
  // inlined into a standalone SVG and handed to canvas as a data URL.
  for (const badge of catalog) {
    const escaped = badge.symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = svg.match(new RegExp(`<symbol[^>]*id="${escaped}"[^>]*>([\\s\\S]*?)</symbol>`));
    assert.ok(match, `share card cannot extract #${badge.symbol}`);
    assert.ok(match[1].trim().length > 40, `#${badge.symbol} has no drawable markup`);
  }
});

await check("artwork is vector-only so it survives the canvas export", async () => {
  assert.ok(!/<image\b/.test(svg), "no raster <image> references in the sprite");
  assert.ok(!/<filter\b/.test(svg), "no filters — share canvas and 20px chips must stay cheap");
  assert.ok(!/data:image\//.test(svg), "no embedded bitmaps");
  assert.ok(/width="0"\s+height="0"/.test(svg), "sprite must stay a zero-size definitions document");
});

await check("every emblem is a gradient silhouette with depth layers", async () => {
  // The set's language: one tier-gradient silhouette, then engraving, glyph and
  // specular layers on top. Glyphs may be filled or stroked (a check mark is a
  // stroke), and light emblems like Night Owl intentionally carry no ink glyph.
  for (const [id, symbol] of symbols) {
    assert.ok(
      /fill="url\(#bzg-[^)]+\)"/.test(symbol.body),
      `#${id} must be filled by its own tier gradient`,
    );
    const shapes = symbol.body.match(/<(path|circle|rect|ellipse|polygon)\b/g) ?? [];
    assert.ok(shapes.length >= 3, `#${id} needs depth layers beyond its silhouette`);
  }
});

await check("the Purify mark keeps its cat crest, halo, vignette and gold flame", async () => {
  const purify = symbols.get("purify");
  assert.ok(purify, "purify has art in the sprite");
  assert.ok(purify.body.includes("bzg-purify"), "the amethyst tier gradient is still the fill");
  assert.ok(purify.body.includes("bzg-purify-vignette"), "the inner vignette is drawn");
  assert.ok(
    purify.body.includes('stroke="#C084FC"') && purify.body.includes('stroke="#D8B4FE"'),
    "the glow is a pair of violet halo strokes",
  );
  assert.ok(purify.body.includes("bzg-purify-gold"), "the lotus core keeps its gold flame");
  assert.ok(purify.body.includes("M3.1 10.1V3.8"), "the cat-ear crest is still the silhouette");
  assert.ok(!purify.body.includes("<rect"), "the mark has a transparent background");
});

await check("the verified seal keeps its blue halo, vignette and check", async () => {
  const verified = symbols.get("verified");
  assert.ok(verified, "verified has art in the sprite");
  assert.ok(verified.body.includes("bzg-verified"), "the azure tier gradient is still the fill");
  assert.ok(
    verified.body.includes("bzg-verified-vignette"),
    "the inner vignette is drawn over the seal",
  );
  assert.ok(
    verified.body.includes('stroke="#45C4FF"') && verified.body.includes('stroke="#7AD8FF"'),
    "the glow border is a pair of blue halo strokes",
  );
  assert.ok(verified.body.includes('stroke-width="2.7"'), "the white check stays bold at 20px");
  assert.ok(!verified.body.includes("<rect"), "the seal has a transparent background");
});

console.log(`\n${passed} checks passed.`);
