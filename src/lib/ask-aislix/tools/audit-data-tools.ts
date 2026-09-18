import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { DashboardFilterState } from "@/lib/dashboard-filters";
import type { AskAislixAccessScope } from "@/lib/ask-aislix/ask-aislix.types";
import { resolveDashboardDateBounds } from "@/lib/dashboard-filters";
import type { ImageGalleryItem, ToolResult } from "@/lib/ask-aislix/ask-aislix.types";
import { clampFiltersToScope, storeIdsForQuery } from "@/lib/ask-aislix/context";
import { fetchScopedControlTowerDataset } from "@/lib/ask-aislix/dataset";
import { completionPct } from "@/lib/kpi-engine/compute-universal";

import { fetchAuditReportsForScans } from "./audit-reports";
import {
  assertAssignmentAuthorized,
  assertScanAuthorized,
  resolveAuthorizedAssignments,
  resolveAuthorizedScanIds,
  unauthorizedResult,
  type AuditParticipation,
} from "./audit-retrieval";
import {
  downloadVisionAssets,
  selectImagesForMode,
  type ImageSelectionMode,
} from "./audit-vision";
export type AuditToolContext = {
  supabase: SupabaseClient<Database>;
  scope: AskAislixAccessScope;
  filters: DashboardFilterState;
};

function pickString(args: Record<string, unknown>, key: string): string {
  return String(args[key] ?? "").trim();
}

function pickLimit(args: Record<string, unknown>, fallback = 20, max = 50): number {
  return Math.min(Math.max(Number(args.limit ?? fallback), 1), max);
}

function participationFromArgs(args: Record<string, unknown>): AuditParticipation {
  const value = pickString(args, "participation");
  if (value === "assigned_to_me" || value === "conducted_by_me") return value;
  return "all";
}

export async function getMyAudits(ctx: AuditToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const participation = participationFromArgs(args);
  const limit = pickLimit(args, 20, 50);
  const { assignments } = await resolveAuthorizedAssignments(ctx.supabase, ctx.scope, ctx.filters, {
    participation,
    store_query: pickString(args, "store_query"),
    store_id: pickString(args, "store_id"),
    limit,
    include_completed_only: Boolean(args.include_completed_only),
  });

  return {
    available: true,
    data: {
      participation,
      count: assignments.length,
      items: assignments.map((a) => ({
        assignment_id: a.id,
        scan_id: a.scan_id,
        store: a.stores?.name ?? "Store",
        city: a.stores?.city,
        status: a.status,
        approval_status: a.approval_status,
        assignee_id: a.assignee_id,
        due_at: a.due_at,
        completed_at: a.completed_at,
        template: a.audit_templates?.name,
        audit_purpose: a.audit_templates?.audit_purpose,
        operating_model: a.audit_templates?.operating_model,
        conducted_by_user: a.scan_id ? ctx.scope.conductedScanIds.includes(a.scan_id) : false,
        assigned_to_user: a.assignee_id === ctx.scope.userId,
      })),
    },
  };
}

export async function getAuditDetails(ctx: AuditToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const assignmentId = pickString(args, "assignment_id");
  const scanId = pickString(args, "scan_id");
  if (!assignmentId && !scanId) {
    return { available: false, reason: "Provide assignment_id or scan_id." };
  }

  const { assignments } = await resolveAuthorizedAssignments(ctx.supabase, ctx.scope, ctx.filters, {
    assignment_id: assignmentId || undefined,
    scan_id: scanId || undefined,
    limit: 1,
  });

  const assignment = assignments[0];
  if (!assignment) return unauthorizedResult();

  const resolvedScanId = assignment.scan_id;
  let scanRow = null;
  if (resolvedScanId) {
    const { data } = await ctx.supabase
      .from("shelf_scans")
      .select(
        "id, status, created_at, finalized_at, created_by, finalized_by, osa_percent, planogram_compliance_percent, shelf_health_score, share_of_shelf_percent, total_products, notes",
      )
      .eq("id", resolvedScanId)
      .maybeSingle();
    scanRow = data;
  }

  return {
    available: true,
    data: {
      assignment: {
        id: assignment.id,
        status: assignment.status,
        approval_status: assignment.approval_status,
        store: assignment.stores?.name,
        city: assignment.stores?.city,
        assignee_id: assignment.assignee_id,
        due_at: assignment.due_at,
        completed_at: assignment.completed_at,
        template: assignment.audit_templates?.name,
        audit_purpose: assignment.audit_templates?.audit_purpose,
      },
      scan: scanRow
        ? {
            id: scanRow.id,
            status: scanRow.status,
            created_at: scanRow.created_at,
            finalized_at: scanRow.finalized_at,
            created_by: scanRow.created_by,
            finalized_by: scanRow.finalized_by,
            osa_percent: scanRow.osa_percent,
            planogram_compliance_percent: scanRow.planogram_compliance_percent,
            shelf_health_score: scanRow.shelf_health_score,
            share_of_shelf_percent: scanRow.share_of_shelf_percent,
            total_products: scanRow.total_products,
            notes: scanRow.notes,
          }
        : null,
    },
  };
}

