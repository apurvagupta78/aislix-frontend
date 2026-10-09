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
import {
  canonicalBrands,
  fieldInTopic,
  LENS_TOPIC,
  matchesValue,
  rowFacets,
  type AuditorIssue,
  type LensFacets,
  type LensScan,
  type LensSelection,
  type ShelfFact,
} from "@/lib/ai-dashboard-lens";

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
  /** A plan field, or `ca:<issue category>` for an issue a person recorded on the audit. */
  field: string;
  fieldLabel: string;
  expected: string;
  aiDetected: string;
  humanVerified: string;
  result: FieldResult;
  resultLabel: string;
  /** Detected (or verified) minus expected, for numeric fields. */
  difference: number | null;
  origin: "plan" | "auditor";
  facets: LensFacets;
};

export type VarianceFieldTotal = {
  key: VerificationFieldKey;
  label: string;
  checked: number;
  variances: number;
  notVisible: number;
};

export type VarianceGroup = { label: string; variances: number; checked: number };

/** One planned field the AI could assess on one product. */
export type VarianceCheck = {
  scanId: string;
  field: VerificationFieldKey;
  outcome: "variance" | "match" | "not_visible";
  dims: Record<VarianceDimension, string>;
  facets: LensFacets;
};

export type VarianceSummary = {
  audits: number;
  auditsWithPlan: number;
  /** Audits are read newest first, capped for speed. */
  auditLimit: number;
  checked: number;
  variances: number;
  /** Issues people recorded on the audits (included in `records`). */
  recorded: number;
  fields: VarianceFieldTotal[];
  groups: Record<VarianceDimension, VarianceGroup[]>;
  records: VarianceRecord[];
  checks: VarianceCheck[];
  /** Every product row the AI read, in every audit (with or without a plan). */
  facts: ShelfFact[];
  scans: LensScan[];
};

