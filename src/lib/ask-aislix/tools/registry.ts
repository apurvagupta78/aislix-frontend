import type { SupabaseClient } from "@supabase/supabase-js";
import type { FunctionTool } from "openai/resources/responses/responses";

import type { Database } from "@/integrations/supabase/types";
import type { DashboardFilterState } from "@/lib/dashboard-filters";
import { resolveDashboardDateBounds } from "@/lib/dashboard-filters";
import {
  ACCESS_DENIED_MESSAGE,
  type AskAislixAccessScope,
  type ImageGalleryItem,
  type ToolResult,
} from "@/lib/ask-aislix/ask-aislix.types";
import { clampFiltersToScope, resolveStoreQuery, storeIdsForQuery } from "@/lib/ask-aislix/context";
import { fetchScopedControlTowerDataset } from "@/lib/ask-aislix/dataset";
import {
  completionPct,
  UNWIRED_UNIVERSAL_KPI_IDS,
} from "@/lib/kpi-engine/compute-universal";

import {
  getAuditDetails,
  getAuditEvidenceImagesExtended,
  getAuditReports,
  getAuditResponses,
  getAuditsAggregate,
  getDetectedProducts,
  getDigitalAuditLines,
  getMyAudits,
  getPlanogramCompliance,
  getScanAnalysis,
} from "./audit-data-tools";

export type ToolContext = {
  supabase: SupabaseClient<Database>;
  scope: AskAislixAccessScope;
  filters: DashboardFilterState;
};

export type ToolExecutor = (ctx: ToolContext, args: Record<string, unknown>) => Promise<ToolResult>;

const NOT_WIRED = "Data unavailable — insufficient source data";

type ToolSpec = { name: string; description: string; parameters: Record<string, unknown> };