export async function getScanAnalysis(ctx: AuditToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const scanId = pickString(args, "scan_id");
  if (!scanId || !assertScanAuthorized(ctx.scope, scanId)) return unauthorizedResult();

  const { data, error } = await ctx.supabase
    .from("scan_results")
    .select(
      "scan_id, executive_summary, metrics, brand_share, category_breakdown, alerts, recommendations, shelf_rows, confidence_avg, created_at",
    )
    .eq("scan_id", scanId)
    .maybeSingle();

  if (error) return { available: false, reason: error.message };
  if (!data) return { available: true, data: { scan_id: scanId, has_results: false } };

  return {
    available: true,
    data: {
      scan_id: scanId,
      has_results: true,
      executive_summary: data.executive_summary,
      metrics: data.metrics,
      brand_share: data.brand_share,
      category_breakdown: data.category_breakdown,
      alerts: data.alerts,
      recommendations: data.recommendations,
      shelf_rows: data.shelf_rows,
      confidence_avg: data.confidence_avg,
      created_at: data.created_at,
    },
  };
}

export async function getDetectedProducts(ctx: AuditToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const scanId = pickString(args, "scan_id");
  const limit = pickLimit(args, 30, 100);
  if (!scanId || !assertScanAuthorized(ctx.scope, scanId)) return unauthorizedResult();

  const { data, error } = await ctx.supabase
    .from("detected_products")
    .select(
      "id, name, brand, variant, category, facings, shelf_row, stock_status, confidence, expected_facings, sku",
    )
    .eq("scan_id", scanId)
    .limit(limit);

  if (error) return { available: false, reason: error.message };

  return {
    available: true,
    data: {
      scan_id: scanId,
      count: data?.length ?? 0,
      products: data ?? [],
    },
  };
}

export async function getAuditResponses(ctx: AuditToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const scanId = pickString(args, "scan_id");
  const assignmentId = pickString(args, "assignment_id");
  const limit = pickLimit(args, 50, 200);
  if (!scanId && !assignmentId) {
    return { available: false, reason: "Provide scan_id or assignment_id." };
  }
  if (scanId && !assertScanAuthorized(ctx.scope, scanId)) return unauthorizedResult();
  if (assignmentId && !assertAssignmentAuthorized(ctx.scope, assignmentId)) return unauthorizedResult();

  let query = ctx.supabase
    .from("audit_responses")
    .select("section_key, field_key, record_index, value, created_at, scan_id, assignment_id")
    .limit(limit);

  if (scanId) query = query.eq("scan_id", scanId);
  if (assignmentId) query = query.eq("assignment_id", assignmentId);

  const { data, error } = await query;
  if (error?.code === "42P01") return { available: false, reason: "Audit responses not available." };
  if (error) return { available: false, reason: error.message };

  return {
    available: true,
    data: { count: data?.length ?? 0, responses: data ?? [] },
  };
}

