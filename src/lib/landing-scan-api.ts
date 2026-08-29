/**
 * Anonymous landing-demo scan client. Talks only to the public /landing/*
 * endpoints — never to the authenticated scan pipeline.
 */
import { captureUtmParams, readStoredUtm } from "@/lib/utm";

const API = import.meta.env.VITE_AISLIX_API_URL;

export const DEFAULT_SAMPLE_ID = "shampoo-a1z";
export const DEFAULT_SAMPLE_IMAGE = `${API}/landing/samples/${DEFAULT_SAMPLE_ID}/image`;

const SESSION_ID_KEY = "aislix_landing_session_id";
const RESULT_KEY = "aislix_landing_scan_result";

export type LandingInventoryRow = {
  brand: string;
  product_name: string;
  quantity: number;
  confidence?: number;
  status_label?: "Detected" | "Needs review";
  counted_in_totals?: boolean;
};

export type LandingScanResult = {
  landing_session_id: string;
  scan_id: string;
  status: "completed";
  scan_mode?: "audit_only";
  has_planogram?: false;
  metrics: {
    total_products?: number;
    unique_skus?: number;
    shelf_health_score?: number;
  };
  inventory: LandingInventoryRow[];
  executive_summary?: string;
  annotated_image_base64?: string;
  annotated_image_mime?: string;
  original_image_base64?: string;
  original_image_mime?: string;
  csv_base64?: string;
  scans_used_today?: number;
  scans_daily_limit?: number;
};

export class LandingScanError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "LandingScanError";
    this.status = status;
  }
}

/** Public sample shelf image, shown instantly while the AI runs. */
export function getSamplePreviewUrl(sampleId = DEFAULT_SAMPLE_ID): string {
  return `${API}/landing/samples/${sampleId}/image`;
}

function appendUtm(form: FormData) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    const v = params.get(key);
    if (v) form.append(key, v);
  }
}

async function postScan(form: FormData, fallback: string): Promise<LandingScanResult> {
  const res = await fetch(`${API}/landing/scan`, { method: "POST", body: form });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new LandingScanError(err.detail || `${fallback} (${res.status})`, res.status);
  }
  const payload = (await res.json()) as LandingScanResult;
  return {
    landing_session_id: payload.landing_session_id,
    scan_id: payload.scan_id,
    status: "completed",
    scan_mode: "audit_only",
    has_planogram: false,
    metrics: {
      total_products: payload.metrics?.total_products,
      unique_skus: payload.metrics?.unique_skus,
      shelf_health_score: payload.metrics?.shelf_health_score,
    },
    inventory: payload.inventory ?? [],
    executive_summary: payload.executive_summary,
    annotated_image_base64: payload.annotated_image_base64,
    annotated_image_mime: payload.annotated_image_mime,
    original_image_base64: payload.original_image_base64,
    original_image_mime: payload.original_image_mime,
    csv_base64: payload.csv_base64,
    scans_used_today: payload.scans_used_today,
    scans_daily_limit: payload.scans_daily_limit,
  };
}

export async function runLandingUpload(
  file: File,
  landingSessionId?: string,
): Promise<LandingScanResult> {
  const form = new FormData();
  form.append("file", file);
  if (landingSessionId) form.append("landing_session_id", landingSessionId);
  appendUtm(form);
  return postScan(form, "Scan failed");
}

export async function runLandingSample(
  sampleId = DEFAULT_SAMPLE_ID,
  landingSessionId?: string,
): Promise<LandingScanResult> {
  const form = new FormData();
  form.append("sample_id", sampleId);
  if (landingSessionId) form.append("landing_session_id", landingSessionId);
  appendUtm(form);
  return postScan(form, "Sample scan failed");
}

/** Backward-compatible alias for earlier landing component imports. */
export const runLandingScan = runLandingUpload;

/** Download the backend-generated CSV for a completed landing scan. */
export function downloadLandingCsv(result: LandingScanResult): void {
  if (!result.csv_base64 || typeof window === "undefined") return;
  const bytes = Uint8Array.from(atob(result.csv_base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `aislix-shelf-scan-${result.scan_id || "demo"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function captureLandingLead(payload: {
  landing_session_id?: string;
  email: string;
  name?: string;
  company?: string;
  role?: string;
}) {
  const sid =
    payload.landing_session_id ||
    (typeof window !== "undefined" ? window.sessionStorage.getItem(SESSION_ID_KEY) : null) ||
    undefined;
  const body: Record<string, string | undefined> = { ...payload, landing_session_id: sid };
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
      const value = params.get(key);
      if (value) body[key] = value;
    }
  }
  const res = await fetch(`${API}/landing/lead`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    detail?: string;
    landing_session_id?: string;
    email_sent?: boolean;
    signup_url?: string;
  };
  if (!res.ok) throw new LandingScanError(data.detail || "Could not save your details.", res.status);
  if (data.landing_session_id && typeof window !== "undefined") {
    window.sessionStorage.setItem(SESSION_ID_KEY, data.landing_session_id);
  }
  return data;
}

export async function convertLandingSession(landingSessionId: string, userId: string) {
  try {
    await fetch(`${API}/landing/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ landing_session_id: landingSessionId, user_id: userId }),
    });
  } catch {
    /* attribution is best-effort and must never block signup */
  }
}

export function persistLandingSession(result: LandingScanResult) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_ID_KEY, result.landing_session_id);
    sessionStorage.setItem(RESULT_KEY, JSON.stringify(result));
  } catch {
    /* storage unavailable — non-fatal */
  }
}

export function loadLandingSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(SESSION_ID_KEY);
  } catch {
    return null;
  }
}

export function loadLandingScanResult(): LandingScanResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(RESULT_KEY);
    return raw ? (JSON.parse(raw) as LandingScanResult) : null;
  } catch {
    return null;
  }
}

/** /signup URL carrying the current + stored UTM params plus the landing session id. */
export function signupUrl(extra?: Record<string, string | undefined>): string {
  if (typeof window === "undefined") return "/signup";
  const params = new URLSearchParams(window.location.search);
  for (const [k, v] of Object.entries({ ...readStoredUtm(), ...captureUtmParams() })) {
    params.set(k, v);
  }
  const sid = loadLandingSessionId();
  if (sid) params.set("landing_session_id", sid);
  if (extra) for (const [key, value] of Object.entries(extra)) if (value) params.set(key, value);
  const qs = params.toString();
  return qs ? `/signup?${qs}` : "/signup";
}

/** Backward-compatible name retained for existing landing imports. */
export const signupUrlWithLanding = signupUrl;
