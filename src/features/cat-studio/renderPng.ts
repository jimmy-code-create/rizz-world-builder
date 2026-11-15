/**
 * Config -> SVG string -> 512 px PNG, in the browser.
 *
 * This survives only as the poster fallback: the cat on screen is the 3D model,
 * and this flat render is used when a canvas capture is unavailable. The CSS
 * variables are resolved to literal colours first, because canvas will not read
 * custom properties out of an <img> and the regression would be a blank PNG.
 */
import { sanitizeCatConfig, type CatConfig } from "./config";
import { catLayerStack, furDark } from "./parts";

export function catSvgString(input: unknown, size = 512): string {
  const config = sanitizeCatConfig(input) as CatConfig;
  const layers = catLayerStack(config);
  const colours: Record<string, string> = {
    "var(--fur,#17171a)": config.colors.fur,
    "var(--fur-dark,#0d0d10)": furDark(config.colors.fur),
    "var(--accent,#c8ff3d)": config.colors.accent,
    "var(--eye,#ffffff)": config.colors.eye,
  };
  const body = layers
    .map((layer) => layer.markup)
    .join("")
    .replace(/var\(--[a-z-]+(?:,#[0-9a-f]{3,8})?\)/gi, (match) => colours[match] ?? "#17171a");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">${body}</svg>`;
}

export async function catPngBlob(input: unknown, size = 512): Promise<Blob> {
  const svg = catSvgString(input, size);
  const source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.decoding = "sync";
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("Could not render the cat."));
    element.src = source;
  });

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not render the cat.");
  context.drawImage(image, 0, 0, size, size);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not render the cat."))),
      "image/png",
      0.94,
    );
  });
}
