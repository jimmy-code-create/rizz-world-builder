/**
 * Assets, prices and rights metadata for the cinematic profile effects.
 *
 * The videos are VP9 files with a real alpha plane, 1600x480 at 24fps. The
 * effect itself is 853x480 in the centre; the transparent sides let a member's
 * banner image show through on a profile. Each poster is a PNG frame from the
 * same clip, so a poster is never a stand-in for a different animation.
 *
 * Build them with:
 *   CINEMATIC_SOURCE=/path/to/source.mp4 npm run effects:build-cinematic
 */

export type CinematicAsset = {
  slug: string;
  video: string;
  poster: string;
  accent: string;
  /** One-time launch price in USD. */
  priceUsd: number;
  /**
   * Supplied third-party character footage. The buy sheet must stay locked
   * until the operator confirms they have the rights to sell it.
   */
  rightsReview?: boolean;
};

export const CINEMATIC_EFFECTS: CinematicAsset[] = [
  {
    slug: "fx-web-slinger",
    video: "/effects/cinematic/web-slinger.webm",
    poster: "/effects/cinematic/web-slinger.png",
    accent: "#e8253f",
    priceUsd: 4.99,
    rightsReview: true,
  },
  {
    slug: "fx-sakura-bloom",
    video: "/effects/cinematic/sakura-bloom.webm",
    poster: "/effects/cinematic/sakura-bloom.png",
    accent: "#fb7185",
    priceUsd: 2.99,
  },
  {
    slug: "fx-arcane-nexus",
    video: "/effects/cinematic/arcane-nexus.webm",
    poster: "/effects/cinematic/arcane-nexus.png",
    accent: "#a855f7",
    priceUsd: 3.99,
  },
  {
    slug: "fx-sakura-storm",
    video: "/effects/cinematic/sakura-storm.webm",
    poster: "/effects/cinematic/sakura-storm.png",
    accent: "#f472b6",
    priceUsd: 3.49,
  },
];

export const CINEMATIC_BY_SLUG: Record<string, CinematicAsset> = Object.fromEntries(
  CINEMATIC_EFFECTS.map((asset) => [asset.slug, asset]),
);
