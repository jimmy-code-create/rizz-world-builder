/**
 * The clothes.
 *
 * The supplied garment files turned out to be a shop scene and a loose pair of
 * trousers — neither is skinned to the avatar, so they cannot be worn. What the
 * model does have is real garment meshes with their own UVs (`outfit_top`,
 * `outfit_bottom`), so clothes are made the way a textile is: a woven pattern
 * drawn to canvas and painted through those UVs.
 *
 * Every pattern is drawn in neutral greys on purpose. `tint.ts` recolours a
 * texture by keeping each pixel's shade and taking its hue from the swatch, so a
 * grey weave plus the outfit colour gives denim in any colour, plaid in any
 * colour, knit in any colour — five fabrics times the whole palette, instead of
 * five fixed outfits.
 */

export type OutfitStyleId = "tee" | "knit" | "denim" | "plaid" | "stripe";

export const OUTFIT_STYLES: { id: OutfitStyleId; name: string; swatch: string }[] = [
  { id: "tee", name: "Tee", swatch: "#f2f2f4" },
  { id: "knit", name: "Knit", swatch: "#6f7480" },
  { id: "denim", name: "Denim", swatch: "#3d5a80" },
  { id: "plaid", name: "Plaid", swatch: "#b23b3b" },
  { id: "stripe", name: "Stripe", swatch: "#1b1b1f" },
];

export function outfitStyleFor(id: string | null | undefined): OutfitStyleId {
  return OUTFIT_STYLES.find((entry) => entry.id === id)?.id ?? "tee";
}

export type ClothKind = OutfitStyleId | "pant";

const cache = new Map<ClothKind, HTMLCanvasElement>();

const SIZE = 512;

/** Fine grain that reads as fibre at preview size rather than as noise. */
function grain(ctx: CanvasRenderingContext2D, amount: number) {
  for (let i = 0; i < SIZE * SIZE * 0.12; i += 1) {
    const x = Math.random() * SIZE;
    const y = Math.random() * SIZE;
    const shade = Math.random() < 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${shade},${shade},${shade},${Math.random() * amount})`;
    ctx.fillRect(x, y, 1, 1);
  }
}

function weave(ctx: CanvasRenderingContext2D, spacing: number, strength: number) {
  ctx.lineWidth = 1;
  for (let i = -SIZE; i < SIZE * 2; i += spacing) {
    ctx.strokeStyle = `rgba(255,255,255,${strength})`;
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i - SIZE, SIZE);
    ctx.stroke();
    ctx.strokeStyle = `rgba(0,0,0,${strength * 0.7})`;
    ctx.beginPath();
    ctx.moveTo(i + spacing / 2, 0);
    ctx.lineTo(i + spacing / 2 - SIZE, SIZE);
    ctx.stroke();
  }
}

function bands(
  ctx: CanvasRenderingContext2D,
  colour: string,
  height: number,
  width: number,
  step: number,
) {
  ctx.fillStyle = colour;
  for (let y = 0; y < SIZE; y += step) ctx.fillRect(0, y, SIZE, height);
  for (let x = 0; x < SIZE; x += step) ctx.fillRect(x, 0, width, SIZE);
}

function paint(kind: ClothKind): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  switch (kind) {
    case "knit": {
      ctx.fillStyle = "#c8c8c8";
      ctx.fillRect(0, 0, SIZE, SIZE);
      weave(ctx, 5, 0.16);
      grain(ctx, 0.22);
      break;
    }
    case "denim": {
      ctx.fillStyle = "#c4cbd6";
      ctx.fillRect(0, 0, SIZE, SIZE);
      weave(ctx, 4, 0.3);
      grain(ctx, 0.3);
      break;
    }
    case "plaid": {
      ctx.fillStyle = "#b9b9b9";
      ctx.fillRect(0, 0, SIZE, SIZE);
      bands(ctx, "rgba(255,255,255,0.5)", 16, 16, 64);
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      for (let y = 0; y < SIZE; y += 64) ctx.fillRect(0, y + 30, SIZE, 3);
      for (let x = 0; x < SIZE; x += 64) ctx.fillRect(x + 30, 0, 3, SIZE);
      grain(ctx, 0.18);
      break;
    }
    case "stripe": {
      ctx.fillStyle = "#dcdcdc";
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.fillStyle = "rgba(30,30,30,0.55)";
      for (let y = 0; y < SIZE; y += 48) ctx.fillRect(0, y, SIZE, 20);
      grain(ctx, 0.16);
      break;
    }
    case "pant": {
      // One pair of jeans: indigo twill, selvedge lines, a little wear.
      ctx.fillStyle = "#c9cfd8";
      ctx.fillRect(0, 0, SIZE, SIZE);
      weave(ctx, 3, 0.34);
      grain(ctx, 0.34);
      break;
    }
    case "tee":
    default: {
      ctx.fillStyle = "#d5d5d5";
      ctx.fillRect(0, 0, SIZE, SIZE);
      weave(ctx, 8, 0.07);
      grain(ctx, 0.12);
      break;
    }
  }
  return canvas;
}

/** Cached per garment: 512² of pixel work happens once, not per swatch tap. */
export function clothingTexture(kind: ClothKind): HTMLCanvasElement | null {
  const cached = cache.get(kind);
  if (cached) return cached;
  const canvas = paint(kind);
  if (canvas) cache.set(kind, canvas);
  return canvas;
}

/** Fixed colour for the one pair of jeans; the top follows the palette. */
export const PANT_COLOUR = "#3f5c88";
