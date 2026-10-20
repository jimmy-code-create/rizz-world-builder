/**
 * Render test for the profile badge showcase section.
 *
 * The wiring test greps for the seam; this one executes the real component
 * through renderToStaticMarkup, so the hooks, the sanitizer feeding the
 * display, the earned-gating and the owner controls all have to actually run
 * and produce HTML. Branches covered: visitor showcase, visitor fallback,
 * owner with and without an equipped set, the unearned-slug filter, the
 * loading state, the empty profile, and the Link-based empty state inside a
 * memory router.
 *
 * Run: bun tests/profile-badges.render.test.tsx
 */
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { ProfileBadgesSection } from "../src/components/profile/ProfileBadgesSection.tsx";
import type { Badge } from "../src/lib/badges.ts";

const mk = (slug: string, name: string, rarity: Badge["rarity"] = "rare"): Badge => ({
  id: `b-${slug}`,
  slug,
  name,
  description: `${name} badge`,
  icon: ":cat_cool:",
  color: "#C6FF1A",
  rarity,
});

const earned: Badge[] = [
  mk("rookie", "Rookie", "common"),
  mk("og", "OG", "legendary"),
  mk("rising-star", "Rising Star", "epic"),
  mk("meme-lord", "Meme Lord", "rare"),
];

type SectionProps = {
  profileId: string;
  isOwner: boolean;
  stored?: string[] | null;
  earned: Badge[];
  loading?: boolean;
};

function renderSection(props: SectionProps): string {
  const client = new QueryClient();
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(ProfileBadgesSection, { profileId: "profile-1", ...props }),
    ),
  );
}

/** One "class=\"badge\"" per rendered badge chip. */
function chips(html: string): number {
  return (html.match(/class="badge"/g) ?? []).length;
}

let passed = 0;
async function check(name: string, fn: () => void | Promise<void>) {
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

await check("visitor sees exactly the equipped showcase, not the equip control", () => {
  const html = renderSection({ isOwner: false, stored: ["og", "rookie"], earned });
  assert.equal(chips(html), 2, "two equipped badges render two chips");
  assert.ok(html.includes('aria-label="Profile badges"'), "section must be labelled");
  assert.ok(!html.includes("Equip badges"), "visitors never see the owner control");
});

await check("a stored slug the member never earned does not render", () => {
  const html = renderSection({ isOwner: false, stored: ["not-earned", "og"], earned });
  assert.equal(chips(html), 1, "only the earned slug survives the sanitizer");
});

await check("visitor without an equipped set keeps the full earned row", () => {
  const html = renderSection({ isOwner: false, stored: [], earned });
  assert.equal(chips(html), earned.length, "fallback shows every earned badge");
  assert.ok(!html.includes("Equip badges"), "still no owner control for visitors");
});

await check("owner with nothing equipped gets the equip control and the invitation", () => {
  const html = renderSection({ isOwner: true, stored: [], earned });
  assert.equal(chips(html), 0);
  assert.ok(html.includes("Equip badges"), "owner control must render");
  assert.ok(html.includes("Showcase the badges you"), "invitation copy must render");
});

await check("owner with an equipped set shows it and offers to change it", () => {
  const html = renderSection({ isOwner: true, stored: ["rising-star"], earned });
  assert.equal(chips(html), 1);
  assert.ok(html.includes("Change badges"), "equipped state offers changing instead");
});

await check("the loading state never flashes an empty or wrong section", () => {
  const html = renderSection({ isOwner: true, stored: undefined, earned: [], loading: true });
  assert.ok(html.includes("animate-pulse"), "loading renders the skeleton");
  assert.ok(!html.includes("Equip badges"), "no control before the data is in");
});

await check("a visitor with nothing to show renders no section at all", () => {
  assert.equal(renderSection({ isOwner: false, stored: [], earned: [] }), "");
});

await check("owner with no badges at all links to the gallery (router branch)", async () => {
  const rootRoute = createRootRoute({ component: () => createElement(Outlet) });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () =>
      createElement(ProfileBadgesSection, {
        profileId: "profile-1",
        isOwner: true,
        stored: [],
        earned: [],
      }),
  });
  const badgesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/badges",
    component: () => null,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, badgesRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  const client = new QueryClient();
  const html = renderToStaticMarkup(
    createElement(QueryClientProvider, { client }, createElement(RouterProvider, { router })),
  );
  assert.ok(
    html.includes("collect them in the badge gallery"),
    `empty state copy must render — got: ${html.slice(0, 300) || "(empty string)"}`,
  );
  assert.ok(html.includes('href="/badges"'), "the link must point at the badge gallery");
});

console.log(`\n${passed} checks passed.`);
