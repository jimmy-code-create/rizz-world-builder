/**
 * Square photo pipeline shared by group icons and realm photos.
 *
 * Takes whatever the gallery or camera hands us, center-crops it to a square and
 * re-encodes it as a compressed JPEG so uploads stay small and predictable.
 */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "image/heic", "image/heif"];

export const MAX_PHOTO_BYTES = MAX_UPLOAD_BYTES;

export function formatMb(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function decodeImage(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; cleanup: () => void }> {
  if (typeof document === "undefined") throw new Error("Photos can only be prepared in the browser.");
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, cleanup: () => bitmap.close?.() };
    } catch {
      // Safari and some Android browsers can't decode every format here — fall through to <img>.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("That photo couldn't be read. Try another one."));
      el.src = url;
    });
    return {
      source: image,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      cleanup: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

export async function squareImageFile(
  file: File,
  options: { size?: number; quality?: number; maxBytes?: number; label?: string } = {},
): Promise<File> {
  const size = options.size ?? 512;
  const quality = options.quality ?? 0.82;
  const maxBytes = options.maxBytes ?? MAX_UPLOAD_BYTES;
  const label = options.label ?? "photo";

  if (file.type && !file.type.startsWith("image/") && !ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Pick a PNG, JPG, WEBP or GIF image.");
  }
  if (file.size > maxBytes) {
    throw new Error(`That ${label} is ${formatMb(file.size)}. Pick one under ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  }

  const decoded = await decodeImage(file);
  try {
    const side = Math.min(decoded.width, decoded.height);
    if (!side) throw new Error("That photo looks empty. Try another one.");
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Couldn't process that photo in this browser.");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      decoded.source,
      Math.round((decoded.width - side) / 2),
      Math.round((decoded.height - side) / 2),
      side,
      side,
      0,
      0,
      size,
      size,
    );
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) throw new Error("Couldn't compress that photo. Try another one.");
    const base = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    decoded.cleanup();
  }
}