export type VarianceScanInput = {
  scanId: string;
  storeId?: string | null;
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
const DIMS: VarianceDimension[] = ["store", "city", "team", "category", "sku"];

export const EMPTY_VARIANCE_SUMMARY: VarianceSummary = {
  audits: 0,
  auditsWithPlan: 0,
  auditLimit: MAX_AUDITS,
  checked: 0,
  variances: 0,
  recorded: 0,
  fields: VARIANCE_FIELDS.map((f) => ({ ...f, checked: 0, variances: 0, notVisible: 0 })),
  groups: { store: [], city: [], team: [], category: [], sku: [] },
  records: [],
  checks: [],
  facts: [],
  scans: [],
};

function lower(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

/** Field totals, groups and counts from checks + variance records. */
function rollup(
  base: { audits: number; auditLimit: number; scans: LensScan[]; facts: ShelfFact[] },
  checks: VarianceCheck[],
  records: VarianceRecord[],
  fieldKeys: ReadonlySet<string> | null = null,
): VarianceSummary {
  const fields = new Map(
    VARIANCE_FIELDS.filter((f) => !fieldKeys || fieldKeys.has(f.key)).map((f) => [
      f.key,
      { ...f, checked: 0, variances: 0, notVisible: 0 },
    ]),
  );
  const groups = new Map<VarianceDimension, Map<string, VarianceGroup>>(DIMS.map((d) => [d, new Map()]));
  const bump = (dims: Record<VarianceDimension, string>, variance: boolean) => {
    for (const dim of DIMS) {
      const map = groups.get(dim)!;
      const label = dims[dim];
      const g = map.get(label) ?? { label, variances: 0, checked: 0 };
      g.checked += 1;
      if (variance) g.variances += 1;
      map.set(label, g);
    }
  };
  const planScans = new Set<string>();
  for (const c of checks) {
    planScans.add(c.scanId);
    const total = fields.get(c.field);
    if (!total) continue;
    if (c.outcome === "not_visible") {
      total.notVisible += 1;
      continue;
    }
    total.checked += 1;
    if (c.outcome === "variance") total.variances += 1;
    bump(c.dims, c.outcome === "variance");
  }
  let recorded = 0;
  for (const r of records) {
    if (r.origin !== "auditor") continue;
    recorded += 1;
    bump({ store: r.store, city: r.city, team: r.team, category: r.category, sku: r.sku || r.product }, true);
  }
  const fieldTotals = [...fields.values()];
  const sortGroups = (dim: VarianceDimension) =>
    [...groups.get(dim)!.values()].sort((a, b) => b.variances - a.variances || b.checked - a.checked);
  return {
    audits: base.audits,
    auditsWithPlan: planScans.size,
    auditLimit: base.auditLimit,
    checked: fieldTotals.reduce((s, f) => s + f.checked, 0),
    variances: fieldTotals.reduce((s, f) => s + f.variances, 0),
    recorded,
    fields: fieldTotals,
    groups: {
      store: sortGroups("store"),
      city: sortGroups("city"),
      team: sortGroups("team"),
      category: sortGroups("category"),
      sku: sortGroups("sku"),
    },
    records: [...records].sort((a, b) => b.date.localeCompare(a.date)),
    checks,
    facts: base.facts,
    scans: base.scans,
  };
}

/** Pure roll-up — every planned field the AI could check, with the human value winning when verified. */
export function summariseVariances(
  scans: VarianceScanInput[],
  opts: { category?: string | null; sku?: string | null } = {},
): VarianceSummary {
  const category = lower(opts.category);
  const sku = lower(opts.sku);
  const records: VarianceRecord[] = [];
  const checks: VarianceCheck[] = [];
  const facts: ShelfFact[] = [];
  const lensScans: LensScan[] = [];

  for (const scan of scans) {
    lensScans.push({
      scanId: scan.scanId,
      storeId: scan.storeId ?? null,
      date: scan.date,
      store: scan.store,
      city: scan.city,
      team: scan.team,
      category: scan.category?.trim() || "Uncategorised",
    });
    if (!scan.metrics) continue;
    const analysis = astraAnalysisFromScanResult({ metrics: scan.metrics });
    const rows = buildVerificationRows(analysis, scan.inventory);
    if (!rows.length) continue;
    const verified = verificationMap(scan.verifications);
    for (const row of rows) {
      const rowCategory = row.category?.trim() || scan.category?.trim() || "Uncategorised";
      if (category && lower(rowCategory) !== category) continue;
      const rowSku = row.sku?.trim() || row.label;
      if (sku && !lower(rowSku).includes(sku) && !lower(row.label).includes(sku)) continue;
      const human = (key: VerificationFieldKey) => verifiedFieldValue(verified.get(`${row.rowKey}:${key}`));
      const facets = rowFacets({
        row,
        store: scan.store,
        category: rowCategory,
        value: (key) => human(key) ?? row.ai[key],
        result: (key) => fieldResult(row, key, human(key)),
      });
      const facings = human("facings") ?? row.ai.facings;
      const units = human("visible_units") ?? row.ai.visible_units;
      facts.push({
        scanId: scan.scanId,
        storeId: scan.storeId ?? null,
        date: scan.date,
        product: row.label,
        sku: row.sku?.trim() ?? "",
        planned: row.planned,
        facings: facings == null ? null : Number(facings),
        units: units == null ? null : Number(units),
        facets,
      });
      if (!row.planned) continue;
      const dims = { store: scan.store, city: scan.city, team: scan.team, category: rowCategory, sku: rowSku };
      for (const f of VARIANCE_FIELDS) {
        const verifiedValue = human(f.key);
        const result = fieldResult(row, f.key, verifiedValue);
        if (result === "na") continue;
        const isVariance = VARIANCE_RESULTS.has(result);
        checks.push({
          scanId: scan.scanId,
          field: f.key,
          outcome: result === "not_visible" ? "not_visible" : isVariance ? "variance" : "match",
          dims,
          facets,
        });
        if (!isVariance) continue;
        const value = verifiedValue ?? row.ai[f.key];
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
          humanVerified: formatFieldValue(f.key, verifiedValue),
          result,
          resultLabel: RESULT_LABEL[result],
          difference:
            NUMERIC.has(f.key) && value != null && expected != null
              ? Math.round((Number(value) - Number(expected)) * 100) / 100
              : null,
          origin: "plan",
          facets,
        });
      }
    }
  }

  canonicalBrands(facts.map((f) => f.facets));
  return rollup({ audits: scans.length, auditLimit: MAX_AUDITS, scans: lensScans, facts }, checks, records);
}

/**
 * The variances for one View by choice: plan variances plus issues people recorded on the audits,
 * limited to the selected value and, for topic views (location, price…), to that topic.
 */
export function selectVariances(
  summary: VarianceSummary,
  issues: AuditorIssue[],
  sel: LensSelection,
): VarianceSummary {
  const auditor: VarianceRecord[] = issues.map((i) => ({
    scanId: i.scanId,
    date: i.date,
    store: i.store,
    city: i.city,
    team: i.team,
    category: i.category,
    sku: i.sku,
    product: i.product,
    field: i.field,
    fieldLabel: i.fieldLabel,
    expected: "",
    aiDetected: "",
    humanVerified: i.detail,
    result: "mismatch",
    resultLabel: "Recorded by auditor",
    difference: null,
    origin: "auditor",
    facets: i.facets,
  }));
  const keep = (x: { facets: LensFacets; field: string }) => fieldInTopic(sel.lens, x.field) && matchesValue(x.facets, sel);
  const topic = LENS_TOPIC[sel.lens];
  const facts = summary.facts.filter((f) => matchesValue(f.facets, sel));
  return rollup(
    {
      audits: sel.value === "all" ? summary.audits : new Set(facts.map((f) => f.scanId)).size,
      auditLimit: summary.auditLimit,
      scans: summary.scans,
      facts,
    },
    summary.checks.filter(keep),
    [...summary.records.filter((r) => r.origin === "plan"), ...auditor].filter(keep),
    topic ? new Set(topic.fields) : null,
  );
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
      storeId: (s.store_id as string | null) ?? null,
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
