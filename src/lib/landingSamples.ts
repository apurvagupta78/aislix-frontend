/**
 * Public sample shelves used by the no-signup homepage demo.
 * Sample scans are served from the backend cache, so they finish in seconds.
 */

const API = import.meta.env.VITE_AISLIX_API_URL?.replace(/\/$/, "");

export const DEFAULT_SAMPLE_ID = "toothpaste-a1l";

export function sampleImageUrl(sampleId: string = DEFAULT_SAMPLE_ID): string {
  if (!API) return "";
  return `${API}/landing/samples/${encodeURIComponent(sampleId)}/image`;
}

export const DEFAULT_SAMPLE_IMAGE = sampleImageUrl(DEFAULT_SAMPLE_ID);

export type LandingSample = {
  id: string;
  label: string;
  category?: string;
  sub_category?: string;
  sub_category_label?: string;
};

/** Shown instantly so the demo never waits on a network call to render chips. */
export const FALLBACK_SAMPLES: LandingSample[] = [
  {
    id: "toothpaste-a1l",
    label: "Toothpaste shelf",
    category: "Personal Care",
    sub_category: "toothpaste",
    sub_category_label: "Toothpaste",
  },
  {
    id: "lays-a1l",
    label: "Chips & snacks",
    category: "Snacks",
    sub_category: "chips",
    sub_category_label: "Chips",
  },
  {
    id: "shampoo-a1z",
    label: "Shampoo shelf",
    category: "Personal Care",
    sub_category: "shampoo",
    sub_category_label: "Shampoo",
  },
];

type RawSample = Record<string, unknown>;

function normalize(raw: RawSample, index: number): LandingSample | null {
  const id = typeof raw.id === "string" ? raw.id : typeof raw.sample_id === "string" ? raw.sample_id : null;
  if (!id) return null;
  const label =
    (typeof raw.label === "string" && raw.label) ||
    (typeof raw.name === "string" && raw.name) ||
    FALLBACK_SAMPLES.find((s) => s.id === id)?.label ||
    `Sample shelf ${index + 1}`;
  const fallback = FALLBACK_SAMPLES.find((s) => s.id === id);
  return {
    id,
    label,
    category: typeof raw.category === "string" ? raw.category : fallback?.category,
    sub_category: typeof raw.sub_category === "string" ? raw.sub_category : fallback?.sub_category,
    sub_category_label:
      typeof raw.sub_category_label === "string" ? raw.sub_category_label : fallback?.sub_category_label,
  };
}

/** Lists the sample shelves offered by the backend; falls back to the known set. */
export async function fetchLandingSamples(): Promise<LandingSample[]> {
  if (!API) return FALLBACK_SAMPLES;
  try {
    const res = await fetch(`${API}/landing/samples`);
    if (!res.ok) return FALLBACK_SAMPLES;
    const body = (await res.json()) as unknown;
    const list = Array.isArray(body)
      ? body
      : Array.isArray((body as { samples?: unknown })?.samples)
        ? ((body as { samples: unknown[] }).samples)
        : [];
    const mapped = list
      .filter((item): item is RawSample => Boolean(item) && typeof item === "object")
      .map(normalize)
      .filter((item): item is LandingSample => Boolean(item));
    return mapped.length ? mapped : FALLBACK_SAMPLES;
  } catch {
    return FALLBACK_SAMPLES;
  }
}
