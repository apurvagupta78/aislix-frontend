/**
 * Operations AI Dashboard (mockup v6) aggregates — display layer over persisted data.
 * Verified-over-AI where applicable; no fake zeros.
 */

import { supabase } from "@/integrations/supabase/client";
import { getUser, requireOrgId } from "@/lib/db/context";
import {
  listScanFieldVerificationsForScans,
} from "@/lib/ai-audit/field-verifications";
import {
  resolveDashboardDateBounds,
  type DashboardFilterState,
} from "@/lib/dashboard-filters";
import { AISLIX } from "@/lib/aislix-theme";
import {
  fetchAiDashboardMetrics,
  type AiDashboardMetrics,
  type DashboardMetricFilters,
} from "@/lib/dashboard-ai-digital";
import { resolveDemoExperience } from "@/lib/demo-environment";
import { DEMO_SHELF_FALLBACK_IMAGES } from "@/lib/demo-shelf-images";

export { DEMO_SHELF_FALLBACK_IMAGES } from "@/lib/demo-shelf-images";

async function signScanEvidenceUrls(scanId: string): Promise<string[]> {
  const imageUrls: string[] = [];
  const [{ data: images }, { data: evidence }] = await Promise.all([
    supabase
      .from("scan_images")
      .select("storage_path, storage_bucket")
      .eq("scan_id", scanId)
      .order("created_at", { ascending: true })
      .limit(3),
    supabase
      .from("audit_evidence")
      .select("storage_path")
      .eq("scan_id", scanId)
      .limit(3),
  ]);

  const rows = [
    ...(images ?? []).map((img) => ({
      path: img.storage_path as string | null,
      bucket: (img.storage_bucket as string | null) || "scan-images",
    })),
    ...(evidence ?? []).map((img) => ({
      path: img.storage_path as string | null,
      bucket: "scan-images",
    })),
  ];

  for (const row of rows) {
    if (!row.path || imageUrls.length >= 3) continue;
    const { data: signed } = await supabase.storage.from(row.bucket).createSignedUrl(row.path, 3600);
    if (signed?.signedUrl) imageUrls.push(signed.signedUrl);
  }
  return imageUrls;
}

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

