/**
 * Voice room layout tiers — one pure function so the grid can be tested and
 * tuned without a browser.
 *
 * Tiers:
 *   1 person  → solo: one centered tile
 *   2 people  → pair: stacked, shorter tiles
 *   3-4       → quad: 2x2
 *   5-9       → grid: 3 short columns
 *   10+       → stage + audience: up to six large stage tiles and a compact
 *               audience strip (virtualized at 25+).
 */
export type VoiceLayoutTier = "solo" | "pair" | "quad" | "grid" | "stage";

export type VoiceLayout = {
  tier: VoiceLayoutTier;
  /** Columns in the stage/participant grid. */
  columns: number;
  /** A tile never grows taller than this; it keeps a lone tile from filling the room. */
  tileMaxHeight: number;
  /** Avatar diameter inside a tile. */
  avatarSize: number;
  gap: number;
  aspect: "16 / 9" | "4 / 3";
  /** True when the room splits into stage + audience. */
  audience: boolean;
  /** Columns in the compact audience grid. */
  audienceColumns: number;
  /** Render only the visible audience rows. */
  virtualize: boolean;
  /** Names under audience avatars (hidden once the crowd gets big). */
  showAudienceNames: boolean;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function computeVoiceLayout({
  count,
  width,
  height,
  hasVideo = false,
}: {
  count: number;
  width: number;
  height?: number;
  hasVideo?: boolean;
}): VoiceLayout {
  const people = clamp(Number.isFinite(count) ? Math.floor(count) : 1, 1, 999);
  const gap = width < 380 ? 8 : 12;
  const videoAspect: VoiceLayout["aspect"] = "16 / 9";
  const portrait: VoiceLayout["aspect"] = "4 / 3";

  if (people <= 1) {
    return {
      tier: "solo",
      columns: 1,
      // A lone participant used to stretch into a wall of empty glass; cap it.
      tileMaxHeight: hasVideo ? 200 : 220,
      avatarSize: 96,
      gap,
      aspect: hasVideo ? videoAspect : portrait,
      audience: false,
      audienceColumns: 1,
      virtualize: false,
      showAudienceNames: true,
    };
  }

  if (people === 2) {
    return {
      tier: "pair",
      columns: 1,
      tileMaxHeight: 180,
      avatarSize: 80,
      gap,
      aspect: hasVideo ? videoAspect : portrait,
      audience: false,
      audienceColumns: 1,
      virtualize: false,
      showAudienceNames: true,
    };
  }

  if (people <= 4) {
    return {
      tier: "quad",
      columns: 2,
      tileMaxHeight: 200,
      avatarSize: 72,
      gap,
      aspect: hasVideo ? videoAspect : portrait,
      audience: false,
      audienceColumns: 2,
      virtualize: false,
      showAudienceNames: true,
    };
  }

  if (people <= 9) {
    return {
      tier: "grid",
      columns: 3,
      tileMaxHeight: 150,
      avatarSize: 64,
      gap,
      aspect: hasVideo ? videoAspect : portrait,
      audience: false,
      audienceColumns: 3,
      virtualize: false,
      showAudienceNames: true,
    };
  }

  const stageColumns = width >= 760 ? 3 : 2;
  const acoustic = 44 + 8; // avatar + breathing room
  return {
    tier: "stage",
    columns: stageColumns,
    tileMaxHeight: hasVideo ? 190 : 160,
    avatarSize: 64,
    gap,
    aspect: hasVideo ? videoAspect : portrait,
    audience: true,
    audienceColumns: clamp(Math.floor((width - 24) / acoustic), 4, 10),
    virtualize: people >= 25,
    showAudienceNames: people < 20,
  };
}

/** Screen-reader label for a participant tile or audience avatar. */
export function voiceParticipantLabel({
  name,
  speaking,
  muted,
  video,
}: {
  name: string;
  speaking?: boolean;
  muted?: boolean;
  video?: boolean;
}): string {
  return [name, speaking ? "speaking" : null, muted ? "muted" : null, video ? "camera on" : null]
    .filter(Boolean)
    .join(", ");
}