export async function getDigitalAuditLines(ctx: AuditToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const scanId = pickString(args, "scan_id");
  const limit = pickLimit(args, 30, 100);
  if (!scanId || !assertScanAuthorized(ctx.scope, scanId)) return unauthorizedResult();

  const { data, error } = await ctx.supabase
    .from("digital_audit_lines")
    .select(
      "id, product_name, brand, sku, category, bin_key, location, expected_qty, actual_qty, variance_qty, variance_pct, variance_value_inr, rca_code, rca_notes",
    )
    .eq("scan_id", scanId)
    .order("variance_value_inr", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error?.code === "42P01") return { available: false, reason: "Digital audit lines not available." };
  if (error) return { available: false, reason: error.message };

  return {
    available: true,
    data: {
      scan_id: scanId,
      count: data?.length ?? 0,
      lines: data ?? [],
      total_variance_inr: (data ?? []).reduce(
        (sum, row) => sum + (Number(row.variance_value_inr) || 0),
        0,
      ),
    },
  };
}

export async function getPlanogramCompliance(ctx: AuditToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const scanId = pickString(args, "scan_id");
  const assignmentId = pickString(args, "assignment_id");
  if (!scanId && !assignmentId) {
    return { available: false, reason: "Provide scan_id or assignment_id." };
  }
  if (scanId && !assertScanAuthorized(ctx.scope, scanId)) return unauthorizedResult();

  let query = ctx.supabase
    .from("planogram_comparisons")
    .select("id, scan_id, assignment_id, compliance_percent, summary, created_at")
    .eq("org_id", ctx.scope.orgId)
    .limit(1);

  if (scanId) query = query.eq("scan_id", scanId);
  if (assignmentId) query = query.eq("assignment_id", assignmentId);

  const { data, error } = await query.maybeSingle();
  if (error?.code === "42P01") return { available: false, reason: "Planogram comparison not available." };
  if (error) return { available: false, reason: error.message };
  if (!data) {
    if (scanId) {
      const { data: scan } = await ctx.supabase
        .from("shelf_scans")
        .select("planogram_compliance_percent")
        .eq("id", scanId)
        .maybeSingle();
      if (scan?.planogram_compliance_percent != null) {
        return {
          available: true,
          data: {
            scan_id: scanId,
            compliance_percent: scan.planogram_compliance_percent,
            source: "shelf_scans",
          },
        };
      }
    }
    return { available: true, data: { has_planogram: false } };
  }

  return {
    available: true,
    data: {
      has_planogram: true,
      compliance_percent: data.compliance_percent,
      summary: data.summary,
      scan_id: data.scan_id,
      assignment_id: data.assignment_id,
      created_at: data.created_at,
    },
  };
}

export async function getAuditReports(ctx: AuditToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const scanId = pickString(args, "scan_id");
  const assignmentId = pickString(args, "assignment_id");
  const limit = pickLimit(args, 10, 20);

  let scanIds: string[] = [];
  if (scanId) {
    if (!assertScanAuthorized(ctx.scope, scanId)) return unauthorizedResult();
    scanIds = [scanId];
  } else if (assignmentId) {
    const { assignments } = await resolveAuthorizedAssignments(ctx.supabase, ctx.scope, ctx.filters, {
      assignment_id: assignmentId,
      limit: 1,
    });
    const sid = assignments[0]?.scan_id;
    if (!sid) return { available: true, data: { count: 0, reports: [] } };
    scanIds = [sid];
  } else {
    scanIds = await resolveAuthorizedScanIds(ctx.supabase, ctx.scope, ctx.filters, {
      participation: participationFromArgs(args),
      limit: limit,
      include_completed_only: true,
    });
  }

  const reports = (await fetchAuditReportsForScans(ctx.supabase, scanIds)).slice(0, limit);
  return {
    available: true,
    data: {
      scan_ids: scanIds,
      count: reports.length,
      reports: reports.map((r) => ({
        source: r.source,
        scan_id: r.scan_id,
        kind: r.kind,
        label: r.label,
        summary_text: r.summary_text,
        text_excerpt: r.text_excerpt,
        created_at: r.created_at,
        has_file: Boolean(r.storage_path),
      })),
    },
  };
}

