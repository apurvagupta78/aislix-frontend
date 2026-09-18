import type { SupabaseClient } from "@supabase/supabase-js";

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
  countOpenActions,
  countOverdueActions,
  completionPct,
  UNWIRED_UNIVERSAL_KPI_IDS,
} from "@/lib/kpi-engine/compute-universal";

export type ToolContext = {
  supabase: SupabaseClient<Database>;
  scope: AskAislixAccessScope;
  filters: DashboardFilterState;
};

export type ToolExecutor = (ctx: ToolContext, args: Record<string, unknown>) => Promise<ToolResult>;

const NOT_WIRED = "Not wired yet — insufficient source data";

export const TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
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
  },
  {
    type: "function" as const,
    function: {
      name: "get_audit_summary",
      description: "Summary counts of audits/assignments in scope.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_overdue_audits",
      description: "List overdue audit assignments.",
      parameters: {
        type: "object",
        properties: { limit: { type: "number" } },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_inventory_variance",
      description: "Store-level potential inventory value variance ranking.",
      parameters: {
        type: "object",
        properties: { limit: { type: "number" }, store_query: { type: "string" } },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_findings",
      description: "Findings counts and top open findings.",
      parameters: {
        type: "object",
        properties: { severity: { type: "string" }, limit: { type: "number" } },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_corrective_actions",
      description: "Open and overdue corrective actions.",
      parameters: {
        type: "object",
        properties: { status: { type: "string" }, limit: { type: "number" } },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_audit_trends",
      description: "Audit completion and findings trends over time.",
      parameters: {
        type: "object",
        properties: { compare_previous_period: { type: "boolean" } },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_store_performance",
      description: "Top stores by risk/completion in authorized scope.",
      parameters: {
        type: "object",
        properties: { limit: { type: "number" } },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_expiry_risk",
      description: "Expiry-risk findings in scope.",
      parameters: { type: "object", properties: { limit: { type: "number" } } },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_audit_evidence_images",
      description: "Retrieve audit evidence image metadata for authorized stores/audits.",
      parameters: {
        type: "object",
        properties: {
          store_query: { type: "string" },
          store_id: { type: "string" },
          audit_type: { type: "string", enum: ["stacking", "shelf", "expiry", "all"] },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_evidence_coverage",
      description: "Evidence coverage KPI.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_sla_metrics",
      description: "SLA buckets for corrective actions.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_inventory_accuracy",
      description: "Inventory accuracy metric.",
      parameters: { type: "object", properties: {} },
    },
  },
];

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
  const overdue = data.auditExecutionFull
    .filter((a) => {
      if (!a.dueDate) return false;
      const due = new Date(a.dueDate).getTime();
      return due < now && a.status !== "Completed" && a.status !== "Approved";
    })
    .slice(0, limit)
    .map((a) => ({
      assignment_id: a.id,
      store: a.location,
      status: a.status,
      due_date: a.dueDate,
      assignee: a.assignedTo,
    }));
  return { available: true, data: { count: overdue.length, items: overdue } };
}

async function getInventoryVariance(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const limit = Math.min(Number(args.limit ?? 10), 20);
  const storeQuery = String(args.store_query ?? "").trim();

  if (storeQuery) {
    const { data: stores } = await ctx.supabase
      .from("stores")
      .select("id, name, city, country")
      .eq("org_id", ctx.scope.orgId)
      .eq("status", "active");
    const match = resolveStoreQuery(ctx.scope, (stores ?? []) as { id: string; name: string; city: string | null; country: string | null }[], storeQuery);
    if (!match) return { available: false, reason: ACCESS_DENIED_MESSAGE };
  }

  const data = await fetchScopedControlTowerDataset({
    supabase: ctx.supabase,
    scope: ctx.scope,
    filters: ctx.filters,
  });

  const byStore = new Map<string, { store: string; variance_inr: number; findings: number }>();
  for (const row of data.riskLocationsFull) {
    const key = row.location;
    const existing = byStore.get(key) ?? { store: key, variance_inr: 0, findings: 0 };
    existing.variance_inr += row.varianceInr ?? 0;
    existing.findings += 1;
    byStore.set(key, existing);
  }

  const ranked = [...byStore.values()]
    .sort((a, b) => b.variance_inr - a.variance_inr)
    .slice(0, limit);

  return { available: true, data: { stores: ranked } };
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
  const now = Date.now();
  const open = data.correctiveActionsFull.filter((a) => a.status !== "Closed");
  const overdue = countOverdueActions(
    open.map((a) => ({ status: a.status, due_date: a.dueDate ?? null })),
    now,
  );

  return {
    available: true,
    data: {
      open_count: countOpenActions(open.map((a) => ({ status: a.status }))),
      overdue_count: overdue,
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

  for (const row of evidence ?? []) {
    const assignment = filtered.find((a) => a.scan_id === row.scan_id);
    pendingImages.push({
      evidenceId: row.id as string,
      scanId: row.scan_id as string,
      assignmentId: assignment?.id as string | undefined,
      storageBucket: "audit-evidence",
      storagePath: row.storage_path as string,
      caption: `Evidence · ${row.bin_key ?? "audit"}`,
      capturedAt: row.captured_at as string,
      storeName: assignment?.store_id ? storeNameById.get(assignment.store_id as string) : undefined,
    });
  }

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
  get_audit_evidence_images: getAuditEvidenceImages,
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
  get_planogram_compliance: async () => ({ available: false, reason: NOT_WIRED }),
  get_sku_history: async () => ({ available: false, reason: NOT_WIRED }),
  get_recurring_issues: async (ctx) => {
    const data = await fetchScopedControlTowerDataset({
      supabase: ctx.supabase,
      scope: ctx.scope,
      filters: ctx.filters,
    });
    return { available: true, data: { items: data.recurringIssuesFull.slice(0, 10) } };
  },
  get_audit_details: async () => ({ available: false, reason: NOT_WIRED }),
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

/** Strip pendingImages before sending tool output to OpenAI. */
export function compactToolResultForModel(result: ToolResult): Record<string, unknown> {
  const { pendingImages: _pending, ...rest } = result;
  void _pending;
  return rest as Record<string, unknown>;
}
