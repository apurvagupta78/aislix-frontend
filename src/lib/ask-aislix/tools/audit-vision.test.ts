import { describe, expect, it } from "vitest";

import type { ImageGalleryItem } from "@/lib/ask-aislix/ask-aislix.types";

import { MAX_VISION_IMAGES, selectImagesForMode } from "./audit-vision";

function makeItem(id: string): ImageGalleryItem {
  return {
    evidenceId: id,
    scanId: "scan-1",
    storageBucket: "audit-evidence",
    storagePath: `${id}.jpg`,
    caption: id,
    capturedAt: new Date().toISOString(),
  };
}

describe("audit vision selection", () => {
  it("limits gallery mode to 20 images", () => {
    const items = Array.from({ length: 30 }, (_, i) => makeItem(`img-${i}`));
    const selected = selectImagesForMode(items, "gallery");
    expect(selected).toHaveLength(20);
  });

  it("limits analysis mode to vision budget", () => {
    const items = Array.from({ length: 12 }, (_, i) => makeItem(`img-${i}`));
    const selected = selectImagesForMode(items, "analysis");
    expect(selected).toHaveLength(MAX_VISION_IMAGES);
  });
});
