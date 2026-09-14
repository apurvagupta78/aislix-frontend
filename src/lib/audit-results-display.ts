/**
 * Customer-facing scan results header copy — display only, no KPI logic.
 */

import { DEMO_ORAL_CARE_META } from "@/lib/demo-oral-care-planogram";
import { roleTabLabel, type AuditRoleTab } from "@/lib/role-audit-ui";
import type { ScanResult } from "@/lib/scan-results";

export function formatAuditHeaderTimestamp(iso?: string): string | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  const datePart = date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timePart = date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${datePart} · ${timePart}`;
}

function demoStoreParts(): { retailer: string; outlet: string } {
  const raw = DEMO_ORAL_CARE_META.store_outlet;
  const parts = raw.split(/[–—-]/).map((part) => part.trim()).filter(Boolean);
  return {
    retailer: parts[0] ?? "Demo Supermarket",
    outlet: parts[1] ?? "Store 101",
  };
}

export function buildAuditHeaderPrimary(data?: ScanResult): string {
  const category = data?.scan_category?.trim();
  const subCategory = data?.scan_sub_category?.trim();
  if (category && subCategory) return `${category} · ${subCategory}`;
  if (category) return category;
  if (subCategory) return subCategory;
  return data?.location?.trim() || "Shelf audit";
}

export function buildAuditHeaderMeta(
  data?: ScanResult,
  options?: { demoMode?: boolean; activeRole?: AuditRoleTab },
): string | undefined {
  const parts: string[] = [];
  if (options?.demoMode) {
    const { retailer, outlet } = demoStoreParts();
    parts.push(retailer, outlet);
  } else {
    if (options?.activeRole) parts.push(roleTabLabel(options.activeRole));
    if (data?.store?.trim()) parts.push(data.store.trim());
    else if (data?.location?.trim()) parts.push(data.location.trim());
  }
  const timestamp = formatAuditHeaderTimestamp(data?.created_at);
  if (timestamp) parts.push(timestamp);
  return parts.length ? parts.join(" · ") : undefined;
}

export function buildAuditHeaderId(data?: ScanResult): string | undefined {
  const id = data?.location?.trim();
  return id ? `Audit ID: ${id}` : undefined;
}
