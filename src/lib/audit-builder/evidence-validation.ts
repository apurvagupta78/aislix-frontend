/**
 * Client-side evidence validation — image quality and duplicate detection at upload time.
 */

export type ImageQualityResult =
  | { ok: true; width: number; height: number }
  | { ok: false; reason: string };

export async function hashFileContent(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image file."));
    };
    img.src = url;
  });
}

function sampleLuminance(data: ImageData): number {
  let sum = 0;
  const step = 4 * 8;
  for (let i = 0; i < data.data.length; i += step) {
    const r = data.data[i]!;
    const g = data.data[i + 1]!;
    const b = data.data[i + 2]!;
    sum += 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return sum / Math.ceil(data.data.length / step);
}

/** Laplacian variance — low value indicates blur. */
function laplacianVariance(data: ImageData): number {
  const { width, height, data: px } = data;
  const gray: number[] = [];
  for (let i = 0; i < px.length; i += 4) {
    gray.push(0.299 * px[i]! + 0.587 * px[i + 1]! + 0.114 * px[i + 2]!);
  }
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap =
        -gray[i - width]! -
        gray[i - 1]! +
        4 * gray[i]! -
        gray[i + 1]! -
        gray[i + width]!;
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }
  if (count === 0) return 0;
  const mean = sum / count;
  return sumSq / count - mean * mean;
}

export async function validateImageQuality(
  file: File,
  requirement: "standard" | "high" = "standard",
): Promise<ImageQualityResult> {
  if (!file.type.startsWith("image/")) {
    return { ok: false, reason: "File must be an image (JPEG, PNG, or WebP)." };
  }

  if (file.size < 8_000) {
    return {
      ok: false,
      reason: "Image file is too small. Please capture a clearer, higher-resolution photo.",
    };
  }

  let img: HTMLImageElement;
  try {
    img = await loadImageFromFile(file);
  } catch {
    return { ok: false, reason: "Could not read image. Please try again." };
  }

  const minW = requirement === "high" ? 800 : 480;
  const minH = requirement === "high" ? 600 : 360;

  if (img.naturalWidth < minW || img.naturalHeight < minH) {
    return {
      ok: false,
      reason: `Insufficient resolution (${img.naturalWidth}×${img.naturalHeight}). Please capture a closer image — minimum ${minW}×${minH}px.`,
    };
  }

  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 320 / Math.max(img.naturalWidth, img.naturalHeight));
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ok: true, width: img.naturalWidth, height: img.naturalHeight };

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const luminance = sampleLuminance(imageData);
  if (luminance < 35) {
    return {
      ok: false,
      reason: "Evidence quality insufficient — image is too dark. Please retake with better lighting.",
    };
  }
  if (luminance > 245) {
    return {
      ok: false,
      reason: "Evidence quality insufficient — too much glare. Adjust angle or lighting and retake.",
    };
  }

  const variance = laplacianVariance(imageData);
  const blurThreshold = requirement === "high" ? 80 : 45;
  if (variance < blurThreshold) {
    return {
      ok: false,
      reason: "Evidence quality insufficient — image appears blurry. Hold steady and capture a sharper photo.",
    };
  }

  return { ok: true, width: img.naturalWidth, height: img.naturalHeight };
}

export function isDuplicateHash(hash: string, knownHashes: Set<string>): boolean {
  return knownHashes.has(hash);
}

/** Collect content hashes already uploaded in this audit session. */
export function buildSessionImageHashSet(
  hashByUrl: Record<string, string>,
): Set<string> {
  return new Set(Object.values(hashByUrl));
}

export function shouldCheckImageQuality(
  fieldConfig: { imageQualityCheck?: boolean; imageQualityRequirement?: string },
  templateAiEnabled?: boolean,
  aiFeatureEnabled?: boolean,
): boolean {
  if (fieldConfig.imageQualityCheck) return true;
  if (templateAiEnabled && aiFeatureEnabled) return true;
  return false;
}

export function shouldBlockDuplicates(
  fieldConfig: { duplicateDetection?: boolean },
  templatePreventDuplicates?: boolean,
  aiDuplicateDetection?: boolean,
): boolean {
  if (fieldConfig.duplicateDetection) return true;
  if (templatePreventDuplicates) return true;
  if (aiDuplicateDetection) return true;
  return false;
}
