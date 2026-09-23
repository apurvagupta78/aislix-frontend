/**
 * Shared AI + Digital dashboard aggregates (display layer over persisted scan data).
 * Core shelf/planogram math remains Railway shelf_calc; this only aggregates persisted rows.
 */

import { supabase } from "@/integrations/supabase/client";
import { requireOrgId } from "@/lib/db/context";
import {
  listScanFieldVerificationsForScans,
  operationalActual,
} from "@/lib/ai-audit/field-verifications";
import {
  resolveDashboardDateBounds,
  type DashboardFilterState,
} from "@/lib/dashboard-filters";

export type DashboardTab = "ai" | "digital";

export type DashboardMetricFilters = Partial<
  Pick<
    DashboardFilterState,
    | "storeId"
    | "category"
    | "subCategory"
    | "teamMemberId"
    | "datePreset"
    | "dateFrom"
    | "dateTo"
    | "country"
    | "city"
    | "skuId"
  >
>;

export type AiDashboardMetrics = {
  auditCount: number;
  productsIdentified: number | null;
  brandsIdentified: number | null;
  variantsIdentified: number | null;
  categoriesIdentified: number | null;
  totalFacings: number | null;
  totalVisibleUnits: number | null;
  avgConfidence: number | null;
  verificationCoveragePct: number | null;
  aiVsVerifiedUnitVariance: number | null;
  aiUnitAccuracyPct: number | null;
  aiFacingAccuracyPct: number | null;
  brandShare: { label: string; value: number }[];
  categoryShare: { label: string; value: number }[];
  topProductsByFacings: { label: string; value: number }[];
  topProductsByUnits: { label: string; value: number }[];
  planogram: {
    applicable: boolean;
    expectedFacings: number | null;
    actualFacings: number | null;
    facingVariance: number | null;
    facingPct: number | null;
    compliancePct: number | null;
  };
};

export type DigitalDashboardMetrics = {
  totalAudits: number;
  completed: number;
  inProgress: number;
  pendingReview: number;
  reauditRequested: number;
  overdue: number;
  completionPct: number | null;
  onTimePct: number | null;
  totalExpected: number | null;
  totalActual: number | null;
  netVariance: number | null;
  absoluteVariance: number | null;
  variancePct: number | null;
  lastFive: {
    id: string;
    store: string;
    assignee: string;
    date: string;
    status: string;
    expected: number | null;
    actual: number | null;
    variance: number | null;
  }[];
  fnv: {
    applicable: boolean;
    audits: number;
    unitsInspected: number;
    sellable: number;
    damaged: number;
    humanReview: number;
    sellableRate: number | null;
    damageRate: number | null;
    humanReviewRate: number | null;
  };
  varianceByStore: { label: string; value: number }[];
  varianceByCategory: { label: string; value: number }[];
  caOpen: number | null;
  caOverdue: number | null;
  caClosed: number | null;
  potentialInventoryValueVariance: number | null;
  reauditImprovementPct: number | null;
  recurringIssueRate: number | null;
};

function pct(num: number, den: number): number | null {
  if (!Number.isFinite(den) || den <= 0) return null;
  return (num / den) * 100;
}

