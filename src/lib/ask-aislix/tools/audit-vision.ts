import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { ImageGalleryItem, VisionAsset } from "@/lib/ask-aislix/ask-aislix.types";

export const MAX_VISION_IMAGES = 6;
export const MAX_VISION_BYTES = 5 * 1024 * 1024;

export type ImageSelectionMode = "analysis" | "gallery";

export function selectImagesForMode(
  items: ImageGalleryItem[],
  mode: ImageSelectionMode,
  limit?: number,
): ImageGalleryItem[] {
  if (mode === "gallery") {
    return items.slice(0, Math.min(limit ?? 20, 20));
  }
  return items.slice(0, Math.min(limit ?? MAX_VISION_IMAGES, MAX_VISION_IMAGES));
}

export async function downloadVisionAssets(
  supabase: SupabaseClient<Database>,
  items: ImageGalleryItem[],
): Promise<VisionAsset[]> {
  const assets: VisionAsset[] = [];
  let totalBytes = 0;

  for (const item of items) {
    if (assets.length >= MAX_VISION_IMAGES) break;
    try {
      const { data: blob } = await supabase.storage.from(item.storageBucket).download(item.storagePath);
      if (!blob) continue;

      const buffer = Buffer.from(await blob.arrayBuffer());
      if (totalBytes + buffer.length > MAX_VISION_BYTES) break;

      const mimeType = blob.type || "image/jpeg";
      if (!mimeType.startsWith("image/")) continue;

      assets.push({
        scanId: item.scanId,
        caption: item.caption,
        mimeType,
        base64: buffer.toString("base64"),
      });
      totalBytes += buffer.length;
    } catch {
      // skip failed downloads
    }
  }

  return assets;
}

export function buildVisionInputParts(assets: VisionAsset[]) {
  if (!assets.length) return [];
  return [
    {
      type: "input_text" as const,
      text: `Authorized audit images for visual analysis (${assets.length} image${assets.length === 1 ? "" : "s"}):`,
    },
    ...assets.map((asset) => ({
      type: "input_image" as const,
      detail: "auto" as const,
      image_url: `data:${asset.mimeType};base64,${asset.base64}`,
    })),
  ];
}