function parseInsights(executiveSummary: unknown): {
  good: string;
  attention: string;
  nextAction: string;
} {
  const fallback = {
    good: "Shelf execution captured for this audit.",
    attention: "Review findings and planogram gaps in the full report.",
    nextAction: "Open the audit and assign corrective actions where needed.",
  };
  if (typeof executiveSummary !== "string" || !executiveSummary.trim()) return fallback;
  const text = executiveSummary.trim();
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    good: sentences[0] ?? fallback.good,
    attention: sentences[1] ?? fallback.attention,
    nextAction: sentences[2] ?? fallback.nextAction,
  };
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
  const user = await getUser();
  const userId = user?.id ?? null;

  const empty: OpsAiDashboardData = {
    metrics: await fetchAiDashboardMetrics(filters, { orgIdOverride: orgId }),
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
      "id, status, assignment_state, approval_status, store_id, scan_id, assignee_id, assigner_id, due_at, created_at, template_id, audit_mode, last_compliance_percent",
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

  const { data: assignmentsRaw } = await assignQ;
  let assignments = assignmentsRaw ?? [];

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
            .select("id, planogram_compliance_percent, status, created_at, store_id")
            .in("id", scanIdsFromAssign.slice(0, 200))
        : Promise.resolve({
            data: [] as {
              id: string;
              planogram_compliance_percent: number | null;
              status: string;
              created_at: string;
              store_id: string | null;
            }[],
          }),
    ]);

  const storeName = new Map((stores ?? []).map((s) => [s.id, s.name]));
  const personName = new Map(
    (profiles ?? []).map((p) => [p.id, p.full_name?.trim() || p.email || "Unassigned"]),
  );
  const templateName = new Map((templates ?? []).map((t) => [t.id, t.name]));
  const scanById = new Map((scans ?? []).map((s) => [s.id, s]));

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
    const { data: products } = await supabase
      .from("detected_products")
      .select("scan_id, facings, expected_facings")
      .in("scan_id", productScanIds);
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
  }

  // Also pull planogram % from scan_results.metrics when shelf_scans column is empty
  if (productScanIds.length) {
    const { data: resultRows } = await supabase
      .from("scan_results")
      .select("scan_id, metrics")
      .in("scan_id", productScanIds);
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
    const assigneeId = (a.assignee_id as string | null) ?? null;
    const assignerId = (a.assigner_id as string | null) ?? null;
    let relation: LastTenAuditRow["relation"] = "other";
    if (userId && assigneeId === userId) relation = "assigned_to_me";
    else if (userId && assignerId === userId) relation = "assigned_by_me";
    return {
      id: a.id as string,
      scanId: (a.scan_id as string | null) ?? null,
      auditName: tmpl !== "—" ? tmpl : "Audit",
      templateName: tmpl,
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

  // Last completed report
  const lastCompleted = assignments.find((a) => stageOf(a) === "completed" && a.scan_id);
  let lastReport: LastAuditReport | null = null;
  if (lastCompleted?.scan_id) {
    const scanId = lastCompleted.scan_id as string;
    const tmplName = lastCompleted.template_id
      ? templateName.get(lastCompleted.template_id as string) ?? "Completed audit"
      : "Completed audit";

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
    const findingsCount = findingsRes.count ?? 0;
    let imageUrls = await signScanEvidenceUrls(scanId);
    if (!imageUrls.length) {
      imageUrls = [...DEMO_SHELF_FALLBACK_IMAGES];
    }

    const insights = parseInsights(result?.executive_summary);
    const conf = metricNum(result?.metrics, "average_confidence");

    const scan = scanById.get(scanId);
    lastReport = {
      scanId,
      assignmentId: lastCompleted.id as string,
      auditName: tmplName,
      storeName: lastCompleted.store_id
        ? storeName.get(lastCompleted.store_id as string) ?? "—"
        : "—",
      date: (lastCompleted.created_at as string) ?? "",
      compliancePct:
        scan?.planogram_compliance_percent != null
          ? Number(scan.planogram_compliance_percent)
          : lastCompleted.last_compliance_percent != null
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
  }

  // Synopsis counts
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

  let teamQ = supabase
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "active");

  const [{ count: findingsOpen }, { count: caOpen }, { count: teamCount }] = await Promise.all([
    findingsQ,
    caQ,
    teamQ,
  ]);

  const { count: criticalCount } = await supabase
    .from("findings")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .not("status", "in", "(closed,resolved)")
    .eq("severity", "critical");

  // Base AI metrics + fixes
  const base = await fetchAiDashboardMetrics(filters, { orgIdOverride: orgId });

  // Categories: exclude Unknown (already excluded in base aggregation)
  const categoryShare = (base.categoryShare ?? []).filter(
    (r) => r.label.toLowerCase() !== "unknown",
  );

  // Verification coverage = % of audits (scans) with any human verification.
  // N/A when no human verification exists yet — never show a fake 0%.
  let verificationCoveragePct: number | null = null;
  const aiScanIds = (
    await (async () => {
      let q = supabase
        .from("shelf_scans")
        .select("id")
        .eq("org_id", orgId)
        .eq("status", "completed")
        .or("audit_mode.eq.ai,audit_mode.is.null")
        .limit(80);
      q = applyStoreScopeFilter(q, scope) ?? q;
      if (scopedStoreId && scopedStoreId !== "all") q = q.eq("store_id", scopedStoreId);
      if (bounds?.from) q = q.gte("created_at", bounds.from.toISOString());
      if (bounds?.to) q = q.lt("created_at", bounds.to.toISOString());
      const { data } = await q;
      return (data ?? []).map((s) => s.id as string);
    })()
  );
  if (aiScanIds.length) {
    const verRows = await listScanFieldVerificationsForScans(aiScanIds);
    const scansWithVerify = new Set(
      verRows.filter((v) => v.verified_value != null).map((v) => v.scan_id),
    );
    verificationCoveragePct =
      scansWithVerify.size > 0 ? pct(scansWithVerify.size, aiScanIds.length) : null;
  }

  // Prefer metrics product units; else allocate persisted total visible units by facing share.
  const productUnits = new Map<string, number>();
  if (aiScanIds.length) {
    const { data: resultRows } = await supabase
      .from("scan_results")
      .select("metrics")
      .in("scan_id", aiScanIds.slice(0, 40));
    for (const row of resultRows ?? []) {
      for (const [k, v] of productUnitsFromMetrics(row.metrics)) {
        productUnits.set(k, (productUnits.get(k) ?? 0) + v);
      }
    }
  }
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
    verificationCoveragePct,
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
      "id, store_id, status, assignment_state, approval_status, created_at, template_id, last_compliance_percent",
    )
    .eq("scan_id", scanId)
    .eq("org_id", orgId)
    .maybeSingle();

  const completed = assignment
    ? stageOf(assignment) === "completed"
    : scan.status === "completed";

  let templateLabel = "Audit";
  if (assignment?.template_id) {
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
  if (!imageUrls.length) {
    imageUrls = [...DEMO_SHELF_FALLBACK_IMAGES];
  }

  const insights = parseInsights(result?.executive_summary);
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
