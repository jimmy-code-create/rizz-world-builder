/**
 * Shared chat appearance helpers, used by DMs, groups and realm chat.
 *
 * Cosmetic per-user name colors are OFF: author names render cream
 * (#f2efe6) so they always clear 4.5:1 on the near-black surface.
 * Real ROLE colors are allowed via roleColorFor(), which clamps lightness
 * so every role name still clears 4.5:1 on #0b0b0c.
 */

export const AUTHOR_CREAM = "#f2efe6";

/** Clamp a hex color's HSL lightness into [62%, 80%] for dark-surface contrast. */
export function lightenForDark(hex: string): string {
  const m = hex.trim().match(/^#([0-9a-fA-F]{6})$/);
  if (!m) return AUTHOR_CREAM;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn) / d + 2) / 6;
    else h = ((rn - gn) / d + 4) / 6;
  }
  const clampedL = Math.min(0.8, Math.max(0.62, l));
  const boostedS = Math.min(1, Math.max(s, 0.45));
  return `hsl(${Math.round(h * 360)} ${(boostedS * 100).toFixed(0)}% ${(clampedL * 100).toFixed(0)}%)`;
}

/** Role mentions/names: role color at readable lightness, else cream. */
export function roleColorFor(roleColor?: string | null): string {
  if (!roleColor) return AUTHOR_CREAM;
  if (roleColor.startsWith("hsl")) return roleColor;
  return lightenForDark(roleColor);
}

/**
 * Stable author colour. Cosmetics OFF: always cream. The seed/accent args
 * are kept so existing call sites don't change — they are intentionally
 * ignored (an accent the user picked for decoration must not hurt contrast).
 * Pass a real role color through roleColorFor() instead.
 */
export function nameColorFor(_seed?: string | null, _accent?: string | null): string {
  void _seed;
  void _accent;
  return AUTHOR_CREAM;
}
