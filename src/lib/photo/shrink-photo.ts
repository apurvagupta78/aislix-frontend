const MAX_EDGE = 2048;

/** Phone photos are large; send at most 2048px on the long edge. */
export async function shrinkPhoto(file: File, maxEdge = MAX_EDGE): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.type === "image/jpeg") return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}

export function photoExtension(photo: Blob): "jpg" | "png" | "webp" {
  return photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
}
