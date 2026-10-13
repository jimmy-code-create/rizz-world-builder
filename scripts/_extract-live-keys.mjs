// Extracts the PUBLIC Supabase client config (URL + publishable key) that every
// visitor's browser already downloads from the live site's JS bundle, and writes
// it to a JSON file. Never prints the values — only yes/no diagnostics.
import { writeFileSync } from "node:fs";

const SITE = process.argv[2] || "https://rizzapp.onrender.com/";
const OUT = process.argv[3] || "/tmp/live-keys.json";

async function get(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.text();
}

const html = await get(SITE);
const origin = new URL(SITE).origin;
const assetPaths = [...new Set(html.match(/\/assets\/[A-Za-z0-9_.-]+\.(?:js|mjs)/g) ?? [])];
let bundles = [html];
let fetched = 0;
for (const path of assetPaths) {
  try {
    bundles.push(await get(origin + path));
    fetched++;
  } catch {
    /* skip unreachable chunk */
  }
}
const all = bundles.join("\n");

const url = all.match(/https:\/\/[a-z0-9-]+\.(?:supabase\.co|supabase\.in)/)?.[0] ?? "";
const publishable =
  all.match(/sb_publishable_[A-Za-z0-9_.=-]{8,}/)?.[0] ??
  all.match(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/)?.[0] ?? "";

const leakedSecret = /sb_secret_[A-Za-z0-9_.=-]{8,}|SUPABASE_SERVICE_ROLE/.test(all);

if (url && publishable) {
  writeFileSync(OUT, JSON.stringify({ VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: publishable }));
}

console.log(`assets fetched: ${fetched}`);
console.log(`supabase url found: ${url ? "yes" : "no"} (host: ${url ? url.replace(/^[^.]+/, "https://****") : "-"})`);
console.log(`publishable key found: ${publishable ? "yes" : "no"} (${publishable.startsWith("sb_") ? "new-format" : publishable ? "jwt-format" : "-"})`);
console.log(`secret-looking key leaked in bundle: ${leakedSecret ? "YES - security issue, flag to user" : "no"}`);
console.log(`written to ${OUT}: ${url && publishable ? "yes" : "no"}`);
