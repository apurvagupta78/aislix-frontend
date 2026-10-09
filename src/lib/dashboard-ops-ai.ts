/**
 * Operations AI Dashboard (mockup v6) aggregates — display layer over persisted data.
 * Verified-over-AI where applicable; no fake zeros.
 */

import { supabase } from "@/integrations/supabase/client";
import { getUser, requireOrgId } from "@/lib/db/context";
import {
  listScanFieldVerificationsForScans,
  verifiedFieldValue,
} from "@/lib/ai-audit/field-verifications";
import {
  resolveDashboardDateBounds,
  type DashboardFilterState,
} from "@/lib/dashboard-filters";
import { AISLIX } from "@/lib/aislix-theme";
import {
  fetchAiDashboardMetrics,
  scopeAuditName,
  type AiDashboardMetrics,
  type DashboardMetricFilters,
} from "@/lib/dashboard-ai-digital";
import { isDemoOrgId, resolveDemoExperience } from "@/lib/demo-environment";
import {
  assigneeByScan,
  auditorOf,
  resolvePeopleFilter,
  resolveStoreFilter,
  scanIdsMatchingSku,
} from "@/lib/ai-dashboard-scope";
import { DEMO_SHELF_FALLBACK_IMAGES } from "@/lib/demo-shelf-images";
import { summaryInsights } from "@/lib/ai-audit/executive-summary-insights";

export { DEMO_SHELF_FALLBACK_IMAGES } from "@/lib/demo-shelf-images";

/** Most shelf photos one audit can carry; well above what the upload step allows. */
const MAX_AUDIT_PHOTOS = 20;

/** Signed URLs for the photos the user uploaded — never the AI overlay, PDF or CSV stored beside them. */
async function signScanEvidenceUrls(scanId: string): Promise<string[]> {
  const imageUrls: string[] = [];
  const { data: images } = await supabase
    .from("scan_images")
    .select("storage_path, storage_bucket, kind, mime_type")
    .eq("scan_id", scanId)
    .order("created_at", { ascending: true })
    .limit(MAX_AUDIT_PHOTOS * 2);

  let rows = (images ?? [])
    .filter((img) => {
      const kind = (img.kind as string | null) ?? "original";
      const mime = (img.mime_type as string | null) ?? "image/";
      return kind === "original" && mime.startsWith("image/");
    })
    .map((img) => ({
      path: img.storage_path as string | null,
      bucket: (img.storage_bucket as string | null) || "scan-images",
    }));
  if (!rows.length) {
    const { data: evidence } = await supabase
      .from("audit_evidence")
      .select("storage_path")
      .eq("scan_id", scanId)
      .limit(MAX_AUDIT_PHOTOS);
    rows = (evidence ?? [])
      .filter((e) => /\.(jpe?g|png|webp|heic|gif)$/i.test(String(e.storage_path ?? "")))
      .map((e) => ({ path: e.storage_path as string | null, bucket: "scan-images" }));
  }
  const seen = new Set<string>();
  rows = rows
    .filter((row) => row.path && !seen.has(row.path) && seen.add(row.path))
    .slice(0, MAX_AUDIT_PHOTOS);

  const signed = await Promise.all(
    rows.map(async (row) => {
      const { data } = await supabase.storage.from(row.bucket).createSignedUrl(row.path!, 3600);
      return data?.signedUrl ?? null;
    }),
  );
  for (const url of signed) {
    if (url) imageUrls.push(url);
  }
  return imageUrls;
}

const EMPTY_AI_METRICS: AiDashboardMetrics = {
  auditCount: 0,
  productsIdentified: null,
  brandsIdentified: null,
  variantsIdentified: null,
  categoriesIdentified: null,
  totalFacings: null,
  totalVisibleUnits: null,
  avgConfidence: null,
  verificationCoveragePct: null,
  aiVsVerifiedUnitVariance: null,
  aiUnitAccuracyPct: null,
  aiFacingAccuracyPct: null,
  fieldMatchRates: [],
  aiAccuracyByField: [],
  verifiedAudits: { verified: 0, total: 0 },
  openFindingsByField: [],
  brandShare: [],
  categoryShare: [],
  topProductsByFacings: [],
  topProductsByUnits: [],
  planogram: {
    applicable: false,
    expectedFacings: null,
    actualFacings: null,
    facingVariance: null,
    facingPct: null,
    compliancePct: null,
  },
};

export type CompletionFilter = "all" | "completed" | "in_progress" | "not_started";

export type OpsDashboardFilters = DashboardMetricFilters & {
  completion?: CompletionFilter;
};

export type ChartRow = { label: string; value: number; color?: string };

export type LastAuditReport = {
  scanId: string;
  assignmentId: string | null;
  auditName: string;
  storeName: string;
  date: string;
  /** False when the AI analysis finished but the audit has not been submitted; null when there is no assignment. */
  submitted?: boolean | null;
  compliancePct: number | null;
  findingsCount: number;
  confidencePct: number | null;
  good: string;
  attention: string;
  nextAction: string;
  imageUrls: string[];
  completed: boolean;
};

