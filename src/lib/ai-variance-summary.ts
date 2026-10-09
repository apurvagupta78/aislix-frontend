/**
 * Combined variances across AI audits: for every planned product and field, what the plan
 * expected vs what the AI detected (or a human verified). Built from persisted scan results.
 */

import { supabase } from "@/integrations/supabase/client";
import { getUser, requireOrgId } from "@/lib/db/context";
import { astraAnalysisFromScanResult } from "@/lib/ai-audit/astra-response";
import {
  listScanFieldVerificationsForScans,
  verificationMap,
  verifiedFieldValue,
  type FieldVerification,
  type VerificationFieldKey,
} from "@/lib/ai-audit/field-verifications";
import {
  buildVerificationRows,
  fieldResult,
  formatFieldValue,
  RESULT_LABEL,
  type FieldResult,
  type InventoryRowLike,
} from "@/lib/ai-audit/verification-rows";
import {
  assigneeByScan,
  auditorOf,
  loadReporting,
  resolvePeopleFilter,
  resolveStoreFilter,
  type ScopeFilters,
} from "@/lib/ai-dashboard-scope";
import { resolveDashboardDateBounds, type DashboardFilterState } from "@/lib/dashboard-filters";
import { resolveDemoExperience } from "@/lib/demo-environment";

export const VARIANCE_FIELDS: ReadonlyArray<{ key: VerificationFieldKey; label: string }> = [
  { key: "present", label: "Product found" },
  { key: "brand", label: "Brand" },
  { key: "product", label: "Product / variant" },
  { key: "facings", label: "Facings" },
  { key: "visible_units", label: "Quantity (visible units)" },
  { key: "location", label: "Location" },
  { key: "price", label: "Price" },
  { key: "promotion", label: "Promotion" },
];

export type VarianceDimension = "store" | "city" | "team" | "category" | "sku";

export type VarianceRecord = {
  scanId: string;
  date: string;
  store: string;
  city: string;
  team: string;
  category: string;
  sku: string;
  product: string;
  field: VerificationFieldKey;
  fieldLabel: string;
  expected: string;
  aiDetected: string;
  humanVerified: string;
  result: FieldResult;
  resultLabel: string;
  /** Detected (or verified) minus expected, for numeric fields. */
  difference: number | null;
};

export type VarianceFieldTotal = {
  key: VerificationFieldKey;
  label: string;
  checked: number;
  variances: number;
  notVisible: number;
};

export type VarianceGroup = { label: string; variances: number; checked: number };

export type VarianceSummary = {
  audits: number;
  auditsWithPlan: number;
  /** Audits are read newest first, capped for speed. */
  auditLimit: number;
  checked: number;
  variances: number;
  fields: VarianceFieldTotal[];
  groups: Record<VarianceDimension, VarianceGroup[]>;
  records: VarianceRecord[];
};

export type VarianceScanInput = {
  scanId: string;
  date: string;
  store: string;
  city: string;
  team: string;
  category: string | null;
  metrics: Record<string, unknown> | null;
  inventory: InventoryRowLike[];
  verifications: FieldVerification[];
};

const NUMERIC = new Set<VerificationFieldKey>(["facings", "visible_units", "price"]);
const VARIANCE_RESULTS = new Set<FieldResult>(["mismatch", "below", "above"]);
const MAX_AUDITS = 50;

export const EMPTY_VARIANCE_SUMMARY: VarianceSummary = {
  audits: 0,
  auditsWithPlan: 0,
  auditLimit: MAX_AUDITS,
  checked: 0,
  variances: 0,
  fields: VARIANCE_FIELDS.map((f) => ({ ...f, checked: 0, variances: 0, notVisible: 0 })),
  groups: { store: [], city: [], team: [], category: [], sku: [] },
  records: [],
};

