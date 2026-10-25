/**
 * Profile interests come from a `text[]` column that has been written by more
 * than one surface over time, so a row can contain null/blank entries. Calling
 * `.toLowerCase()` on those crashed the whole feed route ("Cannot read
 * properties of undefined (reading 'toLowerCase')") the moment the suggestion
 * rail mounted. Everything that reads interests goes through here instead.
 */
export function normalizeInterests(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const clean = item.trim().toLowerCase();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
  }
  return [...seen];
}
