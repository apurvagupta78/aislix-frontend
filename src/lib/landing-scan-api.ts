/**
 * Anonymous landing-demo scan client. Talks only to the public /landing/*
 * endpoints — never to the authenticated scan pipeline.
 */
const API = import.meta.env.VITE_AISLIX_API_URL ?? import.meta.env.VITE_API_BASE_URL;

const SESSION_ID_KEY = "aislix_landing_session_id";
const RESULT_KEY = "aislix_landing_scan_result";

export type LandingScanResult = {
  landing_session_id: string;
  scan_id: string;
  status: "completed";
  metrics: {
    total_products?: number;
    unique_skus?: number;
    shelf_health_score?: number;
    needs_review_facings?: number;
  };
  inventory: Array<{
    brand: string;
    product_name: string;
    quantity: number;
    confidence?: number;
    compliance_status?: string;
    counted_in_totals?: boolean;
    exclusion_reason?: string;
  }>;
  executive_summary?: string;
  annotated_image_base64?: string;
  annotated_image_mime?: string;
  facings_debug?: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    brand?: string;
    product_name?: string;
    confidence?: number;
  }>;
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
  return (await res.json()) as LandingScanResult;
}

export async function runLandingScan(
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
  sampleId = "lays-a1l",
  landingSessionId?: string,
): Promise<LandingScanResult> {
  const form = new FormData();
  form.append("sample_id", sampleId);
  if (landingSessionId) form.append("landing_session_id", landingSessionId);
  appendUtm(form);
  return postScan(form, "Sample scan failed");
}

export async function captureLandingLead(payload: {
  landing_session_id: string;
  email: string;
  name?: string;
  company?: string;
  phone?: string;
}) {
  const res = await fetch(`${API}/landing/lead`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new LandingScanError("Could not save your details", res.status);
  return res.json();
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

/** /signup URL carrying the current UTM params plus the landing session id. */
export function signupUrlWithLanding(): string {
  if (typeof window === "undefined") return "/signup";
  const params = new URLSearchParams(window.location.search);
  const sid = loadLandingSessionId();
  if (sid) params.set("landing_session_id", sid);
  const qs = params.toString();
  return qs ? `/signup?${qs}` : "/signup";
}
