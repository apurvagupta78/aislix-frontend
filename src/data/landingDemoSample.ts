/**
 * Static sample used ONLY by the /retail-intelligence landing demo.
 * No backend call is made for anonymous visitors — this is clearly labelled
 * "Sample analysis" in the UI.
 */
export const LANDING_DEMO_SAMPLE = {
  shelfHealth: 86,
  productsDetected: 31,
  uniqueSkus: 3,
  brand: "Lay's",
  items: [
    {
      brand: "Lay's",
      product: "India's Magic Masala",
      variant: "52g",
      qty: 13,
      confidence: 0.96,
      compliance: "ok" as const,
    },
    {
      brand: "Lay's",
      product: "American Style Cream & Onion",
      variant: "52g",
      qty: 12,
      confidence: 0.93,
      compliance: "ok" as const,
    },
    {
      brand: "Lay's",
      product: "Spanish Tomato Tango",
      variant: "52g",
      qty: 6,
      confidence: 0.88,
      compliance: "ok" as const,
    },
    {
      brand: "Unknown",
      product: "Partial top-shelf facings",
      variant: "—",
      qty: 6,
      confidence: 0.41,
      compliance: "needs_review" as const,
    },
  ],
  /** Illustrative facing boxes (percentages of image size) for the sample overlay. */
  boxes: [
    { top: 6, left: 4, width: 21, height: 26, label: "Magic Masala" },
    { top: 6, left: 27, width: 21, height: 26, label: "Cream & Onion" },
    { top: 6, left: 51, width: 21, height: 26, label: "Needs review" },
    { top: 38, left: 4, width: 21, height: 26, label: "Magic Masala" },
    { top: 38, left: 42, width: 21, height: 26, label: "Tomato Tango" },
    { top: 70, left: 20, width: 21, height: 26, label: "Cream & Onion" },
  ],
} as const;

export type LandingDemoItem = (typeof LANDING_DEMO_SAMPLE)["items"][number];