export type LastTenAuditRow = {
  id: string;
  scanId: string | null;
  auditName: string;
  templateName: string;
  storeName: string;
  assigneeName: string;
  assignerName?: string;
  assigneeId?: string | null;
  assignerId?: string | null;
  /** Relative to current user when known. */
  relation?: "assigned_to_me" | "assigned_by_me" | "other";
  type: string;
  completionStage: "completed" | "in_progress" | "not_started";
  /** Review-aware label, e.g. "Needs correction" or "Pending review". */
  statusLabel?: string;
  date: string;
  scorePct: number | null;
};

export type StorePerformer = {
  storeId: string;
  storeName: string;
  completionPct: number;
  compliancePct: number | null;
  composite: number;
  completed: number;
  total: number;
};

export type AssignedAuditRow = {
  id: string;
  scanId: string | null;
  auditName: string;
  templateName: string;
  storeName: string;
  assigneeName: string;
  assignerName: string;
  relation: "assigned_to_me" | "assigned_by_me";
  type: "AI" | "Digital";
  completionStage: "completed" | "in_progress" | "not_started";
  date: string;
  dueAt: string | null;
  scorePct: number | null;
};

export type OpsAiDashboardData = {
  metrics: AiDashboardMetrics;
  executive: {
    audits: number;
    completionPct: number | null;
    openCritical: number;
  };
  synopsis: {
    findingsOpen: number;
    caOpen: number;
    historyCount: number;
    teamCount: number;
  };
  completionMix: ChartRow[];
  auditTrend: ChartRow[];
  planogramByStore: { label: string; expected: number; actual: number }[];
  topPerformers: StorePerformer[];
  worstPerformers: StorePerformer[];
  /** Top 5 stores with lowest planogram compliance across filtered assignments (need visits). */
  lowComplianceStores: { storeName: string; compliancePct: number }[];
  lastTen: LastTenAuditRow[];
  /** Audits assigned to the current user or assigned by them. */
  myAssignedAudits: AssignedAuditRow[];
  lastReport: LastAuditReport | null;
  deltas: {
    verificationCoverage: number | null;
    planogramCompliance: number | null;
    totalAudits: number | null;
    avgConfidence: number | null;
  };
  scopeLabel: string;
  labeledDemo?: boolean;
  previewDemo?: boolean;
};

function pct(num: number, den: number): number | null {
  if (!Number.isFinite(den) || den <= 0) return null;
  return (num / den) * 100;
}

function stageOf(row: {
  status?: string | null;
  assignment_state?: string | null;
  approval_status?: string | null;
}): "completed" | "in_progress" | "not_started" {
  const status = (row.status ?? "").toLowerCase();
  const state = (row.assignment_state ?? "").toLowerCase();
  const approval = (row.approval_status ?? "").toLowerCase();
  if (
    status === "completed" ||
    state === "submitted" ||
    approval === "approved" ||
    status === "approved"
  ) {
    return "completed";
  }
  if (
    status === "in_progress" ||
    state === "in_progress" ||
    status === "pending_review" ||
    state === "pending_review"
  ) {
    return "in_progress";
  }
  return "not_started";
}

function statusLabelOf(row: {
  status?: string | null;
  assignment_state?: string | null;
  approval_status?: string | null;
}): string {
  const status = (row.status ?? "").toLowerCase();
  const state = (row.assignment_state ?? "").toLowerCase();
  const approval = (row.approval_status ?? "").toLowerCase();
  if (status === "needs_correction" || state === "reaudit_required") return "Needs correction";
  if (approval === "approved" || status === "approved") return "Approved";
  if (approval === "rejected") return "Rejected";
  if (approval === "pending_review" || state === "submitted" || status === "pending_review") {
    return "Pending review";
  }
  const stage = stageOf(row);
  return stage === "completed" ? "Completed" : stage === "in_progress" ? "In progress" : "Not started";
}

function metricNum(metrics: unknown, key: string): number | null {
  if (!metrics || typeof metrics !== "object") return null;
  const root = metrics as Record<string, unknown>;
  const calc = root.calculated_metrics;
  if (calc && typeof calc === "object") {
    const entry = (calc as Record<string, unknown>)[key];
    if (entry && typeof entry === "object") {
      const v = (entry as Record<string, unknown>).value;
      if (v != null && Number.isFinite(Number(v))) return Number(v);
    }
  }
  const astra = root.astra_cv_analysis;
  if (astra && typeof astra === "object") {
    const summary = (astra as Record<string, unknown>).summary;
    if (summary && typeof summary === "object") {
      const v = (summary as Record<string, unknown>)[key];
      if (v != null && Number.isFinite(Number(v))) return Number(v);
    }
  }
  const direct = root[key];
  if (direct != null && Number.isFinite(Number(direct))) return Number(direct);
  return null;
}

