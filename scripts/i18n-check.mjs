import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "src/lib/i18n.ts"), "utf8");

// Collect each top-level language block: lines like `  fr: {` … matching `  },`
const langs = {};
const lines = src.split("\n");
let current = null;
let depth = 0;
for (const line of lines) {
  const open = line.match(/^  (en|es|fr|de|ja|hi|pt): \{$/);
  if (open && depth === 0) {
    current = open[1];
    langs[current] = new Set();
    depth = 1;
    continue;
  }
  if (current) {
    for (const ch of line) {
      if (ch === "{") depth += 1;
      if (ch === "}") depth -= 1;
    }
    const key = line.match(/^\s{4}([A-Za-z0-9_]+):/);
    if (key && depth === 1) langs[current].add(key[1]);
    if (depth === 0) current = null;
  }
}

const base = [...(langs.en ?? [])].sort();
const target = process.argv[2] || "fr";
const missing = base.filter((k) => !(langs[target] ?? new Set()).has(k));
if (missing.length === 0) {
  console.log(`i18n:check — ${target} covers all ${base.length} English keys.`);
} else {
  console.log(`i18n:check — ${missing.length} of ${base.length} English keys missing in ${target}:`);
  for (const k of missing) console.log(`  - ${k}`);
}
