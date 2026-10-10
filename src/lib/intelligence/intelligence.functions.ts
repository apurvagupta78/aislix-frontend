/**
 * Intelligence: the user picks up to 20 completed audits and asks a question. The server reads
 * those audits under the user's own access, sends the instructions, the question and a compact
 * copy of the audit data to the AI, and saves the report for "Past analyses".
 */

import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hideModelNames } from "@/lib/ai-display-text";
import { INTELLIGENCE_INSTRUCTIONS, buildIntelligenceInput } from "@/lib/intelligence/intelligence.prompt";

export const INTELLIGENCE_MAX_AUDITS = 20;
export const INTELLIGENCE_MAX_QUESTION = 1000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type IntelligenceInput = { activeOrgId: string; scanIds: string[]; question: string };

export type IntelligenceAuditRef = {
  id: string;
  label: string;
  mode: "ai" | "digital";
  date: string;
};

export type IntelligenceReport = {
  id: string;
  question: string;
  report: string;
  audits: IntelligenceAuditRef[];
  created_at: string;
};

function validate(input: IntelligenceInput): IntelligenceInput {
  const activeOrgId = String(input?.activeOrgId ?? "");
  if (!UUID_RE.test(activeOrgId)) throw new Error("Missing workspace.");
  const ids = Array.isArray(input?.scanIds) ? input.scanIds.map((s) => String(s)) : [];
  const scanIds = [...new Set(ids)].filter((id) => UUID_RE.test(id));
  if (!scanIds.length) throw new Error("Select at least one audit.");
  if (scanIds.length > INTELLIGENCE_MAX_AUDITS) {
    throw new Error(`Select up to ${INTELLIGENCE_MAX_AUDITS} audits.`);
  }
  const question = String(input?.question ?? "").trim().slice(0, INTELLIGENCE_MAX_QUESTION);
  if (question.length < 5) throw new Error("Write what you would like to analyse.");
  return { activeOrgId, scanIds, question };
}

function lunaModel(): string {
  return (
    (process.env.OPENAI_LUNA_MODEL ?? "").trim() ||
    (process.env.OPENAI_DOC_MODEL ?? "").trim() ||
    (process.env.OPENAI_MODEL ?? "").trim() ||
    "gpt-5.6-luna"
  );
}

type Row = Record<string, unknown>;

function compact<T extends Row>(row: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === null || v === undefined || v === "") continue;
    if (Array.isArray(v) && !v.length) continue;
    (out as Row)[k] = v;
  }
  return out;
}

function pick(source: unknown, keys: string[]): Row {
  const src = source && typeof source === "object" ? (source as Row) : {};
  const out: Row = {};
  for (const k of keys) {
    const v = src[k];
    if (v === null || v === undefined || v === "") continue;
    if (typeof v === "object") continue;
    out[k] = v;
  }
  return out;
}

function list(value: unknown, max: number): unknown[] {
  return Array.isArray(value) ? value.slice(0, max) : [];
}

function groupBy<T extends Row>(rows: T[], key: string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = String(row[key] ?? "");
    const bucket = map.get(k);
    if (bucket) bucket.push(row);
    else map.set(k, [row]);
  }
  return map;
}

const AI_METRIC_KEYS = [
  "analysis_mode",
  "osa_percent",
  "availability_percent",
  "shelf_health_score",
  "shelf_execution_score",
  "share_of_shelf_percent",
  "total_products",
  "total_facings",
  "unique_brands",
  "unique_skus",
  "confirmed_oos_count",
  "possible_oos_count",
  "out_of_stock_products",
  "low_stock_products",
  "misplaced_products",
  "shelf_gap_count",
  "placement_issue_count",
  "placement_compliance_percent",
  "facing_compliance_percent",
  "recognition_coverage_percent",
  "average_confidence",
];

const FINANCIAL_KEYS = [
  "estimate_status",
  "confidence",
  "oos_sku_count",
  "at_risk_sku_count",
  "visible_inventory_value_inr",
  "expected_inventory_value_inr",
  "potential_value_gap_inr",
  "estimated_daily_lost_sales_inr",
  "estimated_weekly_lost_sales_inr",
];

