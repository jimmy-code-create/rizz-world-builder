import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const lockfilePath = resolve(process.cwd(), "package-lock.json");
const internalPrefix = "http://package-firewall.replit.internal/npm/";
const publicPrefix = "https://registry.npmjs.org/";
const lockfile = await readFile(lockfilePath, "utf8");
const normalized = lockfile.replaceAll(internalPrefix, publicPrefix);
const changedCount = (lockfile.match(/http:\/\/package-firewall\.replit\.internal\/npm\//g) ?? []).length;

if (lockfile.includes("package-firewall.replit.internal") && changedCount === 0) {
  throw new Error("The package lockfile contains an unrecognized Replit package host URL.");
}

if (changedCount > 0) {
  await writeFile(lockfilePath, normalized);
  console.log(`Normalized ${changedCount} lockfile URLs to the public npm registry.`);
}
