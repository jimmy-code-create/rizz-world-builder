/**
 * The cat model and its colourways.
 *
 * `public/models/cat.glb` is the model supplied for the project: one rigged cat
 * (79 nodes, 3 meshes, one "Take 001" clip) with baked 1024px fur textures. No
 * geometry is generated here — the three colourways recolour the model's own
 * base-colour texture, so the silhouette, UVs and animation stay exactly as
 * delivered.
 *
 * The eye is painted into the same atlas as the fur, so it cannot be re-tinted
 * without a mask; only the body material is recoloured and the eye keeps its
 * original look. That is deliberate, not an oversight.
 */
export const CAT_MODEL_URL = "/models/cat.glb";

export type CatColourwayId = "midnight" | "frost" | "marmalade";

export type Colourway = {
  id: CatColourwayId;
  name: string;
  /** Swatch shown on the chip. */
  swatch: string;
  /** Hue shift in turns (0–1), saturation scale and lightness remap. */
  tint: { hue: number; saturation: number; lightScale: number; lift: number };
};

export const CAT_COLOURWAYS: Colourway[] = [
  { id: "midnight", name: "Midnight", swatch: "#141418", tint: { hue: 0, saturation: 0.85, lightScale: 0.85, lift: 0 } },
  { id: "frost", name: "Frost", swatch: "#9fb3c8", tint: { hue: 0.58, saturation: 0.35, lightScale: 1.45, lift: 0.34 } },
  { id: "marmalade", name: "Marmalade", swatch: "#d2762c", tint: { hue: 0.06, saturation: 1.5, lightScale: 1.75, lift: 0.24 } },
];

export function colourwayFor(id: CatColourwayId | string | null | undefined): Colourway {
  return CAT_COLOURWAYS.find((entry) => entry.id === id) ?? CAT_COLOURWAYS[0];
}

const cache = new Map<string, HTMLCanvasElement>();

/**
 * The model's own texture, hue/saturation/lightness shifted, as a canvas the
 * renderer can upload. Cached per colourway so switching back is instant and the
 * pixel work happens once.
 */
export function recolourTexture(
  source: HTMLImageElement | ImageBitmap,
  colourway: Colourway,
): HTMLCanvasElement | null {
  const cached = cache.get(colourway.id);
  if (cached) return cached;
  if (typeof document === "undefined") return null;

  const width = "width" in source ? source.width : 0;
  const height = "height" in source ? source.height : 0;
  if (!width || !height) return null;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(source as CanvasImageSource, 0, 0);

  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const { hue, saturation, lightScale, lift } = colourway.tint;
  const shift = hue * 360;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const [h, s, l] = rgbToHsl(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255);
    const [r, g, b] = hslToRgb(
      (h + shift / 360) % 1,
      Math.min(1, s * saturation),
      Math.min(1, l * lightScale + lift),
    );
    data[i] = Math.round(r * 255);
    data[i + 1] = Math.round(g * 255);
    data[i + 2] = Math.round(b * 255);
  }
  ctx.putImageData(image, 0, 0);
  cache.set(colourway.id, canvas);
  return canvas;
}

export function clearColourwayCache() {
  cache.clear();
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hueToRgb(p, q, h + 1 / 3), hueToRgb(p, q, h), hueToRgb(p, q, h - 1 / 3)];
}

function hueToRgb(p: number, q: number, t: number) {
  let value = t;
  if (value < 0) value += 1;
  if (value > 1) value -= 1;
  if (value < 1 / 6) return p + (q - p) * 6 * value;
  if (value < 1 / 2) return q;
  if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
  return p;
}
