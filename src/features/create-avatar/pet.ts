/**
 * How the pet is shown in the 3D previews.
 *
 * The saved colourway stays the truth — this never changes what the member
 * picked, the chips, or the poster. It is a display pass on the fur texture, the
 * way a photographer lights a black cat instead of painting it grey: the midtones
 * are lifted with a gamma curve, a little contrast is put back so the strands
 * stay strands, and the colour is nudged toward where it was chosen so the lift
 * does not wash it to grey.
 *
 * Midnight is nearly black on purpose, which is why it read as a blob next to a
 * lit person. This makes the fur readable at preview size without pretending the
 * cat is a different colour.
 */
import { colourwayFor, recolourTexture, type CatColourwayId } from "../cat-studio/model";

const cache = new Map<string, HTMLCanvasElement>();

/**
 * Gamma below 1 lifts the shadows, contrast is applied around the lifted
 * average (a fixed pivot darkens everything below it — that is what made the
 * first attempt barely brighter), then a gain and a small lift finish it off.
 */
const GAMMA = 0.62;
const CONTRAST = 1.16;
const GAIN = 1.1;
const LIFT = 0.02;
const SATURATION = 1.22;

export function petPreviewCanvas(
  source: HTMLImageElement | ImageBitmap,
  colourwayId: CatColourwayId | string | null | undefined,
): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const colourway = colourwayFor(colourwayId);
  const tinted = recolourTexture(source, colourway);
  if (!tinted) return null;
  const cached = cache.get(colourway.id);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = tinted.width;
  canvas.height = tinted.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(tinted, 0, 0);

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;

  // Average of the gamma-lifted image: contrast pivots on this, so the fur gets
  // its shape back without being pushed darker again.
  let sum = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    sum +=
      0.299 * Math.pow(data[i] / 255, GAMMA) +
      0.587 * Math.pow(data[i + 1] / 255, GAMMA) +
      0.114 * Math.pow(data[i + 2] / 255, GAMMA);
    count += 1;
  }
  const mean = count > 0 ? sum / count : 0.3;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    let r = Math.pow(data[i] / 255, GAMMA);
    let g = Math.pow(data[i + 1] / 255, GAMMA);
    let b = Math.pow(data[i + 2] / 255, GAMMA);

    r = (r - mean) * CONTRAST + mean;
    g = (g - mean) * CONTRAST + mean;
    b = (b - mean) * CONTRAST + mean;

    r = r * GAIN + LIFT;
    g = g * GAIN + LIFT;
    b = b * GAIN + LIFT;

    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    r = luma + (r - luma) * SATURATION;
    g = luma + (g - luma) * SATURATION;
    b = luma + (b - luma) * SATURATION;

    data[i] = Math.max(0, Math.min(255, Math.round(r * 255)));
    data[i + 1] = Math.max(0, Math.min(255, Math.round(g * 255)));
    data[i + 2] = Math.max(0, Math.min(255, Math.round(b * 255)));
  }

  ctx.putImageData(image, 0, 0);
  cache.set(colourway.id, canvas);
  return canvas;
}