export async function getAuditsAggregate(ctx: AuditToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const participation = participationFromArgs(args);
  const clamped = clampFiltersToScope(ctx.filters, ctx.scope);
  const bounds = resolveDashboardDateBounds(clamped);
  const dateFrom = pickString(args, "date_from") || bounds.from;
  const dateTo = pickString(args, "date_to") || bounds.to;

  const { assignments } = await resolveAuthorizedAssignments(ctx.supabase, ctx.scope, ctx.filters, {
    participation,
    date_from: dateFrom,
    date_to: dateTo,
    limit: 200,
  });

  const scanIds = [...new Set(assignments.map((a) => a.scan_id).filter(Boolean))] as string[];
  const completed = assignments.filter((a) =>
    ["Completed", "Approved", "Submitted"].includes(a.status),
  ).length;

  const statusCounts: Record<string, number> = {};
  for (const a of assignments) {
    statusCounts[a.status] = (statusCounts[a.status] ?? 0) + 1;
  }

  const storeCounts = new Map<string, { store: string; count: number }>();
  for (const a of assignments) {
    const name = a.stores?.name ?? "Unknown";
    const existing = storeCounts.get(a.store_id) ?? { store: name, count: 0 };
    existing.count += 1;
    storeCounts.set(a.store_id, existing);
  }

  let findingsCount = 0;
  let openActions = 0;
  if (scanIds.length) {
    const storeIds = storeIdsForQuery(ctx.scope, clamped);
    if (storeIds.length) {
      const [{ count: findings }, { count: actions }] = await Promise.all([
        ctx.supabase
          .from("findings")
          .select("id", { count: "exact", head: true })
          .eq("org_id", ctx.scope.orgId)
          .in("store_id", storeIds)
          .gte("created_at", dateFrom)
          .lte("created_at", `${dateTo}T23:59:59.999Z`),
        ctx.supabase
          .from("corrective_actions")
          .select("id", { count: "exact", head: true })
          .eq("org_id", ctx.scope.orgId)
          .neq("status", "Closed")
          .gte("created_at", dateFrom)
          .lte("created_at", `${dateTo}T23:59:59.999Z`),
      ]);
      findingsCount = findings ?? 0;
      openActions = actions ?? 0;
    }
  }

  const data = await fetchScopedControlTowerDataset({
    supabase: ctx.supabase,
    scope: ctx.scope,
    filters: clamped,
  });

  return {
    available: true,
    data: {
      period: { from: dateFrom, to: dateTo },
      participation,
      audit_count: assignments.length,
      completed_count: completed,
      completion_pct: completionPct(completed, assignments.length),
      status_breakdown: statusCounts,
      top_stores: [...storeCounts.values()].sort((a, b) => b.count - a.count).slice(0, 10),
      scans_with_results: scanIds.length,
      open_findings_in_period: findingsCount,
      open_actions_in_period: openActions,
      recurring_issues: data.recurringIssuesFull.slice(0, 5),
      risk_locations: data.riskLocationsFull.slice(0, 5),
    },
  };
}

/** Evidence images with analysis vs gallery intent. */
export async function getAuditEvidenceImagesExtended(
  ctx: AuditToolContext,
  args: Record<string, unknown>,
  baseFetcher: (ctx: AuditToolContext, args: Record<string, unknown>) => Promise<ToolResult>,
): Promise<ToolResult> {
  const intent = (pickString(args, "intent") || "gallery") as ImageSelectionMode;
  const result = await baseFetcher(ctx, { ...args, limit: intent === "gallery" ? 20 : 6 });
  if (!result.available || !result.pendingImages?.length) return result;

  const selected = selectImagesForMode(result.pendingImages, intent, intent === "gallery" ? 20 : 6);

  if (intent === "analysis") {
    const visionImages = await downloadVisionAssets(ctx.supabase, selected);
    return {
      ...result,
      data: {
        ...(result.data as Record<string, unknown>),
        intent,
        vision_image_count: visionImages.length,
        images: selected.map((img) => ({
          evidence_id: img.evidenceId,
          scan_id: img.scanId,
          caption: img.caption,
          captured_at: img.capturedAt,
          store_name: img.storeName,
        })),
      },
      pendingImages: [],
      visionImages,
    };
  }

  return {
    ...result,
    data: {
      ...(result.data as Record<string, unknown>),
      intent,
    },
    pendingImages: selected,
  };
}