const TOOL_SPECS: ToolSpec[] = [
  {
    name: "get_kpi",
    description: "Get authoritative KPI values for the user's authorized scope.",
    parameters: {
      type: "object",
      properties: {
        kpi_id: {
          type: "string",
          enum: [
            "audit_completion",
            "evidence_coverage",
            "audit_pass",
            "value_variance",
            "open_findings",
            "critical_findings",
            "overdue_actions",
            "sla_compliance",
            "open_actions",
          ],
        },
      },
      required: ["kpi_id"],
    },
  },
  {
    name: "get_audit_summary",
    description: "Summary counts of audits/assignments in scope.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_overdue_audits",
    description: "List overdue audit assignments.",
    parameters: { type: "object", properties: { limit: { type: "number" } } },
  },
  {
    name: "get_inventory_variance",
    description: "Store-level potential inventory value variance ranking.",
    parameters: {
      type: "object",
      properties: { limit: { type: "number" }, store_query: { type: "string" } },
    },
  },
  {
    name: "get_findings",
    description: "Findings counts and top open findings.",
    parameters: {
      type: "object",
      properties: { severity: { type: "string" }, limit: { type: "number" } },
    },
  },
  {
    name: "get_corrective_actions",
    description: "Open and overdue corrective actions.",
    parameters: {
      type: "object",
      properties: { status: { type: "string" }, limit: { type: "number" } },
    },
  },
  {
    name: "get_audit_trends",
    description: "Audit completion and findings trends over time.",
    parameters: {
      type: "object",
      properties: { compare_previous_period: { type: "boolean" } },
    },
  },
  {
    name: "get_store_performance",
    description: "Top stores by risk/completion in authorized scope.",
    parameters: { type: "object", properties: { limit: { type: "number" } } },
  },
  {
    name: "get_expiry_risk",
    description: "Expiry-risk findings in scope.",
    parameters: { type: "object", properties: { limit: { type: "number" } } },
  },
  {
    name: "get_my_audits",
    description: "List authorized audits with participation filter (assigned_to_me, conducted_by_me, all).",
    parameters: {
      type: "object",
      properties: {
        participation: { type: "string", enum: ["all", "assigned_to_me", "conducted_by_me"] },
        store_query: { type: "string" },
        store_id: { type: "string" },
        include_completed_only: { type: "boolean" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "get_audit_details",
    description: "Detailed assignment + scan metadata for one authorized audit.",
    parameters: {
      type: "object",
      properties: { assignment_id: { type: "string" }, scan_id: { type: "string" } },
    },
  },
  {
    name: "get_scan_analysis",
    description: "Structured scan_results analysis (summary, metrics, brand share, shelf rows).",
    parameters: {
      type: "object",
      properties: { scan_id: { type: "string" } },
      required: ["scan_id"],
    },
  },
  {
    name: "get_detected_products",
    description: "Detected products/SKUs for an authorized scan.",
    parameters: {
      type: "object",
      properties: { scan_id: { type: "string" }, limit: { type: "number" } },
      required: ["scan_id"],
    },
  },
  {
    name: "get_audit_responses",
    description: "Custom audit template responses for a scan or assignment.",
    parameters: {
      type: "object",
      properties: {
        scan_id: { type: "string" },
        assignment_id: { type: "string" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "get_digital_audit_lines",
    description: "Digital/custom audit variance lines with RCA for a scan.",
    parameters: {
      type: "object",
      properties: { scan_id: { type: "string" }, limit: { type: "number" } },
      required: ["scan_id"],
    },
  },
  {
    name: "get_planogram_compliance",
    description: "Planogram compliance for a scan or assignment.",
    parameters: {
      type: "object",
      properties: { scan_id: { type: "string" }, assignment_id: { type: "string" } },
    },
  },
  {
    name: "get_audit_reports",
    description: "Multi-source audit reports (scan_images, executive summary, scan KPIs, CSV excerpts).",
    parameters: {
      type: "object",
      properties: {
        scan_id: { type: "string" },
        assignment_id: { type: "string" },
        participation: { type: "string", enum: ["all", "assigned_to_me", "conducted_by_me"] },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "get_audits_aggregate",
    description: "Broad-period audit aggregation for authorized scope (30-day style analysis).",
    parameters: {
      type: "object",
      properties: {
        participation: { type: "string", enum: ["all", "assigned_to_me", "conducted_by_me"] },
        date_from: { type: "string" },
        date_to: { type: "string" },
      },
    },
  },
  {
    name: "get_recurring_issues",
    description: "Recurring findings and compliance issues in authorized scope.",
    parameters: { type: "object", properties: { limit: { type: "number" } } },
  },
  {
    name: "get_audit_evidence_images",
    description: "Audit evidence images. intent=analysis sends pixels to Luna; intent=gallery fills UI only.",
    parameters: {
      type: "object",
      properties: {
        store_query: { type: "string" },
        store_id: { type: "string" },
        scan_id: { type: "string" },
        audit_type: { type: "string", enum: ["stacking", "shelf", "expiry", "all"] },
        intent: { type: "string", enum: ["analysis", "gallery"] },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "get_evidence_coverage",
    description: "Evidence coverage KPI.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_sla_metrics",
    description: "SLA buckets for corrective actions.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_inventory_accuracy",
    description: "Inventory accuracy metric.",
    parameters: { type: "object", properties: {} },
  },
];

export const RESPONSE_TOOLS: FunctionTool[] = TOOL_SPECS.map((tool) => ({
  type: "function",
  name: tool.name,
  description: tool.description,
  parameters: tool.parameters,
  strict: false,
}));

async function getKpi(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const kpiId = String(args.kpi_id ?? "");
  if (UNWIRED_UNIVERSAL_KPI_IDS.has(kpiId)) {
    return { available: false, reason: NOT_WIRED };
  }
  const data = await fetchScopedControlTowerDataset({
    supabase: ctx.supabase,
    scope: ctx.scope,
    filters: ctx.filters,
  });
  const kpi = data.universalKpis.find((k) => k.id === kpiId);
  if (!kpi) return { available: false, reason: "KPI not found" };
  return {
    available: kpi.available,
    data: { id: kpi.id, label: kpi.label, value: kpi.value, detail: kpi.detail },
  };
}

async function getAuditSummary(ctx: ToolContext): Promise<ToolResult> {
  const data = await fetchScopedControlTowerDataset({
    supabase: ctx.supabase,
    scope: ctx.scope,
    filters: ctx.filters,
  });
  const active = data.auditExecutionFull.filter((a) => a.status !== "Cancelled");
  const completed = active.filter((a) => a.status === "Completed" || a.status === "Approved").length;
  return {
    available: true,
    data: {
      total: active.length,
      completed,
      in_progress: active.filter((a) => a.status === "In Progress").length,
      pending: active.filter((a) => a.status === "Pending").length,
      completion_pct: completionPct(completed, active.length),
    },
  };
}

async function getOverdueAudits(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const limit = Math.min(Number(args.limit ?? 10), 20);
  const now = Date.now();
  const data = await fetchScopedControlTowerDataset({
    supabase: ctx.supabase,
    scope: ctx.scope,
    filters: ctx.filters,
  });
  const overdue = data.auditExecutionFull.filter((a) => {
    const due = new Date(a.dueDate).getTime();
    return Number.isFinite(due) && due < now && a.stage !== "Completed";
  });
  const items = overdue.slice(0, limit).map((a) => ({
    assignment_id: a.auditId,
    store: a.location,
    status: a.status,
    due_date: a.dueDate,
    assignee: a.assignedTo,
  }));
  return { available: true, data: { count: overdue.length, items } };
}

async function getInventoryVariance(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const limit = Math.min(Number(args.limit ?? 10), 20);
  const storeQuery = String(args.store_query ?? "").trim();

  const filters = clampFiltersToScope(ctx.filters, ctx.scope);
  let storeIds = storeIdsForQuery(ctx.scope, filters);

  if (storeQuery) {
    const { data: stores } = await ctx.supabase
      .from("stores")
      .select("id, name, city, country")
      .eq("org_id", ctx.scope.orgId)
      .eq("status", "active");
    const match = resolveStoreQuery(ctx.scope, (stores ?? []) as { id: string; name: string; city: string | null; country: string | null }[], storeQuery);
    if (!match) return { available: false, reason: ACCESS_DENIED_MESSAGE };
    storeIds = [match.id];
  }
  if (!storeIds.length) return { available: true, data: { stores: [], lines_counted: 0 } };

  const bounds = resolveDashboardDateBounds(filters);
  let query = ctx.supabase
    .from("digital_audit_lines")
    .select("store_id, variance_qty, variance_value_inr, expected_qty, actual_qty, stores:store_id (name)")
    .eq("org_id", ctx.scope.orgId)
    .in("store_id", storeIds)
    .limit(5000);
  if (bounds.from) query = query.gte("created_at", bounds.from.toISOString());
  if (bounds.to) query = query.lt("created_at", bounds.to.toISOString());
  const { data: lines, error } = await query;
  if (error) return { available: false, reason: "Inventory variance could not be loaded." };

  const byStore = new Map<
    string,
    { store: string; expected_units: number; counted_units: number; net_variance_units: number; variance_value_inr: number | null; skus_with_variance: number }
  >();
  for (const line of lines ?? []) {
    const storeId = line.store_id as string;
    const name = (line.stores as { name?: string } | null)?.name ?? "Store";
    const row = byStore.get(storeId) ?? {
      store: name,
      expected_units: 0,
      counted_units: 0,
      net_variance_units: 0,
      variance_value_inr: null,
      skus_with_variance: 0,
    };
    const varianceQty = Number(line.variance_qty) || 0;
    row.expected_units += Number(line.expected_qty) || 0;
    row.counted_units += Number(line.actual_qty) || 0;
    row.net_variance_units += varianceQty;
    if (line.variance_value_inr != null) {
      row.variance_value_inr = (row.variance_value_inr ?? 0) + Number(line.variance_value_inr);
    }
    if (varianceQty !== 0) row.skus_with_variance += 1;
    byStore.set(storeId, row);
  }

  const ranked = [...byStore.values()]
    .sort((a, b) => Math.abs(b.net_variance_units) - Math.abs(a.net_variance_units))
    .slice(0, limit);

  return {
    available: true,
    data: {
      stores: ranked,
      lines_counted: lines?.length ?? 0,
      value_note: "variance_value_inr is null when no price list is loaded; report it as N/A, not ₹0.",
    },
  };
}

async function getFindings(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const limit = Math.min(Number(args.limit ?? 10), 20);
  const severity = String(args.severity ?? "").toLowerCase();
  const data = await fetchScopedControlTowerDataset({
    supabase: ctx.supabase,
    scope: ctx.scope,
    filters: ctx.filters,
  });

  let rows = data.criticalFindingsFull;
  if (severity && severity !== "all") {
    rows = rows.filter((r) => r.severity.toLowerCase().includes(severity));
  }

  const openKpi = data.universalKpis.find((k) => k.id === "open_findings");
  const criticalKpi = data.universalKpis.find((k) => k.id === "critical_findings");

  return {
    available: true,
    data: {
      open_count: openKpi?.available ? Number(openKpi.value) || 0 : 0,
      critical_count: criticalKpi?.available ? Number(criticalKpi.value) || 0 : 0,
      top: rows.slice(0, limit),
    },
  };
}

async function getCorrectiveActions(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const limit = Math.min(Number(args.limit ?? 10), 20);
  const data = await fetchScopedControlTowerDataset({
    supabase: ctx.supabase,
    scope: ctx.scope,
    filters: ctx.filters,
  });
  const open = data.correctiveActionsFull.filter(
    (a) => !["closed", "verified", "resolved", "rejected"].includes(a.status.toLowerCase()),
  );

  return {
    available: true,
    data: {
      open_count: data.correctiveActionHealth.open,
      overdue_count: data.correctiveActionHealth.overdue,
      buckets: data.correctiveActionHealth,
      items: open.slice(0, limit),
    },
  };
}

async function getAuditTrends(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const data = await fetchScopedControlTowerDataset({
    supabase: ctx.supabase,
    scope: ctx.scope,
    filters: ctx.filters,
  });
  const compare = Boolean(args.compare_previous_period);
  return {
    available: true,
    data: {
      trend: data.auditTrend,
      operational_trend: data.operationalTrend,
      compare_previous_period: compare,
      completion_kpi: data.universalKpis.find((k) => k.id === "audit_completion"),
    },
  };
}

async function getStorePerformance(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const limit = Math.min(Number(args.limit ?? 10), 20);
  const data = await fetchScopedControlTowerDataset({
    supabase: ctx.supabase,
    scope: ctx.scope,
    filters: ctx.filters,
  });
  return {
    available: true,
    data: {
      at_risk: data.riskLocationsFull.slice(0, limit),
      recurring: data.recurringIssues.slice(0, limit),
    },
  };
}

async function getExpiryRisk(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const limit = Math.min(Number(args.limit ?? 10), 20);
  const storeIds = storeIdsForQuery(ctx.scope, clampFiltersToScope(ctx.filters, ctx.scope));
  if (!storeIds.length) return { available: true, data: { count: 0, items: [] } };

  const { data: rows, error } = await ctx.supabase
    .from("findings")
    .select("id, title, severity, store_id, sku, product_name, created_at, stores:store_id (name)")
    .eq("org_id", ctx.scope.orgId)
    .in("finding_type", ["expired_product", "near_expiry"])
    .neq("status", "closed")
    .in("store_id", storeIds)
    .limit(limit);

  if (error?.code === "42P01") return { available: false, reason: NOT_WIRED };
  return {
    available: true,
    data: {
      count: rows?.length ?? 0,
      items: (rows ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        severity: r.severity,
        store: (r as { stores?: { name?: string } }).stores?.name ?? "Store",
        sku: r.sku,
      })),
    },
  };
}

async function getAuditEvidenceImages(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const limit = Math.min(Number(args.limit ?? 20), 20);
  const auditType = String(args.audit_type ?? "all");
  const storeQuery = String(args.store_query ?? "").trim();
  let storeId = String(args.store_id ?? "").trim();

  const { data: stores } = await ctx.supabase
    .from("stores")
    .select("id, name, city, country")
    .eq("org_id", ctx.scope.orgId)
    .eq("status", "active");

  const storeList = (stores ?? []) as { id: string; name: string; city: string | null; country: string | null }[];

  if (storeQuery && !storeId) {
    const match = resolveStoreQuery(ctx.scope, storeList, storeQuery);
    if (!match) return { available: false, reason: ACCESS_DENIED_MESSAGE };
    storeId = match.id;
  }

  const storeIds = storeId ? [storeId] : storeIdsForQuery(ctx.scope, ctx.filters);
  if (!storeIds.length || (storeId && !ctx.scope.allowedStoreIds.includes(storeId))) {
    return { available: false, reason: ACCESS_DENIED_MESSAGE };
  }

  let assignmentQuery = ctx.supabase
    .from("scan_assignments")
    .select("id, scan_id, store_id, template_id, created_at, audit_templates:template_id (name, audit_purpose)")
    .eq("org_id", ctx.scope.orgId)
    .in("store_id", storeIds)
    .not("scan_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!ctx.scope.isOrgAdmin) {
    assignmentQuery = assignmentQuery.in("id", ctx.scope.accessibleAssignmentIds);
  }

  const { data: assignments } = await assignmentQuery;
  const filtered = (assignments ?? []).filter((a) => {
    if (auditType === "all") return true;
    const tpl = (a as { audit_templates?: { name?: string; audit_purpose?: string } }).audit_templates;
    const purpose = tpl?.audit_purpose ?? "";
    const name = (tpl?.name ?? "").toLowerCase();
    if (auditType === "stacking") {
      return purpose === "shelf_stacking_audit" || name.includes("stacking");
    }
    if (auditType === "expiry") return name.includes("expiry") || purpose.includes("expiry");
    return true;
  });

  const scanIds = filtered.map((a) => a.scan_id as string).filter(Boolean);
  if (!scanIds.length) return { available: true, data: { count: 0, images: [] }, pendingImages: [] };

  const [{ data: evidence }, { data: scanImages }] = await Promise.all([
    ctx.supabase.from("audit_evidence").select("id, scan_id, storage_path, captured_at, bin_key").in("scan_id", scanIds).limit(limit),
    ctx.supabase
      .from("scan_images")
      .select("id, scan_id, storage_bucket, storage_path, created_at, kind")
      .in("scan_id", scanIds)
      .eq("kind", "original")
      .limit(limit),
  ]);

  const pendingImages: ImageGalleryItem[] = [];
  const storeNameById = new Map(storeList.map((s) => [s.id, s.name]));

  // Prefer real shelf photos (scan_images) before placeholder audit_evidence rows.
  for (const row of scanImages ?? []) {
    const assignment = filtered.find((a) => a.scan_id === row.scan_id);
    pendingImages.push({
      evidenceId: row.id as string,
      scanId: row.scan_id as string,
      assignmentId: assignment?.id as string | undefined,
      storageBucket: (row.storage_bucket as string) || "scan-images",
      storagePath: row.storage_path as string,
      caption: "Shelf image",
      capturedAt: row.created_at as string,
      storeName: assignment?.store_id ? storeNameById.get(assignment.store_id as string) : undefined,
    });
  }

  for (const row of evidence ?? []) {
    const assignment = filtered.find((a) => a.scan_id === row.scan_id);
    pendingImages.push({
      evidenceId: row.id as string,
      scanId: row.scan_id as string,
      assignmentId: assignment?.id as string | undefined,
      storageBucket: "scan-images",
      storagePath: row.storage_path as string,
      caption: `Evidence · ${row.bin_key ?? "audit"}`,
      capturedAt: row.captured_at as string,
      storeName: assignment?.store_id ? storeNameById.get(assignment.store_id as string) : undefined,
    });
  }

  const trimmed = pendingImages.slice(0, limit);

  return {
    available: true,
    data: {
      count: trimmed.length,
      total_available: pendingImages.length,
      store_id: storeId || storeIds[0],
      audit_type: auditType,
      images: trimmed.map((img) => ({
        evidence_id: img.evidenceId,
        scan_id: img.scanId,
        caption: img.caption,
        captured_at: img.capturedAt,
        store_name: img.storeName,
      })),
    },
    pendingImages: trimmed,
  };
}

const EXECUTORS: Record<string, ToolExecutor> = {
  get_kpi: getKpi,
  get_audit_summary: getAuditSummary,
  get_overdue_audits: getOverdueAudits,
  get_inventory_variance: getInventoryVariance,
  get_findings: getFindings,
  get_corrective_actions: getCorrectiveActions,
  get_audit_trends: getAuditTrends,
  get_store_performance: getStorePerformance,
  get_expiry_risk: getExpiryRisk,
  get_my_audits: getMyAudits,
  get_audit_details: getAuditDetails,
  get_scan_analysis: getScanAnalysis,
  get_detected_products: getDetectedProducts,
  get_audit_responses: getAuditResponses,
  get_digital_audit_lines: getDigitalAuditLines,
  get_planogram_compliance: getPlanogramCompliance,
  get_audit_reports: getAuditReports,
  get_audits_aggregate: getAuditsAggregate,
  get_audit_evidence_images: (ctx, args) => getAuditEvidenceImagesExtended(ctx, args, getAuditEvidenceImages),
  get_evidence_coverage: async () => ({ available: false, reason: NOT_WIRED }),
  get_sla_metrics: async (ctx) => {
    const data = await fetchScopedControlTowerDataset({
      supabase: ctx.supabase,
      scope: ctx.scope,
      filters: ctx.filters,
    });
    return {
      available: false,
      reason: NOT_WIRED,
      data: { buckets: data.correctiveActionHealth },
    };
  },
  get_inventory_accuracy: async () => ({ available: false, reason: "No live inventory accuracy source" }),
  get_shelf_compliance: async () => ({ available: false, reason: NOT_WIRED }),
  get_sku_history: async () => ({ available: false, reason: NOT_WIRED }),
  get_recurring_issues: async (ctx, args) => {
    const limit = Math.min(Number(args.limit ?? 10), 20);
    const data = await fetchScopedControlTowerDataset({
      supabase: ctx.supabase,
      scope: ctx.scope,
      filters: ctx.filters,
    });
    return { available: true, data: { items: data.recurringIssuesFull.slice(0, limit) } };
  },
};

export async function executeTool(
  name: string,
  ctx: ToolContext,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const fn = EXECUTORS[name];
  if (!fn) return { available: false, reason: `Unknown tool: ${name}` };
  return fn(ctx, args);
}

/** Strip server-side image payloads before sending tool output to OpenAI. */
export function compactToolResultForModel(result: ToolResult): Record<string, unknown> {
  const { pendingImages: _pending, visionImages: _vision, ...rest } = result;
  void _pending;
  void _vision;
  return rest as Record<string, unknown>;
}