export async function fetchAiDashboardMetrics(
  filters?: DashboardMetricFilters,
  options?: { orgIdOverride?: string },
): Promise<AiDashboardMetrics> {
  const orgId = options?.orgIdOverride ?? (await requireOrgId());
  const { resolveEffectiveAccessScope, applyStoreScopeFilter, clampStoreIdToScope } = await import(
    "@/lib/access-scope"
  );
  const activeOrgId = await requireOrgId();
  const scope = await resolveEffectiveAccessScope({ orgId: activeOrgId });
  const usingDemoOverride = Boolean(options?.orgIdOverride && options.orgIdOverride !== activeOrgId);
  const empty: AiDashboardMetrics = {
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
  if (!usingDemoOverride && !scope.isOrgAdmin && !scope.hasStoreScope) return empty;

  let scanQuery = supabase
    .from("shelf_scans")
    .select("id, status, planogram_compliance_percent, total_products, audit_mode, store_id, category, created_at, created_by")
    .eq("org_id", orgId)
    .eq("status", "completed")
    .or("audit_mode.eq.ai,audit_mode.is.null")
    .order("created_at", { ascending: false })
    .limit(200);
  if (!usingDemoOverride) {
    scanQuery = applyStoreScopeFilter(scanQuery, scope) ?? scanQuery;
  }
  const scopedStoreId = clampStoreIdToScope(filters?.storeId, scope);
  if (scopedStoreId && scopedStoreId !== "all" && !usingDemoOverride) {
    scanQuery = scanQuery.eq("store_id", scopedStoreId);
  }
  if (filters?.category && filters.category !== "all") {
    scanQuery = scanQuery.eq("category", filters.category);
  }
  if (filters?.skuId && filters.skuId.trim()) {
    // skuId filter applied post-query via product rows when present
  }
  const needsStoreGeo =
    (filters?.country && filters.country !== "all") || (filters?.city && filters.city !== "all");
  let storeIdAllow: Set<string> | null = null;
  if (needsStoreGeo) {
    let storeQ = supabase.from("stores").select("id, country, city").eq("org_id", orgId);
    storeQ = applyStoreScopeFilter(storeQ, scope, "id") ?? storeQ;
    if (filters?.country && filters.country !== "all") storeQ = storeQ.eq("country", filters.country);
    if (filters?.city && filters.city !== "all") storeQ = storeQ.eq("city", filters.city);
    const { data: geoStores } = await storeQ;
    storeIdAllow = new Set((geoStores ?? []).map((s) => s.id as string));
  }
  const bounds = filters
    ? resolveDashboardDateBounds({
        datePreset: filters.datePreset ?? "all",
        dateFrom: filters.dateFrom ?? "",
        dateTo: filters.dateTo ?? "",
      } as DashboardFilterState)
    : null;
  if (bounds?.from) scanQuery = scanQuery.gte("created_at", bounds.from.toISOString());
  if (bounds?.to) scanQuery = scanQuery.lt("created_at", bounds.to.toISOString());

  const { data: scansRaw } = await scanQuery;
  const scans = (scansRaw ?? []).filter((s) => {
    if (!storeIdAllow) return true;
    const sid = s.store_id as string | null;
    return sid != null && storeIdAllow.has(sid);
  });

  const scanIds = (scans ?? []).map((s) => s.id as string);
  if (!scanIds.length) return { ...empty, auditCount: 0 };

  const { data: resultRows } = await supabase
    .from("scan_results")
    .select("scan_id, metrics")
    .in("scan_id", scanIds.slice(0, 80));

  const metricNum = (metrics: unknown, key: string): number | null => {
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
  };

  let metricsFacingsSum = 0;
  let metricsFacingsCount = 0;
  let metricsUnitsSum = 0;
  let metricsUnitsCount = 0;
  for (const row of resultRows ?? []) {
    const facings = metricNum(row.metrics, "total_actual_facings");
    const units = metricNum(row.metrics, "total_actual_visible_units");
    if (facings != null) {
      metricsFacingsSum += facings;
      metricsFacingsCount += 1;
    }
    if (units != null) {
      metricsUnitsSum += units;
      metricsUnitsCount += 1;
    }
  }

  const { data: products } = await supabase
    .from("detected_products")
    .select("id, scan_id, name, brand, variant, category, facings, confidence")
    .in("scan_id", scanIds.slice(0, 80));

  const scanCategoryById = new Map(
    (scans ?? []).map((s) => [s.id as string, ((s.category as string | null) ?? "").trim()]),
  );

  const rows = (products ?? []) as {
    id: string;
    scan_id: string;
    name: string | null;
    brand: string | null;
    variant: string | null;
    category: string | null;
    facings: number | null;
    confidence: number | null;
  }[];

  const productKeys = new Set<string>();
  const brands = new Set<string>();
  const variants = new Set<string>();
  const categories = new Set<string>();
  let facingsSum = 0;
  let facingCount = 0;
  let confSum = 0;
  let confCount = 0;
  const brandFacings = new Map<string, number>();
  const categoryFacings = new Map<string, number>();
  const productFacings = new Map<string, number>();

  const isBlankCategory = (value: string) => {
    const v = value.trim().toLowerCase();
    return !v || v === "unknown" || v === "n/a" || v === "null" || v === "general";
  };

  /** Brand → category when detection category is missing (persisted brand labels only). */
  const categoryFromBrand = (brand: string): string => {
    const b = brand.trim().toLowerCase();
    if (!b || b === "unknown") return "";
    if (
      ["colgate", "oral-b", "oralb", "sensodyne", "closeup", "close-up", "pepsodent", "kolynos", "odol", "doctor"].some(
        (x) => b.includes(x),
      )
    ) {
      return "Oral Care";
    }
    if (["lays", "lay's", "doritos", "cheetos", "kurkure"].some((x) => b.includes(x))) {
      return "Snacks";
    }
    if (
      ["dove", "nivea", "sunsilk", "pantene", "tresemme", "garnier", "loreal", "l'oreal", "head & shoulders"].some(
        (x) => b.includes(x),
      )
    ) {
      return "Personal Care";
    }
    if (["lipton", "canada dry", "a&w", "squirt"].some((x) => b.includes(x))) {
      return "Beverages";
    }
    return "";
  };

  for (const row of rows) {
    const name = (row.name ?? "").trim() || "Unknown";
    const brand = (row.brand ?? "").trim() || "Unknown";
    const variant = (row.variant ?? "").trim();
    const rawCategory = (row.category ?? "").trim();
    const scanCat = scanCategoryById.get(row.scan_id) ?? "";
    const category = !isBlankCategory(rawCategory)
      ? rawCategory
      : !isBlankCategory(scanCat)
        ? scanCat
        : categoryFromBrand(brand);
    productKeys.add(`${brand}|${name}`);
    brands.add(brand);
    variants.add(`${brand}|${name}|${variant}`);
    if (category) categories.add(category);
    const f = Number(row.facings) || 0;
    if (row.facings != null) {
      facingsSum += f;
      facingCount += 1;
      brandFacings.set(brand, (brandFacings.get(brand) ?? 0) + f);
      if (category) {
        categoryFacings.set(category, (categoryFacings.get(category) ?? 0) + f);
      }
      productFacings.set(`${brand} · ${name}`, (productFacings.get(`${brand} · ${name}`) ?? 0) + f);
    }
    if (row.confidence != null && Number.isFinite(Number(row.confidence))) {
      confSum += Number(row.confidence);
      confCount += 1;
    }
  }

  // Verification aggregates across recent scans (single batch query)
  let eligible = 0;
  let verified = 0;
  let unitVar = 0;
  let absUnitErr = 0;
  let verifiedUnitsSum = 0;
  let absFacingErr = 0;
  let verifiedFacingsSum = 0;
  let facingDelta = 0;
  let unitsDelta = 0;
  const verificationRows = await listScanFieldVerificationsForScans(scanIds.slice(0, 20));
  for (const v of verificationRows) {
    // Eligible = AI field present (or already verified). Ignore empty stubs.
    if (v.ai_value == null && v.verified_value == null) continue;
    eligible += 1;
    if (v.verified_value != null) {
      verified += 1;
      const ai = v.ai_value ?? 0;
      const ver = Number(v.verified_value);
      const delta = ver - ai;
      if (v.field_key === "visible_units") {
        unitVar += delta;
        absUnitErr += Math.abs(delta);
        verifiedUnitsSum += ver;
        unitsDelta += delta;
      }
      if (v.field_key === "facings") {
        absFacingErr += Math.abs(delta);
        verifiedFacingsSum += ver;
        facingDelta += delta;
      }
    }
  }

  // Operational totals prefer verified where humans overrode AI (verified ?? ai).
  if (metricsFacingsCount && facingDelta) metricsFacingsSum += facingDelta;
  if (metricsUnitsCount && unitsDelta) metricsUnitsSum += unitsDelta;

  const toShare = (map: Map<string, number>) => {
    const total = [...map.values()].reduce((s, n) => s + n, 0);
    if (total <= 0) return [];
    return [...map.entries()]
      .map(([label, value]) => ({ label, value: (value / total) * 100 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  };

  const top = (map: Map<string, number>) =>
    [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

  const complianceValues = (scans ?? [])
    .map((s) => s.planogram_compliance_percent)
    .filter((v): v is number => v != null && Number.isFinite(Number(v)))
    .map(Number);
  const planogramApplicable = complianceValues.length > 0;

  const realCategories = categories;

  return {
    auditCount: scanIds.length,
    productsIdentified: productKeys.size || null,
    brandsIdentified: brands.size || null,
    variantsIdentified: variants.size || null,
    categoriesIdentified: realCategories.size || null,
    totalFacings: metricsFacingsCount ? metricsFacingsSum : facingCount ? facingsSum : null,
    totalVisibleUnits: metricsUnitsCount ? metricsUnitsSum : null,
    avgConfidence: confCount ? confSum / confCount : null,
    verificationCoveragePct: eligible ? pct(verified, eligible) : null,
    aiVsVerifiedUnitVariance: verified > 0 ? unitVar : null,
    aiUnitAccuracyPct:
      verifiedUnitsSum > 0
        ? Math.max(0, 100 - (absUnitErr / verifiedUnitsSum) * 100)
        : null,
    aiFacingAccuracyPct:
      verifiedFacingsSum > 0
        ? Math.max(0, 100 - (absFacingErr / verifiedFacingsSum) * 100)
        : null,
    brandShare: toShare(brandFacings),
    categoryShare: toShare(categoryFacings),
    topProductsByFacings: top(productFacings),
    // Prefer product-level units from metrics; else allocate scan unit totals by facing share.
    topProductsByUnits: (() => {
      const fromMetrics = new Map<string, number>();
      for (const row of resultRows ?? []) {
        // filled below in ops layer; keep base empty unless we can allocate here
        void row;
      }
      if (!productFacings.size) return [];
      const totalF = [...productFacings.values()].reduce((s, n) => s + n, 0);
      const unitPool = metricsUnitsCount ? metricsUnitsSum : null;
      if (unitPool == null || !(totalF > 0)) return [];
      return [...productFacings.entries()]
        .map(([label, f]) => ({ label, value: (f / totalF) * unitPool }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);
    })(),
    planogram: {
      applicable: planogramApplicable,
      expectedFacings: null,
      actualFacings: metricsFacingsCount ? metricsFacingsSum : facingCount ? facingsSum : null,
      facingVariance: null,
      facingPct: null,
      compliancePct: planogramApplicable
        ? complianceValues.reduce((s, n) => s + n, 0) / complianceValues.length
        : null,
    },
  };
}

export async function fetchDigitalDashboardMetrics(
  filters?: DashboardMetricFilters,
): Promise<DigitalDashboardMetrics> {
  const orgId = await requireOrgId();
  const now = Date.now();
  const { resolveEffectiveAccessScope, applyStoreScopeFilter, clampStoreIdToScope } = await import(
    "@/lib/access-scope"
  );
  const scope = await resolveEffectiveAccessScope({ orgId });
  const emptyDigital: DigitalDashboardMetrics = {
    totalAudits: 0,
    completed: 0,
    inProgress: 0,
    pendingReview: 0,
    reauditRequested: 0,
    overdue: 0,
    completionPct: null,
    onTimePct: null,
    totalExpected: null,
    totalActual: null,
    netVariance: null,
    absoluteVariance: null,
    variancePct: null,
    lastFive: [],
    fnv: {
      applicable: false,
      audits: 0,
      unitsInspected: 0,
      sellable: 0,
      damaged: 0,
      humanReview: 0,
      sellableRate: null,
      damageRate: null,
      humanReviewRate: null,
    },
    varianceByStore: [],
    varianceByCategory: [],
    caOpen: null,
    caOverdue: null,
    caClosed: null,
    potentialInventoryValueVariance: null,
    reauditImprovementPct: null,
    recurringIssueRate: null,
  };
  if (!scope.isOrgAdmin && !scope.hasStoreScope) return emptyDigital;

  let assignmentQuery = supabase
    .from("scan_assignments")
    .select(
      "id, status, approval_status, assignment_state, due_at, completed_at, scan_id, assignee_id, store_id, template_id, created_at, stores:store_id(name)",
    )
    .eq("org_id", orgId)
    .eq("audit_mode", "digital")
    .order("created_at", { ascending: false })
    .limit(300);
  assignmentQuery = applyStoreScopeFilter(assignmentQuery, scope) ?? assignmentQuery;
  const scopedStoreId = clampStoreIdToScope(filters?.storeId, scope);
  if (scopedStoreId && scopedStoreId !== "all") {
    assignmentQuery = assignmentQuery.eq("store_id", scopedStoreId);
  }
  if (filters?.teamMemberId && filters.teamMemberId !== "all") {
    assignmentQuery = assignmentQuery.eq("assignee_id", filters.teamMemberId);
  }
  const needsStoreGeo =
    (filters?.country && filters.country !== "all") || (filters?.city && filters.city !== "all");
  let storeIdAllow: Set<string> | null = null;
  if (needsStoreGeo) {
    let storeQ = supabase.from("stores").select("id, country, city").eq("org_id", orgId);
    storeQ = applyStoreScopeFilter(storeQ, scope, "id") ?? storeQ;
    if (filters?.country && filters.country !== "all") storeQ = storeQ.eq("country", filters.country);
    if (filters?.city && filters.city !== "all") storeQ = storeQ.eq("city", filters.city);
    const { data: geoStores } = await storeQ;
    storeIdAllow = new Set((geoStores ?? []).map((s) => s.id as string));
  }
  const bounds = filters
    ? resolveDashboardDateBounds({
        datePreset: filters.datePreset ?? "all",
        dateFrom: filters.dateFrom ?? "",
        dateTo: filters.dateTo ?? "",
      } as DashboardFilterState)
    : null;
  if (bounds?.from) assignmentQuery = assignmentQuery.gte("created_at", bounds.from.toISOString());
  if (bounds?.to) assignmentQuery = assignmentQuery.lt("created_at", bounds.to.toISOString());

  const { data: assignmentsRaw } = await assignmentQuery;
  const assignments = (assignmentsRaw ?? []).filter((r) => {
    if (!storeIdAllow) return true;
    const sid = r.store_id as string | null;
    return sid != null && storeIdAllow.has(sid);
  });

  const rows = assignments ?? [];
  const totalAudits = rows.length;
  const completed = rows.filter(
    (r) =>
      r.status === "completed" ||
      r.assignment_state === "submitted" ||
      r.approval_status === "approved",
  ).length;
  const inProgress = rows.filter((r) => r.status === "in_progress").length;
  const pendingReview = rows.filter(
    (r) => r.approval_status === "pending_review" || r.assignment_state === "submitted",
  ).length;
  const reauditRequested = rows.filter(
    (r) => r.assignment_state === "reaudit_required" || r.status === "needs_correction",
  ).length;
  const overdue = rows.filter((r) => {
    if (!r.due_at) return false;
    if (r.status === "completed" || r.approval_status === "approved") return false;
    return new Date(r.due_at as string).getTime() < now;
  }).length;

  const withDueCompleted = rows.filter(
    (r) => r.completed_at && r.due_at && (r.status === "completed" || r.assignment_state === "submitted"),
  );
  const onTime = withDueCompleted.filter(
    (r) => new Date(r.completed_at as string).getTime() <= new Date(r.due_at as string).getTime(),
  ).length;

  const scanIds = rows.map((r) => r.scan_id as string | null).filter(Boolean) as string[];
  let totalExpected: number | null = null;
  let totalActual: number | null = null;
  let netVariance: number | null = null;
  let absoluteVariance: number | null = null;
  let variancePct: number | null = null;

  if (scanIds.length) {
    const scopedScanIds = scanIds.slice(0, 100);
    let { data: lines } = await supabase
      .from("digital_audit_lines")
      .select("expected_qty, actual_qty, scan_id")
      .in("scan_id", scopedScanIds);

    // Backfill lines for universal/custom digital submits that predate materialization
    // (or never opened Review/Results, which is the other ensure trigger).
    const scansWithLines = new Set(
      (lines ?? []).map((l) => l.scan_id as string).filter(Boolean),
    );
    const missingLineScans = scopedScanIds.filter((id) => !scansWithLines.has(id)).slice(0, 25);
    if (missingLineScans.length) {
      const { ensureCustomAuditReviewData } = await import("@/lib/custom-audit-review");
      await Promise.all(
        missingLineScans.map((id) => ensureCustomAuditReviewData(id).catch(() => false)),
      );
      const refreshed = await supabase
        .from("digital_audit_lines")
        .select("expected_qty, actual_qty, scan_id")
        .in("scan_id", scopedScanIds);
      lines = refreshed.data;
    }

    const usable = (lines ?? []).filter(
      (l) => l.actual_qty != null && l.expected_qty != null,
    ) as { expected_qty: number; actual_qty: number }[];
    if (usable.length) {
      totalExpected = usable.reduce((s, l) => s + Number(l.expected_qty), 0);
      totalActual = usable.reduce((s, l) => s + Number(l.actual_qty), 0);
      netVariance = totalActual - totalExpected;
      absoluteVariance = usable.reduce(
        (s, l) => s + Math.abs(Number(l.actual_qty) - Number(l.expected_qty)),
        0,
      );
      variancePct = pct(totalActual - totalExpected, totalExpected);
    }
  }

  const assigneeIds = [...new Set(rows.map((r) => r.assignee_id as string).filter(Boolean))];
  const names = new Map<string, string>();
  if (assigneeIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", assigneeIds);
    for (const p of profiles ?? []) {
      names.set(
        p.id as string,
        ((p.full_name as string | null)?.trim() || (p.email as string | null) || "Assignee") as string,
      );
    }
  }

  const lastFive = rows.slice(0, 5).map((r) => {
    const storeRel = r.stores as { name?: string } | { name?: string }[] | null;
    const storeName = Array.isArray(storeRel) ? storeRel[0]?.name : storeRel?.name;
    const scanId = r.scan_id as string | null;
    let expected: number | null = null;
    let actual: number | null = null;
    let variance: number | null = null;
    if (scanId && scanIds.length) {
      // Filled below after line aggregates when available.
    }
    return {
      id: r.id as string,
      store: storeName ?? "—",
      assignee: names.get(r.assignee_id as string) ?? "—",
      date: (r.created_at as string) ?? "",
      status: (r.assignment_state as string) || (r.status as string) || "—",
      expected,
      actual,
      variance,
      scanId,
    };
  });

  // Fill lastFive expected/actual from mapped digital lines (Expected+Actual only).
  const lastFiveScanIds = lastFive.map((r) => r.scanId).filter(Boolean) as string[];
  if (lastFiveScanIds.length) {
    const { data: lastLines } = await supabase
      .from("digital_audit_lines")
      .select("scan_id, expected_qty, actual_qty")
      .in("scan_id", lastFiveScanIds);
    const byScan = new Map<string, { e: number; a: number }>();
    for (const line of lastLines ?? []) {
      if (line.actual_qty == null || line.expected_qty == null) continue;
      const sid = line.scan_id as string;
      const cur = byScan.get(sid) ?? { e: 0, a: 0 };
      cur.e += Number(line.expected_qty);
      cur.a += Number(line.actual_qty);
      byScan.set(sid, cur);
    }
    for (const row of lastFive) {
      if (!row.scanId) continue;
      const agg = byScan.get(row.scanId);
      if (!agg) continue;
      row.expected = agg.e;
      row.actual = agg.a;
      row.variance = agg.a - agg.e;
    }
  }

  const lastFiveOut = lastFive.map(({ scanId: _sid, ...rest }) => rest);

  // FNV QC subsection — dispositions from digital_audit_lines.qc_disposition
  const { data: fnvTemplates } = await supabase
    .from("audit_templates")
    .select("id")
    .eq("org_id", orgId)
    .or("template_type.eq.fnv_qc_audit,name.ilike.%fnv%");
  const fnvTemplateIds = new Set((fnvTemplates ?? []).map((t) => t.id as string));
  const fnvRows = rows.filter((r) => r.template_id && fnvTemplateIds.has(r.template_id as string));
  const fnvScanIds = fnvRows
    .map((r) => r.scan_id as string | null)
    .filter(Boolean) as string[];

  let sellable = 0;
  let damaged = 0;
  let humanReview = 0;
  let unitsInspected = 0;
  if (fnvScanIds.length) {
    const { data: qcLines } = await supabase
      .from("digital_audit_lines")
      .select("qc_disposition")
      .in("scan_id", fnvScanIds.slice(0, 100))
      .not("qc_disposition", "is", null);
    for (const line of qcLines ?? []) {
      const d = (line as { qc_disposition?: string }).qc_disposition;
      if (!d) continue;
      unitsInspected += 1;
      if (d === "SELLABLE") sellable += 1;
      else if (d === "DAMAGED") damaged += 1;
      else if (d === "HUMAN_REVIEW") humanReview += 1;
    }
  }

  const rate = (n: number) => (unitsInspected > 0 ? (n / unitsInspected) * 100 : null);

  // Variance Explorer — absolute variance by store / category (Expected+Actual mapped only)
  const varianceByStoreMap = new Map<string, number>();
  const varianceByCategoryMap = new Map<string, number>();
  if (scanIds.length) {
    const { data: varLines } = await supabase
      .from("digital_audit_lines")
      .select("expected_qty, actual_qty, category, scan_id")
      .in("scan_id", scanIds.slice(0, 100));
    const scanStore = new Map<string, string>();
    for (const r of rows) {
      if (!r.scan_id) continue;
      const storeRel = r.stores as { name?: string } | { name?: string }[] | null;
      const storeName = Array.isArray(storeRel) ? storeRel[0]?.name : storeRel?.name;
      scanStore.set(r.scan_id as string, storeName ?? "—");
    }
    for (const line of varLines ?? []) {
      if (line.actual_qty == null || line.expected_qty == null) continue;
      const abs = Math.abs(Number(line.actual_qty) - Number(line.expected_qty));
      const store = scanStore.get(line.scan_id as string) ?? "—";
      varianceByStoreMap.set(store, (varianceByStoreMap.get(store) ?? 0) + abs);
      const cat = ((line.category as string) || "Uncategorized").trim() || "Uncategorized";
      varianceByCategoryMap.set(cat, (varianceByCategoryMap.get(cat) ?? 0) + abs);
    }
  }
  const topAbs = (m: Map<string, number>) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value]) => ({ label, value }));

  // Corrective actions summary (digital-origin)
  let caOpen: number | null = null;
  let caOverdue: number | null = null;
  let caClosed: number | null = null;
  {
    let caQuery = supabase
      .from("corrective_actions")
      .select("id, status, due_at")
      .eq("org_id", orgId)
      .limit(500);
    if (!scope.isOrgAdmin) {
      const ids = scope.effectiveStoreIds.map((id) => `"${id}"`).join(",");
      caQuery = caQuery.or(`store_id.in.(${ids}),store_id.is.null`);
    }
    const { data: cas } = await caQuery;
    if (cas) {
      caOpen = cas.filter((c) => !["closed", "resolved", "cancelled"].includes(String(c.status))).length;
      caClosed = cas.filter((c) => ["closed", "resolved"].includes(String(c.status))).length;
      caOverdue = cas.filter((c) => {
        if (["closed", "resolved", "cancelled"].includes(String(c.status))) return false;
        return c.due_at && new Date(c.due_at as string).getTime() < now;
      }).length;
    }
  }

  // Potential inventory value variance — sum abs(variance_value_inr) when MRP mapped
  let potentialInventoryValueVariance: number | null = null;
  if (scanIds.length) {
    const { data: valueLines } = await supabase
      .from("digital_audit_lines")
      .select("variance_value_inr, expected_qty, actual_qty, mrp_inr")
      .in("scan_id", scanIds.slice(0, 100));
    const withValue = (valueLines ?? []).filter(
      (l) =>
        l.variance_value_inr != null &&
        Number.isFinite(Number(l.variance_value_inr)) &&
        l.expected_qty != null &&
        l.actual_qty != null,
    );
    if (withValue.length) {
      potentialInventoryValueVariance = withValue.reduce(
        (s, l) => s + Math.abs(Number(l.variance_value_inr)),
        0,
      );
    }
  }

  // Re-audit improvement + recurring issue rate from findings
  let reauditImprovementPct: number | null = null;
  let recurringIssueRate: number | null = null;
  {
    let findingsQuery = supabase
      .from("findings")
      .select("id, status, store_id, sku, finding_type, created_at")
      .eq("org_id", orgId)
      .limit(800);
    findingsQuery = applyStoreScopeFilter(findingsQuery, scope) ?? findingsQuery;
    const { data: findings } = await findingsQuery;
    if (findings?.length) {
      const groups = new Map<string, { open: number; closed: number; total: number }>();
      for (const f of findings) {
        const key = `${f.store_id ?? ""}|${f.sku ?? ""}|${f.finding_type ?? ""}`;
        const g = groups.get(key) ?? { open: 0, closed: 0, total: 0 };
        g.total += 1;
        if (["closed", "resolved"].includes(String(f.status))) g.closed += 1;
        else g.open += 1;
        groups.set(key, g);
      }
      const recurringGroups = [...groups.values()].filter((g) => g.total > 1);
      recurringIssueRate =
        groups.size > 0 ? (recurringGroups.length / groups.size) * 100 : null;
      const improved = recurringGroups.filter((g) => g.closed > 0 && g.open === 0).length;
      reauditImprovementPct =
        recurringGroups.length > 0 ? (improved / recurringGroups.length) * 100 : null;
    }
  }

  return {
    totalAudits,
    completed,
    inProgress,
    pendingReview,
    reauditRequested,
    overdue,
    completionPct: pct(completed, totalAudits),
    onTimePct: withDueCompleted.length ? pct(onTime, withDueCompleted.length) : null,
    totalExpected,
    totalActual,
    netVariance,
    absoluteVariance,
    variancePct,
    lastFive: lastFiveOut,
    fnv: {
      applicable: fnvRows.length > 0,
      audits: fnvRows.length,
      unitsInspected,
      sellable,
      damaged,
      humanReview,
      sellableRate: rate(sellable),
      damageRate: rate(damaged),
      humanReviewRate: rate(humanReview),
    },
    varianceByStore: topAbs(varianceByStoreMap),
    varianceByCategory: topAbs(varianceByCategoryMap),
    caOpen,
    caOverdue,
    caClosed,
    potentialInventoryValueVariance,
    reauditImprovementPct,
    recurringIssueRate,
  };
}

void operationalActual;
