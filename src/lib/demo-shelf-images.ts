/** Public demo shelf photos (from /public/demo-shelf) used when evidence has no Storage object. */
export const DEMO_SHELF_FALLBACK_IMAGES = [
  "/demo-shelf/demo-1.jpg",
  "/demo-shelf/demo-2.jpg",
  "/demo-shelf/demo-3.jpg",
  "/demo-shelf/demo-4.jpg",
  "/demo-shelf/demo-5.jpg",
  "/demo-shelf/demo-6.jpg",
] as const;

export function demoShelfFallbackUrl(index: number): string {
  return DEMO_SHELF_FALLBACK_IMAGES[index % DEMO_SHELF_FALLBACK_IMAGES.length]!;
}
