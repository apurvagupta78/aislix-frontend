import { localIsoDate, type ExpiryReading } from "@/lib/audit-engine/expiry-evidence";
import { readExpiryDate } from "@/lib/audit-engine/expiry-read.functions";

const MAX_EDGE = 1600;

async function toJpegBase64(file: Blob): Promise<{ base64: string; mimeType: string }> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    const buffer = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let i = 0; i < buffer.length; i += 0x8000) binary += String.fromCharCode(...buffer.subarray(i, i + 0x8000));
    return { base64: btoa(binary), mimeType: file.type || "image/jpeg" };
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { base64: dataUrl.slice(dataUrl.indexOf(",") + 1), mimeType: "image/jpeg" };
}

/** AI reads the expiry date from a photo of the pack. Throws with a user-facing message on failure. */
export async function readExpiryDateFromPhoto(file: Blob, productHint?: string | null): Promise<ExpiryReading> {
  const { base64, mimeType } = await toJpegBase64(file);
  return readExpiryDate({ data: { imageBase64: base64, mimeType, today: localIsoDate(), productHint: productHint ?? null } });
}