async function gatherAudits(
  supabase: SupabaseClient,
  orgId: string,
  scanIds: string[],
): Promise<{ refs: IntelligenceAuditRef[]; data: Row[] }> {
  const { data: scanRows, error } = await supabase
    .from("shelf_scans")
    .select(
      "id, org_id, store_id, status, audit_mode, created_at, category, sub_category, sub_category_label, sub_category_custom, shelf_label, osa_percent, planogram_compliance_percent, shelf_health_score, share_of_shelf_percent, total_products, out_of_stock_count, low_stock_count, misplaced_count",
    )
    .in("id", scanIds);
  if (error) throw new Error("Could not load the selected audits.");
  const scans = ((scanRows ?? []) as Row[]).filter(
    (s) => s.org_id === orgId && String(s.status) === "completed",
  );
  if (scans.length !== scanIds.length) {
    throw new Error("Some selected audits are not completed or not in your access. Refresh and select again.");
  }

  const storeIds = [...new Set(scans.map((s) => s.store_id).filter(Boolean) as string[])];
  const aiIds = scans.filter((s) => s.audit_mode !== "digital").map((s) => s.id as string);
  const digitalIds = scans.filter((s) => s.audit_mode === "digital").map((s) => s.id as string);
  const perAudit = Math.max(40, Math.floor(1200 / scans.length));

  const [storesRes, resultsRes, productsRes, linesRes, planoRes, findingsRes] = await Promise.all([
    storeIds.length
      ? supabase.from("stores").select("id, name, city, state, store_type").in("id", storeIds)
      : Promise.resolve({ data: [] }),
    aiIds.length
      ? supabase.from("scan_results").select("scan_id, metrics, alerts, brand_share, category_breakdown").in("scan_id", aiIds)
      : Promise.resolve({ data: [] }),
    aiIds.length
      ? supabase
          .from("detected_products")
          .select("scan_id, name, brand, variant, category, facings, expected_facings, shelf_row, stock_status, confidence, price_inr")
          .in("scan_id", aiIds)
          .limit(5000)
      : Promise.resolve({ data: [] }),
    digitalIds.length
      ? supabase
          .from("digital_audit_lines")
          .select(
            "scan_id, product_name, brand, sku, category, sub_category, location, expected_qty, system_qty, actual_qty, variance_qty, variance_pct, variance_value_inr, mrp_inr, rca_code, qc_disposition",
          )
          .in("scan_id", digitalIds)
          .limit(8000)
      : Promise.resolve({ data: [] }),
    supabase.from("planogram_comparisons").select("scan_id, compliance_percent, summary").in("scan_id", scanIds),
    supabase
      .from("findings")
      .select(
        "scan_id, finding_type, severity, status, title, product_name, sku, expected_value, actual_value, variance_units, variance_value_inr, rca_code",
      )
      .in("scan_id", scanIds)
      .limit(3000),
  ]);

  const stores = new Map(((storesRes.data ?? []) as Row[]).map((s) => [String(s.id), s]));
  const results = new Map(((resultsRes.data ?? []) as Row[]).map((r) => [String(r.scan_id), r]));
  const products = groupBy((productsRes.data ?? []) as Row[], "scan_id");
  const lines = groupBy((linesRes.data ?? []) as Row[], "scan_id");
  const plano = new Map(((planoRes.data ?? []) as Row[]).map((p) => [String(p.scan_id), p]));
  const findings = groupBy((findingsRes.data ?? []) as Row[], "scan_id");

  const ordered = scanIds.map((id) => scans.find((s) => s.id === id)!).filter(Boolean);
  const refs: IntelligenceAuditRef[] = [];
  const data: Row[] = [];

  ordered.forEach((scan, i) => {
    const id = String(scan.id);
    const store = stores.get(String(scan.store_id ?? ""));
    const mode: "ai" | "digital" = scan.audit_mode === "digital" ? "digital" : "ai";
    const date = String(scan.created_at ?? "").slice(0, 10);
    const subCategory = scan.sub_category_label ?? scan.sub_category_custom ?? scan.sub_category;
    const storeName = String(store?.name ?? "Store");
    refs.push({
      id,
      mode,
      date,
      label: [storeName, scan.category, scan.shelf_label].filter(Boolean).join(" · "),
    });

    const audit: Row = {
      audit_number: i + 1,
      audit_type: mode === "digital" ? "Digital audit" : "AI audit",
      audit_date: date,
      store: compact({ name: storeName, city: store?.city, state: store?.state, type: store?.store_type }),
      category: scan.category,
      sub_category: subCategory,
      shelf: scan.shelf_label,
    };

    if (mode === "ai") {
      const result = results.get(id);
      const metrics = (result?.metrics ?? {}) as Row;
      audit.metrics = compact({
        ...pick(scan, [
          "osa_percent",
          "planogram_compliance_percent",
          "shelf_health_score",
          "share_of_shelf_percent",
          "total_products",
          "out_of_stock_count",
          "low_stock_count",
          "misplaced_count",
        ]),
        ...pick(metrics, AI_METRIC_KEYS),
      });
      const financial = pick(metrics.financial_impact, FINANCIAL_KEYS);
      if (Object.keys(financial).length) audit.financial_impact = financial;
      const shelf = (metrics.aislix_shelf_analysis ?? {}) as Row;
      const shelfProducts = list(shelf.products, perAudit) as Row[];
      audit.products = shelfProducts.length
        ? shelfProducts.map((p) =>
            compact(
              pick(p, [
                "brand",
                "product",
                "variant",
                "category",
                "actual_facings",
                "actual_visible_units",
                "expected_facings",
                "visible_price",
                "promotion_type",
                "confidence",
              ]),
            ),
          )
        : (products.get(id) ?? []).slice(0, perAudit).map((p) => {
            const { scan_id: _scan, ...rest } = p;
            return compact(rest);
          });
      audit.brand_share = list(result?.brand_share, 15);
      audit.category_breakdown = list(result?.category_breakdown, 15);
      audit.alerts = list(result?.alerts, 10).map((a) => pick(a, ["title", "detail", "severity"]));
      const luna = metrics.luna_analysis as Row | undefined;
      if (typeof luna?.answer === "string" && luna.answer.trim()) {
        audit.earlier_ai_summary = luna.answer.trim().slice(0, 1200);
      }
    } else {
      audit.metrics = compact(pick(scan, ["osa_percent", "planogram_compliance_percent", "total_products"]));
      const auditLines = lines.get(id) ?? [];
      audit.line_count = auditLines.length;
      audit.lines = auditLines.slice(0, perAudit).map((l) => {
        const { scan_id: _scan, ...rest } = l;
        return compact(rest);
      });
    }

    const p = plano.get(id);
    if (p) {
      audit.planogram = compact({
        compliance_percent: p.compliance_percent,
        summary: pick(p.summary, [
          "expected_products",
          "products_found",
          "correct_products",
          "missing_products",
          "unexpected_products",
          "wrong_products",
          "wrong_location",
          "wrong_category",
          "quantity_issues",
        ]),
      });
    }

    const auditFindings = findings.get(id) ?? [];
    audit.finding_count = auditFindings.length;
    audit.findings = auditFindings.slice(0, Math.min(perAudit, 60)).map((f) => {
      const { scan_id: _scan, ...rest } = f;
      return compact(rest);
    });

    data.push(compact(audit));
  });

  return { refs, data };
}