/** Extract product-level visible units from metrics when present (no facings proxy). */
function productUnitsFromMetrics(metrics: unknown): Map<string, number> {
  const out = new Map<string, number>();
  if (!metrics || typeof metrics !== "object") return out;
  const root = metrics as Record<string, unknown>;
  const candidates: unknown[] = [];
  const astra = root.astra_cv_analysis;
  if (astra && typeof astra === "object") {
    const products = (astra as Record<string, unknown>).products;
    if (Array.isArray(products)) candidates.push(...products);
  }
  if (Array.isArray(root.products)) candidates.push(...root.products);
  for (const item of candidates) {
    if (!item || typeof item !== "object") continue;
    const p = item as Record<string, unknown>;
    const brand = String(p.brand ?? "").trim() || "Unknown";
    const name = String(p.name ?? p.product_name ?? "").trim() || "Unknown";
    const units =
      p.visible_units ?? p.units ?? p.unit_count ?? p.quantity ?? null;
    if (units == null || !Number.isFinite(Number(units))) continue;
    const key = `${brand} · ${name}`;
    out.set(key, (out.get(key) ?? 0) + Number(units));
  }
  return out;
}

export async function fetchOpsAiDashboard(
  filters?: OpsDashboardFilters,
  options?: { previewDemo?: boolean; userEmail?: string | null },
): Promise<OpsAiDashboardData> {
  const sessionUser = await getUser();
  if (!sessionUser) {
    const { GUEST_OPS_AI_DASHBOARD } = await import("@/lib/guest-ops-fixtures");
    return GUEST_OPS_AI_DASHBOARD;
  }

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
  const userId = sessionUser.id;

  const empty: OpsAiDashboardData = {
    metrics: EMPTY_AI_METRICS,
    executive: { audits: 0, completionPct: null, openCritical: 0 },
    synopsis: { findingsOpen: 0, caOpen: 0, historyCount: 0, teamCount: 0 },
    completionMix: [],
    auditTrend: [],
    planogramByStore: [],
    topPerformers: [],
    worstPerformers: [],
    lowComplianceStores: [],
    lastTen: [],
    myAssignedAudits: [],
    lastReport: null,
    deltas: {
      verificationCoverage: null,
      planogramCompliance: null,
      totalAudits: null,
      avgConfidence: null,
    },
    scopeLabel: scope.isOrgAdmin ? "Showing all stores" : "Showing your stores",
    labeledDemo: experience.labeledDemo,
    previewDemo: experience.previewDemo,
  };

  if (!scope.isOrgAdmin && !scope.hasStoreScope && !experience.labeledDemo) return empty;

  // Kick off AI metrics immediately — do not block assignment/chart work on them.
  const metricsPromise = fetchAiDashboardMetrics(filters, { orgIdOverride: orgId });

  const bounds = filters
    ? resolveDashboardDateBounds({
        datePreset: filters.datePreset ?? "all",
        dateFrom: filters.dateFrom ?? "",
        dateTo: filters.dateTo ?? "",
      } as DashboardFilterState)
    : null;

  // Assignments (all modes) for completion / last 10 / performers
  let assignQ = supabase
    .from("scan_assignments")
    .select(
      "id, status, assignment_state, approval_status, store_id, scan_id, assignee_id, assigner_id, due_at, created_at, template_id, audit_mode, last_compliance_percent, scope_values",
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (!experience.labeledDemo) {
    assignQ = applyStoreScopeFilter(assignQ, scope) ?? assignQ;
  }
  const scopedStoreId = clampStoreIdToScope(filters?.storeId, scope);
  if (scopedStoreId && scopedStoreId !== "all" && !experience.labeledDemo) {
    assignQ = assignQ.eq("store_id", scopedStoreId);
  }
  if (bounds?.from) assignQ = assignQ.gte("created_at", bounds.from.toISOString());
  if (bounds?.to) assignQ = assignQ.lt("created_at", bounds.to.toISOString());

  const [{ data: assignmentsRaw }, geoStores, people] = await Promise.all([
    assignQ,
    resolveStoreFilter(orgId, { country: filters?.country, city: filters?.city }),
    resolvePeopleFilter(orgId, filters),
  ]);
  let assignments = (assignmentsRaw ?? []).filter((a) => {
    if (geoStores && !(a.store_id && geoStores.has(a.store_id as string))) return false;
    if (people && !(a.assignee_id && people.has(a.assignee_id as string))) return false;
    return true;
  });

  if (filters?.completion && filters.completion !== "all") {
    assignments = assignments.filter((a) => stageOf(a) === filters.completion);
  }

  const storeIds = [...new Set(assignments.map((a) => a.store_id).filter(Boolean))] as string[];
  const personIds = [
    ...new Set(
      assignments.flatMap((a) => [a.assignee_id, a.assigner_id].filter(Boolean) as string[]),
    ),
  ];
  const templateIds = [
    ...new Set(assignments.map((a) => a.template_id).filter(Boolean)),
  ] as string[];
  const scanIdsFromAssign = [
    ...new Set(assignments.map((a) => a.scan_id).filter(Boolean)),
  ] as string[];

  const [{ data: stores }, { data: profiles }, { data: templates }, { data: scans }] =
    await Promise.all([
      storeIds.length
        ? supabase.from("stores").select("id, name").in("id", storeIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      personIds.length
        ? supabase.from("profiles").select("id, full_name, email").in("id", personIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string | null }[] }),
      templateIds.length
        ? supabase.from("audit_templates").select("id, name").in("id", templateIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      scanIdsFromAssign.length
        ? supabase
            .from("shelf_scans")
            .select("id, planogram_compliance_percent, status, created_at, store_id, audit_mode, category")
            .in("id", scanIdsFromAssign.slice(0, 200))
        : Promise.resolve({
            data: [] as {
              id: string;
              planogram_compliance_percent: number | null;
              status: string;
              created_at: string;
              store_id: string | null;
              audit_mode: string | null;
              category: string | null;
            }[],
          }),
    ]);

  const storeName = new Map((stores ?? []).map((s) => [s.id, s.name]));
  const personName = new Map(
    (profiles ?? []).map((p) => [p.id, p.full_name?.trim() || p.email || "Unassigned"]),
  );
  const templateName = new Map((templates ?? []).map((t) => [t.id, t.name]));
  const scanById = new Map((scans ?? []).map((s) => [s.id, s]));

  const categoryFilter =
    filters?.category && filters.category !== "all" ? filters.category.trim().toLowerCase() : null;
  if (categoryFilter) {
    assignments = assignments.filter((a) => {
      const scan = a.scan_id ? scanById.get(a.scan_id as string) : null;
      const scoped = (a.scope_values as Record<string, unknown> | null)?.category;
      return [scan?.category, scoped].some((c) => typeof c === "string" && c.trim().toLowerCase() === categoryFilter);
    });
  }

  // Completion mix
  let completedN = 0;
  let inProgressN = 0;
  let notStartedN = 0;
  for (const a of assignments) {
    const st = stageOf(a);
    if (st === "completed") completedN += 1;
    else if (st === "in_progress") inProgressN += 1;
    else notStartedN += 1;
  }
  const totalAssign = assignments.length;
  const completionMix: ChartRow[] = totalAssign
    ? [
        { label: "Completed", value: completedN, color: AISLIX.supermarketBorder },
        { label: "In Progress", value: inProgressN, color: AISLIX.localBorder },
        { label: "Not Started", value: notStartedN, color: AISLIX.darkstoreBorder },
      ]
    : [];

  // Audit trend (by day) — count assignments created
  const trendMap = new Map<string, number>();
  for (const a of assignments) {
    const d = (a.created_at as string)?.slice(0, 10);
    if (!d) continue;
    trendMap.set(d, (trendMap.get(d) ?? 0) + 1);
  }
  const auditTrend = [...trendMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-14)
    .map(([label, value]) => ({
      label: label.slice(5),
      value,
      color: AISLIX.warehouseBg,
    }));

  // Performers by store
  type Agg = {
    storeId: string;
    completed: number;
    total: number;
    complianceSum: number;
    complianceN: number;
  };
  const byStore = new Map<string, Agg>();
  for (const a of assignments) {
    const sid = a.store_id as string | null;
    if (!sid) continue;
    const agg = byStore.get(sid) ?? {
      storeId: sid,
      completed: 0,
      total: 0,
      complianceSum: 0,
      complianceN: 0,
    };
    agg.total += 1;
    if (stageOf(a) === "completed") agg.completed += 1;
    const scan = a.scan_id ? scanById.get(a.scan_id as string) : null;
    const compliance =
      scan?.planogram_compliance_percent != null
        ? Number(scan.planogram_compliance_percent)
        : a.last_compliance_percent != null
          ? Number(a.last_compliance_percent)
          : null;
    if (compliance != null && Number.isFinite(compliance)) {
      agg.complianceSum += compliance;
      agg.complianceN += 1;
    }
    byStore.set(sid, agg);
  }

  const performers: StorePerformer[] = [...byStore.values()]
    .filter((a) => a.total > 0)
    .map((a) => {
      const completionPct = pct(a.completed, a.total) ?? 0;
      const compliancePct =
        a.complianceN > 0 ? a.complianceSum / a.complianceN : null;
      const composite =
        compliancePct != null ? (completionPct + compliancePct) / 2 : completionPct;
      return {
        storeId: a.storeId,
        storeName: storeName.get(a.storeId) ?? a.storeId.slice(0, 8),
        completionPct,
        compliancePct,
        composite,
        completed: a.completed,
        total: a.total,
      };
    })
    .sort((a, b) => b.composite - a.composite);

  const topPerformers = performers.slice(0, 5);
  const topIds = new Set(topPerformers.map((p) => p.storeId));
  // Avoid mirroring the high list when few stores exist — show lower half only.
  const worstPerformers =
    performers.length <= 5
      ? [...performers]
          .sort((a, b) => a.composite - b.composite)
          .slice(0, Math.max(1, Math.ceil(performers.length / 2)))
      : [...performers]
          .sort((a, b) => a.composite - b.composite)
          .filter((p) => !topIds.has(p.storeId))
          .slice(0, 5);

  // Planogram expected vs actual by store — use any assignment scans with product rows
  const planogramByStore: { label: string; expected: number; actual: number }[] = [];
  const productScanIds = scanIdsFromAssign.slice(0, 80);
  if (productScanIds.length) {
    const [{ data: products }, { data: resultRows }] = await Promise.all([
      supabase
        .from("detected_products")
        .select("scan_id, facings, expected_facings")
        .in("scan_id", productScanIds),
      supabase
        .from("scan_results")
        .select("scan_id, metrics")
        .in("scan_id", productScanIds),
    ]);
    const storeExpected = new Map<string, number>();
    const storeActual = new Map<string, number>();
    for (const p of products ?? []) {
      const scan = scanById.get(p.scan_id as string);
      const sid = scan?.store_id;
      if (!sid) continue;
      storeActual.set(sid, (storeActual.get(sid) ?? 0) + (Number(p.facings) || 0));
      if (p.expected_facings != null) {
        storeExpected.set(sid, (storeExpected.get(sid) ?? 0) + Number(p.expected_facings));
      }
    }
    for (const sid of new Set([...storeExpected.keys(), ...storeActual.keys()])) {
      planogramByStore.push({
        label: storeName.get(sid) ?? sid.slice(0, 8),
        expected: storeExpected.get(sid) ?? 0,
        actual: storeActual.get(sid) ?? 0,
      });
    }
    planogramByStore.sort((a, b) => b.actual - a.actual);

    // Backfill store compliance from facing ratio when scan column is null
    for (const row of planogramByStore) {
      if (row.expected <= 0) continue;
      const sid = [...storeName.entries()].find(([, n]) => n === row.label)?.[0];
      if (!sid) continue;
      const agg = byStore.get(sid);
      if (!agg || agg.complianceN > 0) continue;
      const ratio = Math.min(100, Math.max(0, (row.actual / row.expected) * 100));
      agg.complianceSum += ratio;
      agg.complianceN += 1;
    }

    // Also pull planogram % from scan_results.metrics when shelf_scans column is empty
    for (const row of resultRows ?? []) {
      const compliance = metricNum(row.metrics, "planogram_compliance_percent");
      if (compliance == null) continue;
      const scan = scanById.get(row.scan_id as string);
      const sid = scan?.store_id;
      if (!sid) continue;
      const agg = byStore.get(sid);
      if (!agg || agg.complianceN > 0) continue;
      const pctVal = compliance <= 1 ? compliance * 100 : compliance;
      agg.complianceSum += pctVal;
      agg.complianceN += 1;
    }
  }

  let lowComplianceStores = [...byStore.values()]
    .filter((a) => a.complianceN > 0)
    .map((a) => ({
      storeName: storeName.get(a.storeId) ?? a.storeId.slice(0, 8),
      compliancePct: a.complianceSum / a.complianceN,
    }))
    .sort((a, b) => a.compliancePct - b.compliancePct)
    .slice(0, 5);

  if (!lowComplianceStores.length && planogramByStore.length) {
    lowComplianceStores = planogramByStore
      .filter((r) => r.expected > 0)
      .map((r) => ({
        storeName: r.label,
        compliancePct: Math.min(100, Math.max(0, (r.actual / r.expected) * 100)),
      }))
      .sort((a, b) => a.compliancePct - b.compliancePct)
      .slice(0, 5);
  }

  // Recent audits for Last 10 table (extra rows so Assignment filter still fills 10)
  const lastTen: LastTenAuditRow[] = assignments.slice(0, 40).map((a) => {
    const scan = a.scan_id ? scanById.get(a.scan_id as string) : null;
    const stage = stageOf(a);
    const tmpl = a.template_id
      ? templateName.get(a.template_id as string) ?? "—"
      : "—";
    const scanCategory = ((scan?.category as string | null) ?? "").trim();
    const untemplatedName =
      String(a.audit_mode ?? "").toLowerCase() === "ai"
        ? scanCategory
          ? `Shelf audit · ${scanCategory}`
          : "Shelf audit"
        : "Audit";
    const assigneeId = (a.assignee_id as string | null) ?? null;
    const assignerId = (a.assigner_id as string | null) ?? null;
    let relation: LastTenAuditRow["relation"] = "other";
    if (userId && assigneeId === userId) relation = "assigned_to_me";
    else if (userId && assignerId === userId) relation = "assigned_by_me";
    const ownName = scopeAuditName(a.scope_values);
    return {
      id: a.id as string,
      scanId: (a.scan_id as string | null) ?? null,
      auditName: ownName ?? (tmpl !== "—" ? tmpl : untemplatedName),
      templateName: ownName ?? (tmpl !== "—" ? tmpl : ""),
      storeName: a.store_id ? storeName.get(a.store_id as string) ?? "—" : "—",
      assigneeName: assigneeId
        ? personName.get(assigneeId) ?? "Unassigned"
        : "Unassigned",
      assignerName: assignerId ? personName.get(assignerId) ?? "—" : "—",
      assigneeId,
      assignerId,
      relation,
      type: String(a.audit_mode ?? "digital").toLowerCase() === "ai" ? "AI" : "Digital",
      completionStage: stage,
      statusLabel: statusLabelOf(a),
      date: (a.created_at as string) ?? "",
      scorePct:
        scan?.planogram_compliance_percent != null
          ? Number(scan.planogram_compliance_percent)
          : a.last_compliance_percent != null
            ? Number(a.last_compliance_percent)
            : null,
    };
  });

  // Deprecated separate list — folded into lastTen + Assignment filter
  const myAssignedAudits: AssignedAuditRow[] = [];

  let findingsQ = supabase
    .from("findings")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .not("status", "in", "(closed,resolved)");
  findingsQ = applyStoreScopeFilter(findingsQ, scope) ?? findingsQ;

  let caQ = supabase
    .from("corrective_actions")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .not("status", "in", "(closed,resolved,cancelled)");
  caQ = applyStoreScopeFilter(caQ, scope) ?? caQ;

  const teamQ = supabase
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "active");

  const criticalQ = supabase
    .from("findings")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .not("status", "in", "(closed,resolved)")
    .eq("severity", "critical");

  // Prefer AI-mode assignment scans for coverage/units (avoids a second shelf_scans round-trip).
  const aiScanIds = (scans ?? [])
    .filter((s) => {
      if (s.status !== "completed") return false;
      const mode = String(s.audit_mode ?? "ai").toLowerCase();
      return mode === "ai" || mode === "null";
    })
    .map((s) => s.id as string)
    .slice(0, 200);

  /** Newest AI scan whose analysis finished, in the current filters — submitted or not. */
  const latestFinishedScan = async () => {
    let q = supabase
      .from("shelf_scans")
      .select("id, store_id, created_by, created_at, processing_completed_at, category, planogram_compliance_percent")
      .eq("org_id", orgId)
      .eq("status", "completed")
      .or("audit_mode.eq.ai,audit_mode.is.null")
      .order("processing_completed_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(40);
    if (!experience.labeledDemo) {
      q = applyStoreScopeFilter(q, scope) ?? q;
      if (scopedStoreId && scopedStoreId !== "all") q = q.eq("store_id", scopedStoreId);
    }
    if (bounds?.from) q = q.gte("created_at", bounds.from.toISOString());
    if (bounds?.to) q = q.lt("created_at", bounds.to.toISOString());
    const { data } = await q;
    let candidates = (data ?? []).filter((s) => {
      if (geoStores && !(s.store_id && geoStores.has(s.store_id as string))) return false;
      if (categoryFilter && String(s.category ?? "").trim().toLowerCase() !== categoryFilter) return false;
      return true;
    });
    if (people) {
      const assignees = await assigneeByScan(candidates.map((s) => s.id as string));
      candidates = candidates.filter((s) => {
        const who = auditorOf({ id: s.id as string, created_by: s.created_by as string | null }, assignees);
        return who != null && people.has(who);
      });
    }
    if (filters?.skuId?.trim()) {
      const withSku = await scanIdsMatchingSku(candidates.map((s) => s.id as string), filters.skuId);
      candidates = candidates.filter((s) => withSku.has(s.id as string));
    }
    return candidates[0] ?? null;
  };

  const buildLastReport = async (): Promise<LastAuditReport | null> => {
    const latest = await latestFinishedScan();
    if (!latest) return null;
    const scanId = latest.id as string;
    const { data: assignmentRows } = await supabase
      .from("scan_assignments")
      .select("id, status, assignment_state, approval_status, template_id, scope_values, last_compliance_percent, store_id")
      .eq("scan_id", scanId)
      .order("created_at", { ascending: false })
      .limit(1);
    const lastCompleted = assignmentRows?.[0] ?? null;
    const storeId = (latest.store_id as string | null) ?? (lastCompleted?.store_id as string | null) ?? null;
    const templateId = (lastCompleted?.template_id as string | null) ?? null;
    const [{ data: storeRow }, { data: templateRow }] = await Promise.all([
      storeId && !storeName.has(storeId)
        ? supabase.from("stores").select("name").eq("id", storeId).maybeSingle()
        : Promise.resolve({ data: null as { name: string } | null }),
      templateId && !templateName.has(templateId)
        ? supabase.from("audit_templates").select("name").eq("id", templateId).maybeSingle()
        : Promise.resolve({ data: null as { name: string } | null }),
    ]);
    const category = String(latest.category ?? "").trim();
    const tmplName =
      scopeAuditName(lastCompleted?.scope_values) ??
      (templateId ? templateName.get(templateId) ?? templateRow?.name : null) ??
      (category ? `Shelf audit · ${category}` : "Shelf audit");

    const [resultRes, findingsRes, imageUrlsRaw] = await Promise.all([
      supabase
        .from("scan_results")
        .select("executive_summary, metrics")
        .eq("scan_id", scanId)
        .maybeSingle(),
      supabase
        .from("findings")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("scan_id", scanId),
      signScanEvidenceUrls(scanId),
    ]);

    const result = resultRes.data;
    const findingsCount = findingsRes.count ?? 0;
    const imageUrls =
      imageUrlsRaw.length || !experience.labeledDemo ? imageUrlsRaw : [...DEMO_SHELF_FALLBACK_IMAGES];
    const insights = summaryInsights(result?.executive_summary);
    const conf = metricNum(result?.metrics, "average_confidence");
    return {
      scanId,
      assignmentId: (lastCompleted?.id as string | undefined) ?? null,
      auditName: tmplName,
      storeName: storeId ? storeName.get(storeId) ?? storeRow?.name ?? "—" : "—",
      date: ((latest.processing_completed_at ?? latest.created_at) as string) ?? "",
      submitted: lastCompleted ? stageOf(lastCompleted) === "completed" : null,
      compliancePct:
        latest.planogram_compliance_percent != null
          ? Number(latest.planogram_compliance_percent)
          : lastCompleted?.last_compliance_percent != null
            ? Number(lastCompleted.last_compliance_percent)
            : metricNum(result?.metrics, "planogram_compliance_percent"),
      findingsCount,
      confidencePct: conf != null ? (conf <= 1 ? conf * 100 : conf) : null,
      good: insights.good,
      attention: insights.attention,
      nextAction: insights.nextAction,
      imageUrls,
      completed: true,
    };
  };

  const loadVerificationAndUnits = async () => {
    let verificationCoveragePct: number | null = null;
    const productUnits = new Map<string, number>();
    if (!aiScanIds.length) {
      return { verificationCoveragePct, productUnits };
    }
    const [verRows, resultRows] = await Promise.all([
      listScanFieldVerificationsForScans(aiScanIds),
      supabase
        .from("scan_results")
        .select("metrics")
        .in("scan_id", aiScanIds.slice(0, 40))
        .then((r) => r.data ?? []),
    ]);
    const scansWithVerify = new Set(
      verRows.filter((v) => verifiedFieldValue(v) != null).map((v) => v.scan_id),
    );
    verificationCoveragePct =
      scansWithVerify.size > 0 ? pct(scansWithVerify.size, aiScanIds.length) : null;
    for (const row of resultRows) {
      for (const [k, v] of productUnitsFromMetrics(row.metrics)) {
        productUnits.set(k, (productUnits.get(k) ?? 0) + v);
      }
    }
    return { verificationCoveragePct, productUnits };
  };

  const [
    base,
    [{ count: findingsOpen }, { count: caOpen }, { count: teamCount }, { count: criticalCount }],
    lastReport,
    { verificationCoveragePct, productUnits },
  ] = await Promise.all([
    metricsPromise,
    Promise.all([findingsQ, caQ, teamQ, criticalQ]),
    buildLastReport(),
    loadVerificationAndUnits(),
  ]);

  // Categories: exclude Unknown (already excluded in base aggregation)
  const categoryShare = (base.categoryShare ?? []).filter(
    (r) => r.label.toLowerCase() !== "unknown",
  );

  let topProductsByUnits = [...productUnits.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  if (!topProductsByUnits.length && (base.topProductsByUnits ?? []).length) {
    topProductsByUnits = base.topProductsByUnits;
  }
  if (!topProductsByUnits.length && (base.topProductsByFacings ?? []).length && base.totalVisibleUnits) {
    const totalF = (base.topProductsByFacings ?? []).reduce((s, r) => s + r.value, 0) || 1;
    topProductsByUnits = (base.topProductsByFacings ?? []).map((r) => ({
      label: r.label,
      value: (r.value / totalF) * (base.totalVisibleUnits as number),
    }));
  }

  const topProductsByUnitsFinal = topProductsByUnits;

  // Planogram expected/facing from products if we have expected
  let expectedFacings: number | null = null;
  let facingPct: number | null = null;
  let facingVariance: number | null = null;
  if (planogramByStore.length) {
    expectedFacings = planogramByStore.reduce((s, r) => s + r.expected, 0);
    const actual = planogramByStore.reduce((s, r) => s + r.actual, 0);
    if (expectedFacings > 0) {
      facingPct = (actual / expectedFacings) * 100;
      facingVariance = actual - expectedFacings;
    }
  }

  const metrics: AiDashboardMetrics = {
    ...base,
    categoryShare,
    categoriesIdentified:
      categoryShare.length > 0
        ? new Set(categoryShare.map((c) => c.label)).size
        : base.categoriesIdentified,
    verificationCoveragePct:
      verificationCoveragePct ?? base.verificationCoveragePct,
    topProductsByUnits: topProductsByUnitsFinal,
    planogram: {
      ...base.planogram,
      expectedFacings,
      facingPct,
      facingVariance,
      applicable: base.planogram.applicable || planogramByStore.length > 0,
    },
  };

  return {
    metrics,
    executive: {
      audits: totalAssign,
      completionPct: pct(completedN, totalAssign),
      openCritical: criticalCount ?? 0,
    },
    synopsis: {
      findingsOpen: findingsOpen ?? 0,
      caOpen: caOpen ?? 0,
      historyCount: totalAssign,
      teamCount: teamCount ?? 0,
    },
    completionMix,
    auditTrend,
    planogramByStore: planogramByStore.slice(0, 6),
    topPerformers,
    worstPerformers,
    lowComplianceStores,
    lastTen,
    myAssignedAudits,
    lastReport,
    deltas: {
      verificationCoverage: null,
      planogramCompliance: null,
      totalAudits: null,
      avgConfidence: null,
    },
    scopeLabel: scope.isOrgAdmin ? "Showing all stores" : "Showing your stores",
    labeledDemo: experience.labeledDemo,
    previewDemo: experience.previewDemo,
  };
}

export async function fetchAuditAnalysisReport(
  scanId: string,
): Promise<LastAuditReport | null> {
  const orgId = await requireOrgId();
  const { data: scan } = await supabase
    .from("shelf_scans")
    .select("id, store_id, planogram_compliance_percent, created_at, status")
    .eq("id", scanId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!scan) return null;

  const { data: assignment } = await supabase
    .from("scan_assignments")
    .select(
      "id, store_id, status, assignment_state, approval_status, created_at, template_id, last_compliance_percent, scope_values",
    )
    .eq("scan_id", scanId)
    .eq("org_id", orgId)
    .maybeSingle();

  const completed = assignment
    ? stageOf(assignment) === "completed"
    : scan.status === "completed";

  let templateLabel = scopeAuditName(assignment?.scope_values) ?? "Audit";
  if (templateLabel === "Audit" && assignment?.template_id) {
    const { data: tmpl } = await supabase
      .from("audit_templates")
      .select("name")
      .eq("id", assignment.template_id)
      .maybeSingle();
    if (tmpl?.name) templateLabel = tmpl.name;
  }

  if (!completed) {
    return {
      scanId,
      assignmentId: assignment?.id ?? null,
      auditName: templateLabel,
      storeName: "—",
      date: scan.created_at,
      compliancePct: null,
      findingsCount: 0,
      confidencePct: null,
      good: "",
      attention: "",
      nextAction: "",
      imageUrls: [],
      completed: false,
    };
  }

  let storeName = "—";
  if (scan.store_id) {
    const { data: store } = await supabase
      .from("stores")
      .select("name")
      .eq("id", scan.store_id)
      .maybeSingle();
    storeName = store?.name ?? "—";
  }

  const [resultRes, findingsRes] = await Promise.all([
    supabase
      .from("scan_results")
      .select("executive_summary, metrics")
      .eq("scan_id", scanId)
      .maybeSingle(),
    supabase
      .from("findings")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("scan_id", scanId),
  ]);

  const result = resultRes.data;
  const count = findingsRes.count;
  let imageUrls = await signScanEvidenceUrls(scanId);
  if (!imageUrls.length && isDemoOrgId(orgId)) {
    imageUrls = [...DEMO_SHELF_FALLBACK_IMAGES];
  }

  const insights = summaryInsights(result?.executive_summary);
  const conf = metricNum(result?.metrics, "average_confidence");

  return {
    scanId,
    assignmentId: assignment?.id ?? null,
    auditName: templateLabel,
    storeName,
    date: assignment?.created_at ?? scan.created_at,
    compliancePct:
      scan.planogram_compliance_percent != null
        ? Number(scan.planogram_compliance_percent)
        : assignment?.last_compliance_percent != null
          ? Number(assignment.last_compliance_percent)
          : null,
    findingsCount: count ?? 0,
    confidencePct: conf != null ? (conf <= 1 ? conf * 100 : conf) : null,
    ...insights,
    imageUrls,
    completed: true,
  };
}
