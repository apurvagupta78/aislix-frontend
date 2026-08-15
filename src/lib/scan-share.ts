/**
 * Scan sharing — shared types used by both the authenticated results page and
 * the public /share/:token report. Client-safe: no server-only imports.
 */

import { APP_ORIGIN } from "@/lib/app-origin";

export type ScanShareLink = {
  token: string;
  url: string;
  expires_at: string;
  view_count: number;
};

export type SharedInventoryRow = {
  brand: string;
  product: string;
  quantity: number;
  category?: string | null;
  stock_status?: string | null;
  confidence?: number | null;
};

export type SharedComplianceLine = {
  issue_type: string;
  expected_brand?: string | null;
  expected_product?: string | null;
  expected_qty?: number | null;
  actual_brand?: string | null;
  actual_product?: string | null;
  actual_qty?: number | null;
  severity: string;
  detail?: string | null;
};

export type SharedScanPayload = {
  scan_id: string;
  store_name: string | null;
  location: string | null;
  category: string | null;
  sub_category: string | null;
  scanned_at: string | null;
  status: string;
  shelf_health_score: number | null;
  osa_percent: number | null;
  products_detected: number;
  out_of_stock_count: number;
  low_stock_count: number;
  planogram_compliance_percent: number | null;
  executive_summary: string | null;
  inventory: SharedInventoryRow[];
  planogram_compliance: {
    compliance_percent: number | null;
    lines: SharedComplianceLine[];
  } | null;
  downloads: {
    pdf_url?: string;
    annotated_image_url?: string;
  };
  expires_at: string;
};

/** Public URL for a share token, built from the canonical app origin. */
export function shareLinkUrl(token: string): string {
  return `${APP_ORIGIN}/share/${token}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Splits a comma / space / newline separated list into valid unique emails. */
export function parseRecipients(value: string): { emails: string[]; invalid: string[] } {
  const parts = value
    .split(/[,;\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const emails: string[] = [];
  const invalid: string[] = [];
  for (const part of parts) {
    if (!EMAIL_RE.test(part)) invalid.push(part);
    else if (!emails.includes(part.toLowerCase())) emails.push(part.toLowerCase());
  }
  return { emails, invalid };
}

export function formatSharedDate(iso?: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
