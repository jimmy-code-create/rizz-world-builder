/**
 * RIZZ Design Tokens — Single Source of Truth
 *
 * Theme: Lime accent (#c8ff3d) on near-black (#0a0a0b), cream text (#f4f1e7).
 * Flat hierarchy. No purple/teal gradients or glow blooms.
 */

export const TOKENS = {
  colors: {
    bg: "#0a0a0b",
    surface: "#131315",
    surface2: "#1c1c1f",
    border: "rgba(244, 241, 231, 0.13)",
    text: "#f4f1e7",
    textMuted: "#a9a69c",
    accent: "#c8ff3d",
    onAccent: "#0a0a0b",
    danger: "#ff6a55",
  },
  presence: {
    online: "#22c55e",
    idle: "#f59e0b",
    dnd: "#ef4444",
    invisible: "#52525b",
    offline: "#71717a",
  },
  rarities: {
    common: "#94a3b8",
    rare: "#06b6d4",
    epic: "#a855f7",
    legendary: "#facc15",
    mythic: "#ec4899",
  },
  space: {
    4: "4px",
    8: "8px",
    12: "12px",
    16: "16px",
    24: "24px",
  },
  gutter: {
    mobile: "12px",
    tablet: "16px",
    desktop: "24px",
  },
  radii: {
    sm: "4px",
    md: "6px",
    lg: "8px",
    card: "10px",
    pill: "9999px",
  },
  sizes: {
    xs: { box: "20px", glyph: "11px" },
    sm: { box: "28px", glyph: "15px" },
    md: { box: "36px", glyph: "18px" },
    lg: { box: "44px", glyph: "22px" }, // 44px min touch target
    xl: { box: "52px", glyph: "26px" },
  },
  zIndex: {
    content: 0,
    sticky: 20,
    nav: 30,
    fullscreen: 70,
    overlay: 100,
    popover: 150,
    toast: 200,
  },
  motion: {
    fast: "150ms",
    normal: "250ms",
    slow: "350ms",
  },
} as const;

export type ColorRole = keyof typeof TOKENS.colors;
export type PresenceState = keyof typeof TOKENS.presence;
export type RarityRole = keyof typeof TOKENS.rarities;
export type TileSizeRole = keyof typeof TOKENS.sizes;
