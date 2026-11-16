/**
 * Colouring the person, not painting over them.
 *
 * A material's `color` multiplies the texture, so a mid-grey hair texture under
 * a red `color` goes muddy and a dark one stays black — the colour reads as a
 * flat layer laid on top, which is exactly what it is. These helpers recolour the
 * *texture* instead: each pixel keeps its own shade (hair strands, skin pores,
 * denim weave) and only its hue and overall lightness move to the swatch. That is
 * how the face and body already read, so hair and clothes now match them.
 *
 * Results are cached per source texture and swatch, so dragging through the
 * palette costs one canvas per colour instead of one per frame.
 */

const cache = new WeakMap<object, Map<string, HTMLCanvasElement>>();

type Hex = { h: number; s: number; l: number };

function parseHex(hex: string): Hex {
  const value = /^#([0-9a-f]{6})$/i.exec(hex)?.[1] ?? "808080";
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h, s, l };
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

function hueToRgb(p: number, q: number, t: number) {
  let value = t;
  if (value < 0) value += 1;
  if (value > 1) value -= 1;
  if (value < 1 / 6) return p + (q - p) * 6 * value;
  if (value < 1 / 2) return q;
  if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
  return p;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hueToRgb(p, q, h + 1 / 3), hueToRgb(p, q, h), hueToRgb(p, q, h - 1 / 3)];
}

/**
 * The texture in `hex`, detail intact. Lightness is the swatch's own, scaled by
 * each pixel's place in the source: a strand that was 30% darker than the hair
 * stays 30% darker, which is what stops it looking like a coloured sticker.
 */
export function tintTexture(
  source: HTMLImageElement | ImageBitmap | HTMLCanvasElement,
  hex: string,
  lightnessScale = 1,
): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const key = `${hex.toLowerCase()}|${lightnessScale.toFixed(2)}`;
  let perSource = cache.get(source as object);
  if (!perSource) {
    perSource = new Map();
    cache.set(source as object, perSource);
  }
  const cached = perSource.get(key);
  if (cached) return cached;

  const width = "width" in source ? source.width : 0;
  const height = "height" in source ? source.height : 0;
  if (!width || !height) return null;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(source as CanvasImageSource, 0, 0);

  const target = parseHex(hex);
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;

  // The first pass finds the texture's own average lightness. Scaling by
  // `target / mean` puts the swatch's tone at the *average* pixel instead of
  // multiplying it into every pixel — a light skin map under a mid tone came out
  // white that way, because its highlights were already near 1.
  let sum = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const [, , l] = rgbToHsl(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255);
    sum += l;
    count += 1;
  }
  const mean = count > 0 ? sum / count : 0.5;
  // `lightnessScale` pulls a surface below its swatch: skin under full studio
  // light came out chalky, and a face should not be brighter than the shirt.
  const gain = mean > 0.001 ? (target.l * lightnessScale) / mean : 1;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const [h, s, l] = rgbToHsl(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255);
    const shade = Math.min(1, Math.max(0, l * gain));
    const [r, g, b] = hslToRgb(
      target.s < 0.04 ? h : target.h,
      Math.min(1, target.s * (0.6 + 0.8 * s)),
      shade,
    );
    data[i] = Math.round(r * 255);
    data[i + 1] = Math.round(g * 255);
    data[i + 2] = Math.round(b * 255);
  }
  ctx.putImageData(image, 0, 0);
  perSource.set(key, canvas);
  return canvas;
}
