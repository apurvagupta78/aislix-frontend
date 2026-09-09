/**
 * Anonymous landing-demo scan client. Talks only to the public /landing/*
 * endpoints — never to the authenticated scan pipeline.
 */
import { captureUtmParams, readStoredUtm } from "@/lib/utm";
import {
  GENERIC_TIMEOUT,
  networkErrorMessage,
  parseApiDetail,
  sanitizeUserMessage,
} from "@/lib/api-errors";

const API = import.meta.env.VITE_AISLIX_API_URL?.replace(/\/$/, "");

export const DEFAULT_SAMPLE_ID = "toothpaste-a1l";
export const DEFAULT_SAMPLE_IMAGE = API
  ? `${API}/landing/samples/${DEFAULT_SAMPLE_ID}/image`
  : "";

const SESSION_ID_KEY = "aislix_landing_session_id";
const RESULT_KEY = "aislix_landing_scan_result";

export type LandingInventoryRow = {
  brand: string;
  product_name: string;
  quantity: number;
  variant?: string;
  confidence?: number;
  status_label?: "Detected" | "Needs review";
  counted_in_totals?: boolean;
};

export type LandingBrandShare = { brand: string; share: number; quantity?: number };

export type LandingScanResult = {
  landing_session_id: string;
  scan_id: string;
  status: "completed";
  scan_mode?: "audit_only";
  has_planogram?: false;
  metrics: {
    total_products?: number;
    unique_skus?: number;
    total_skus?: number;
    shelf_health_score?: number;
    shelf_execution_score?: number;
    average_confidence?: number;
    financial_impact?: {
      estimated_daily_lost_sales_inr?: number;
      estimated_weekly_lost_sales_inr?: number;
      estimated_monthly_lost_sales_inr?: number;
      oos_sku_count?: number;
      at_risk_sku_count?: number;
      methodology?: string;
    };
  };
  inventory: LandingInventoryRow[];
  top_brands?: LandingBrandShare[];
  brand_share?: LandingBrandShare[];
  brand_share_scope?: "in_audit" | "all";
  brand_share_denominator?: number;
  scanned_at?: string;
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
  if (!API) throw new Error("VITE_AISLIX_API_URL is not configured");
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

async function postScan(form: FormData, _fallback: string): Promise<LandingScanResult> {
  // Same-origin proxy: keeps the demo working from any origin, records the
  // anonymous attempt, and allows the slow vision scan up to two minutes.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  let res: Response;
  try {
    res = await fetch("/api/public/landing/scan", {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new LandingScanError(GENERIC_TIMEOUT, 408);
    }
    throw new LandingScanError(networkErrorMessage(error), 0);
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as unknown;
    throw new LandingScanError(parseApiDetail(body), res.status);
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
      unique_skus: payload.metrics?.unique_skus ?? payload.metrics?.total_skus,
      shelf_health_score: payload.metrics?.shelf_health_score,
    },
    inventory: payload.inventory ?? [],
    top_brands: payload.top_brands,
    brand_share: payload.brand_share,
    brand_share_scope: payload.brand_share_scope,
    brand_share_denominator: payload.brand_share_denominator,
    scanned_at: payload.scanned_at,
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

/** Optional shelf context forwarded with a landing scan. */
export type LandingScanContext = {
  category?: string;
  sub_category?: string;
  sub_category_label?: string;
  shelf_label?: string;
};

function appendContext(form: FormData, context?: LandingScanContext) {
  if (!context) return;
  for (const key of ["category", "sub_category", "sub_category_label", "shelf_label"] as const) {
    const value = context[key];
    if (value) form.append(key, value);
  }
}

export async function runLandingUpload(
  file: File,
  ctx: LandingScanContext & { landingSessionId?: string },
): Promise<LandingScanResult> {
  const form = new FormData();
  form.append("file", file);
  if (ctx.landingSessionId) form.append("landing_session_id", ctx.landingSessionId);
  appendContext(form, ctx);
  appendUtm(form);
  return postScan(form, "Scan failed");
}



export async function runLandingSample(
  sampleId = DEFAULT_SAMPLE_ID,
  landingSessionId?: string,
  context?: LandingScanContext,
): Promise<LandingScanResult> {
  const form = new FormData();
  form.append("sample_id", sampleId);
  if (landingSessionId) form.append("landing_session_id", landingSessionId);
  appendContext(form, context);
  appendUtm(form);
  return postScan(form, "Shelf analysis failed");
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
