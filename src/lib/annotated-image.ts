/**
 * Colour correction for backend-rendered annotated shelf images.
 *
 * The vision service writes its annotated JPEG with OpenCV's BGR channel order,
 * so red packs arrive looking blue. We detect that by comparing the annotated
 * image against the original upload: if the annotated red channel tracks the
 * original blue channel (and vice versa), the two channels were swapped and we
 * swap them back on a canvas before display / download.
 *
 * The check is data-driven, so it becomes a no-op automatically once the backend
 * writes RGB.
 */

const SAMPLE = 64;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image."));
    img.src = src;
  });
}

function samplePixels(img: HTMLImageElement): Uint8ClampedArray | null {
  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE;
  canvas.height = SAMPLE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
  try {
    return ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;
  } catch {
    return null; // tainted canvas (missing CORS headers)
  }
}

function channel(data: Uint8ClampedArray, offset: number): number[] {
  const out: number[] = [];
  for (let i = offset; i < data.length; i += 4) out.push(data[i]!);
  return out;
}

function correlation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let sa = 0;
  let sb = 0;
  for (let i = 0; i < n; i++) {
    sa += a[i]!;
    sb += b[i]!;
  }
  const ma = sa / n;
  const mb = sb / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i]! - ma;
    const y = b[i]! - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  const den = Math.sqrt(da * db);
  return den === 0 ? 0 : num / den;
}

function swapRedBlue(img: HTMLImageElement): string | null {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  try {
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = frame.data;
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i]!;
      px[i] = px[i + 2]!;
      px[i + 2] = r;
    }
    ctx.putImageData(frame, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.95);
  } catch {
    return null;
  }
}

/**
 * Returns a display/download-ready annotated image. When the annotated image's
 * red and blue channels are swapped relative to the original upload, a corrected
 * JPEG data URL is returned; otherwise the input src is returned unchanged.
 */
export async function correctAnnotatedImage(
  annotatedSrc: string,
  originalSrc?: string | undefined,
): Promise<string> {
  if (typeof document === "undefined" || !annotatedSrc) return annotatedSrc;
  try {
    const annotated = await loadImage(annotatedSrc);
    if (!originalSrc) return annotatedSrc;
    const original = await loadImage(originalSrc);

    const annData = samplePixels(annotated);
    const origData = samplePixels(original);
    if (!annData || !origData) return annotatedSrc;

    const aR = channel(annData, 0);
    const aB = channel(annData, 2);
    const oR = channel(origData, 0);
    const oB = channel(origData, 2);

    const direct = (correlation(aR, oR) + correlation(aB, oB)) / 2;
    const swapped = (correlation(aR, oB) + correlation(aB, oR)) / 2;
    if (swapped <= direct + 0.05) return annotatedSrc;

    return swapRedBlue(annotated) ?? annotatedSrc;
  } catch {
    return annotatedSrc;
  }
}
