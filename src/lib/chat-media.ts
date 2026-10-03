const MAX_IMAGE_EDGE = 1600;
const JPEG_QUALITY = 0.82;

export async function compressChatImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file.");
  }

  const image = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser couldn't prepare the image.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("This browser couldn't compress the image.")),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}