export const runIntelligenceAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: IntelligenceInput) => validate(input))
  .handler(async ({ data, context }): Promise<IntelligenceReport> => {
    const { supabase, userId } = context;

    const { data: member } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("org_id", data.activeOrgId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (!member) throw new Error("You are not a member of this workspace.");

    const { withinRateLimits } = await import("@/lib/rate-limit.server");
    if (!(await withinRateLimits([[`intelligence:user:${userId}`, 30, 3600]]))) {
      throw new Error("Too many analyses in the last hour. Try again later.");
    }

    const { refs, data: audits } = await gatherAudits(supabase, data.activeOrgId, data.scanIds);

    const apiKey = (process.env.OPENAI_API_KEY ?? "").trim();
    if (!apiKey) throw new Error("Intelligence is not available right now.");
    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({ apiKey, timeout: 240_000 });
    const response = await client.responses.create({
      model: lunaModel(),
      instructions: INTELLIGENCE_INSTRUCTIONS,
      input: buildIntelligenceInput(data.question, audits),
      max_output_tokens: 16000,
    });
    const report = hideModelNames(String(response.output_text ?? "").trim());
    if (!report) {
      const reason = (response as { incomplete_details?: { reason?: string } | null }).incomplete_details?.reason;
      throw new Error(
        reason === "max_output_tokens"
          ? "The selected audits hold too much data for one analysis. Select fewer audits and try again."
          : "The AI could not write a report this time. Try again.",
      );
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("intelligence_reports" as never)
      .insert({
        org_id: data.activeOrgId,
        created_by: userId,
        scan_ids: refs.map((r) => r.id),
        audits: refs,
        question: data.question,
        report,
      } as never)
      .select("id, created_at")
      .single();
    if (error || !row) throw new Error("The report was written but could not be saved. Try again.");
    const saved = row as { id: string; created_at: string };
    return { id: saved.id, created_at: saved.created_at, question: data.question, report, audits: refs };
  });