function lower(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

/** Pure roll-up — every planned field the AI could check, with the human value winning when verified. */
export function summariseVariances(
  scans: VarianceScanInput[],
  opts: { category?: string | null; sku?: string | null } = {},
): VarianceSummary {
  const category = lower(opts.category);
  const sku = lower(opts.sku);
  const fields = new Map(VARIANCE_FIELDS.map((f) => [f.key, { ...f, checked: 0, variances: 0, notVisible: 0 }]));
  const groups = new Map<VarianceDimension, Map<string, VarianceGroup>>(
    (["store", "city", "team", "category", "sku"] as const).map((d) => [d, new Map()]),
  );
  const bump = (dim: VarianceDimension, label: string, variance: boolean) => {
    const map = groups.get(dim)!;
    const g = map.get(label) ?? { label, variances: 0, checked: 0 };
    g.checked += 1;
    if (variance) g.variances += 1;
    map.set(label, g);
  };
  const records: VarianceRecord[] = [];
  let auditsWithPlan = 0;

  for (const scan of scans) {
    if (!scan.metrics) continue;
    const analysis = astraAnalysisFromScanResult({ metrics: scan.metrics });
    if (analysis.mode !== "planogram") continue;
    const rows = buildVerificationRows(analysis, scan.inventory).filter((row) => row.planned);
    if (!rows.length) continue;
    auditsWithPlan += 1;
    const verified = verificationMap(scan.verifications);
    for (const row of rows) {
      const rowCategory = row.category?.trim() || scan.category?.trim() || "Uncategorised";
      if (category && lower(rowCategory) !== category) continue;
      const rowSku = row.sku?.trim() || row.label;
      if (sku && !lower(rowSku).includes(sku) && !lower(row.label).includes(sku)) continue;
      for (const f of VARIANCE_FIELDS) {
        const human = verifiedFieldValue(verified.get(`${row.rowKey}:${f.key}`));
        const result = fieldResult(row, f.key, human);
        const total = fields.get(f.key)!;
        if (result === "na") continue;
        if (result === "not_visible") {
          total.notVisible += 1;
          continue;
        }
        const isVariance = VARIANCE_RESULTS.has(result);
        total.checked += 1;
        if (isVariance) total.variances += 1;
        bump("store", scan.store, isVariance);
        bump("city", scan.city, isVariance);
        bump("team", scan.team, isVariance);
        bump("category", rowCategory, isVariance);
        bump("sku", rowSku, isVariance);
        if (!isVariance) continue;
        const value = human ?? row.ai[f.key];
        const expected = row.expected[f.key];
        records.push({
          scanId: scan.scanId,
          date: scan.date,
          store: scan.store,
          city: scan.city,
          team: scan.team,
          category: rowCategory,
          sku: row.sku?.trim() ?? "",
          product: row.label,
          field: f.key,
          fieldLabel: f.label,
          expected: formatFieldValue(f.key, expected),
          aiDetected: formatFieldValue(f.key, row.ai[f.key]) || "Not detected",
          humanVerified: formatFieldValue(f.key, human),
          result,
          resultLabel: RESULT_LABEL[result],
          difference:
            NUMERIC.has(f.key) && value != null && expected != null
              ? Math.round((Number(value) - Number(expected)) * 100) / 100
              : null,
        });
      }
    }
  }

  const fieldTotals = [...fields.values()];
  const sortGroups = (dim: VarianceDimension) =>
    [...groups.get(dim)!.values()].sort((a, b) => b.variances - a.variances || b.checked - a.checked);
  return {
    audits: scans.length,
    auditsWithPlan,
    auditLimit: MAX_AUDITS,
    checked: fieldTotals.reduce((s, f) => s + f.checked, 0),
    variances: fieldTotals.reduce((s, f) => s + f.variances, 0),
    fields: fieldTotals,
    groups: {
      store: sortGroups("store"),
      city: sortGroups("city"),
      team: sortGroups("team"),
      category: sortGroups("category"),
      sku: sortGroups("sku"),
    },
    records: records.sort((a, b) => b.date.localeCompare(a.date)),
  };
}

export type VarianceFilters = ScopeFilters &
  Partial<Pick<DashboardFilterState, "datePreset" | "dateFrom" | "dateTo">>;

export async function fetchAiVarianceSummary(
  filters?: VarianceFilters,
  options?: { previewDemo?: boolean; userEmail?: string | null },
): Promise<VarianceSummary> {
  const user = await getUser();
  if (!user) return EMPTY_VARIANCE_SUMMARY;
  const activeOrgId = await requireOrgId();
  const experience = await resolveDemoExperience(activeOrgId, {
    previewDemo: options?.previewDemo,
    userEmail: options?.userEmail,
    honorPreviewOff: true,
  });
  const orgId = experience.dataOrgId;
  const { resolveEffectiveAccessScope, applyStoreScopeFilter, clampStoreIdToScope } = await import(
    "@/lib/access-scope"
  );
  const scope = await resolveEffectiveAccessScope({ orgId: activeOrgId });
  if (!scope.isOrgAdmin && !scope.hasStoreScope && !experience.labeledDemo) return EMPTY_VARIANCE_SUMMARY;

  let q = supabase
    .from("shelf_scans")
    .select("id, store_id, created_by, created_at, processing_completed_at, category")
    .eq("org_id", orgId)
    .eq("status", "completed")
    .or("audit_mode.eq.ai,audit_mode.is.null")
    .order("created_at", { ascending: false })
    .limit(200);
  if (!experience.labeledDemo) {
    q = applyStoreScopeFilter(q, scope) ?? q;
    const storeId = clampStoreIdToScope(filters?.storeId, scope);
    if (storeId && storeId !== "all") q = q.eq("store_id", storeId);
  }
  const bounds = resolveDashboardDateBounds({
    datePreset: filters?.datePreset ?? "all",
    dateFrom: filters?.dateFrom ?? "",
    dateTo: filters?.dateTo ?? "",
  } as DashboardFilterState);
  if (bounds.from) q = q.gte("created_at", bounds.from.toISOString());
  if (bounds.to) q = q.lt("created_at", bounds.to.toISOString());

  const [{ data: scanRows }, geoStores, people] = await Promise.all([
    q,
    resolveStoreFilter(orgId, { country: filters?.country, city: filters?.city }),
    resolvePeopleFilter(orgId, filters),
  ]);
  let scans = (scanRows ?? []).filter((s) => !geoStores || (s.store_id && geoStores.has(s.store_id as string)));
  const assignees = await assigneeByScan(scans.map((s) => s.id as string));
  if (people) {
    scans = scans.filter((s) => {
      const who = auditorOf({ id: s.id as string, created_by: s.created_by as string | null }, assignees);
      return who != null && people.has(who);
    });
  }
  scans = scans.slice(0, MAX_AUDITS);
  const scanIds = scans.map((s) => s.id as string);
  if (!scanIds.length) return EMPTY_VARIANCE_SUMMARY;

  const storeIds = [...new Set(scans.map((s) => s.store_id).filter(Boolean))] as string[];
  const [{ data: results }, { data: products }, verifications, { data: stores }, reporting] = await Promise.all([
    supabase.from("scan_results").select("scan_id, metrics").in("scan_id", scanIds),
    supabase.from("detected_products").select("id, scan_id, name, brand, variant, facings").in("scan_id", scanIds).limit(5000),
    listScanFieldVerificationsForScans(scanIds),
    storeIds.length
      ? supabase.from("stores").select("id, name, city").in("id", storeIds)
      : Promise.resolve({ data: [] as { id: string; name: string; city: string | null }[] }),
    loadReporting(orgId),
  ]);

  const auditors = scans.map((s) => auditorOf({ id: s.id as string, created_by: s.created_by as string | null }, assignees));
  const reportsTo = new Map(reporting.map((r) => [r.user_id, r.reports_to]));
  const managers = new Set(reporting.map((r) => r.reports_to).filter(Boolean) as string[]);
  const nameIds = [...new Set([...auditors, ...managers].filter(Boolean) as string[])];
  const { data: profiles } = nameIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", nameIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const personName = new Map((profiles ?? []).map((p) => [p.id, p.full_name?.trim() || p.email || "Team member"]));
  const teamOf = (auditor: string | null): string => {
    if (!auditor) return "No team";
    const lead = reportsTo.get(auditor) ?? (managers.has(auditor) ? auditor : null);
    return lead ? `${personName.get(lead) ?? "Manager"}'s team` : "No team";
  };

  const metricsByScan = new Map((results ?? []).map((r) => [r.scan_id as string, r.metrics as Record<string, unknown> | null]));
  const storeById = new Map((stores ?? []).map((s) => [s.id as string, s]));
  const inventoryByScan = new Map<string, InventoryRowLike[]>();
  for (const p of products ?? []) {
    const list = inventoryByScan.get(p.scan_id as string) ?? [];
    list.push({ id: p.id as string, brand: p.brand, product: p.name, variant: p.variant, facings: p.facings });
    inventoryByScan.set(p.scan_id as string, list);
  }
  const verificationsByScan = new Map<string, FieldVerification[]>();
  for (const v of verifications) {
    const list = verificationsByScan.get(v.scan_id) ?? [];
    list.push(v);
    verificationsByScan.set(v.scan_id, list);
  }

  const inputs: VarianceScanInput[] = scans.map((s, i) => {
    const store = s.store_id ? storeById.get(s.store_id as string) : null;
    return {
      scanId: s.id as string,
      date: ((s.processing_completed_at ?? s.created_at) as string) ?? "",
      store: store?.name ?? "No store",
      city: store?.city?.trim() || "No city",
      team: teamOf(auditors[i] ?? null),
      category: (s.category as string | null) ?? null,
      metrics: metricsByScan.get(s.id as string) ?? null,
      inventory: inventoryByScan.get(s.id as string) ?? [],
      verifications: verificationsByScan.get(s.id as string) ?? [],
    };
  });

  return summariseVariances(inputs, {
    category: filters?.category && filters.category !== "all" ? filters.category : null,
    sku: filters?.skuId?.trim() || null,
  });
}
