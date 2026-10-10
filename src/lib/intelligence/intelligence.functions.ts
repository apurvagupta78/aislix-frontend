/**
 * Intelligence: the user picks up to 20 completed audits, may attach files, and asks a question.
 * The server reads those audits under the user's own access, re-checks every attached file, sends
 * the instructions, question, compact audit data and files to the AI, and saves the report for
 * "Past analyses". Charts are drawn by Aislix from stored audit data; the AI only picks them.
 */

import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hideModelNames } from "@/lib/ai-display-text";
import {
  INTELLIGENCE_INSTRUCTIONS,
  buildIntelligenceInput,
  type IntelligenceFileInput,
} from "@/lib/intelligence/intelligence.prompt";
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MAX_FILES,
  INTELLIGENCE_ATTACHMENT_BUCKET,
  type IntelligenceAttachment,
} from "@/lib/intelligence/attachments";
import { assignedAuditName, auditDescription, auditName, auditShortId } from "@/lib/intelligence/audit-label";
import {
  buildIntelligenceCharts,
  extractChartPicks,
  type ChartSourceAudit,
  type IntelligenceChart,
} from "@/lib/intelligence/intelligence-charts";

export const INTELLIGENCE_MAX_AUDITS = 20;
export const INTELLIGENCE_MAX_QUESTION = 1000;
/** PDFs and images travel inline to the AI; keep one request well inside its size limit. */
const MAX_INLINE_FILE_BYTES = 30 * 1024 * 1024;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ATTACHMENT_PATH_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f-]{36}\.(csv|xlsx|pdf|jpg|jpeg|png|webp)$/i;

export type IntelligenceInput = {
  activeOrgId: string;
  scanIds: string[];
  question: string;
  attachments?: Array<{ path: string; name: string }>;
};

export type IntelligenceAuditRef = {
  id: string;
  label: string;
  mode: "ai" | "digital";
  date: string;
  code?: string;
  description?: string | null;
};

export type IntelligenceReport = {
  id: string;
  question: string;
  report: string;
  audits: IntelligenceAuditRef[];
  charts: IntelligenceChart[];
  attachments: IntelligenceAttachment[];
  created_at: string;
};

function validate(input: IntelligenceInput): Required<IntelligenceInput> {
  const activeOrgId = String(input?.activeOrgId ?? "");
  if (!UUID_RE.test(activeOrgId)) throw new Error("Missing workspace.");
  const ids = Array.isArray(input?.scanIds) ? input.scanIds.map((s) => String(s)) : [];
  const scanIds = [...new Set(ids)].filter((id) => UUID_RE.test(id));
  if (scanIds.length > INTELLIGENCE_MAX_AUDITS) {
    throw new Error(`Select up to ${INTELLIGENCE_MAX_AUDITS} audits.`);
  }
  const rawFiles = Array.isArray(input?.attachments) ? input.attachments : [];
  if (rawFiles.length > ATTACHMENT_MAX_FILES) throw new Error(`Attach up to ${ATTACHMENT_MAX_FILES} files.`);
  const attachments = rawFiles.map((f) => {
    const path = String(f?.path ?? "");
    if (!ATTACHMENT_PATH_RE.test(path)) throw new Error("An attached file is not valid. Attach it again.");
    return { path, name: String(f?.name ?? "file").slice(0, 200) };
  });
  if (!scanIds.length && !attachments.length) throw new Error("Select at least one audit or attach a file.");
  const question = String(input?.question ?? "").trim().slice(0, INTELLIGENCE_MAX_QUESTION);
  if (question.length < 5) throw new Error("Write what you would like to analyse.");
  return { activeOrgId, scanIds, question, attachments };
}

async function requireMember(supabase: SupabaseClient, orgId: string, userId: string): Promise<void> {
  const { data: member } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (!member) throw new Error("You are not a member of this workspace.");
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
): Promise<{ refs: IntelligenceAuditRef[]; data: Row[]; charts: IntelligenceChart[] }> {
  if (!scanIds.length) return { refs: [], data: [], charts: [] };
  const { data: scanRows, error } = await supabase
    .from("shelf_scans")
    .select(
      "id, org_id, store_id, status, audit_mode, created_at, category, sub_category, sub_category_label, sub_category_custom, shelf_label, notes, assignment_id, osa_percent, planogram_compliance_percent, shelf_health_score, share_of_shelf_percent, total_products, out_of_stock_count, low_stock_count, misplaced_count",
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
  const assignmentIds = [...new Set(scans.map((s) => s.assignment_id).filter(Boolean) as string[])];

  const [storesRes, resultsRes, productsRes, linesRes, planoRes, findingsRes, assignmentsRes] = await Promise.all([
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
    assignmentIds.length
      ? supabase.from("scan_assignments").select("id, scope_values, instructions").in("id", assignmentIds)
      : Promise.resolve({ data: [] }),
  ]);

  const stores = new Map(((storesRes.data ?? []) as Row[]).map((s) => [String(s.id), s]));
  const results = new Map(((resultsRes.data ?? []) as Row[]).map((r) => [String(r.scan_id), r]));
  const products = groupBy((productsRes.data ?? []) as Row[], "scan_id");
  const lines = groupBy((linesRes.data ?? []) as Row[], "scan_id");
  const plano = new Map(((planoRes.data ?? []) as Row[]).map((p) => [String(p.scan_id), p]));
  const findings = groupBy((findingsRes.data ?? []) as Row[], "scan_id");
  const assignments = new Map(((assignmentsRes.data ?? []) as Row[]).map((a) => [String(a.id), a]));

  const ordered = scanIds.map((id) => scans.find((s) => s.id === id)!).filter(Boolean);
  const refs: IntelligenceAuditRef[] = [];
  const data: Row[] = [];
  const chartAudits: ChartSourceAudit[] = [];

  ordered.forEach((scan, i) => {
    const id = String(scan.id);
    const store = stores.get(String(scan.store_id ?? ""));
    const mode: "ai" | "digital" = scan.audit_mode === "digital" ? "digital" : "ai";
    const date = String(scan.created_at ?? "").slice(0, 10);
    const subCategory = scan.sub_category_label ?? scan.sub_category_custom ?? scan.sub_category;
    const storeName = String(store?.name ?? "Store");
    const assignment = assignments.get(String(scan.assignment_id ?? ""));
    const name = auditName({
      assignedName: assignedAuditName(assignment?.scope_values),
      store: storeName,
      category: scan.category as string | null,
      shelf: scan.shelf_label as string | null,
    });
    const description = auditDescription({ instructions: assignment?.instructions, notes: scan.notes });
    const code = auditShortId(id);
    refs.push({ id, mode, date, label: name, code, description });
    chartAudits.push({
      label: `${i + 1}. ${name}`,
      date,
      storeId: String(scan.store_id ?? ""),
      storeName,
      mode,
      scan,
      metrics: (results.get(id)?.metrics ?? undefined) as Row | undefined,
    });

    const audit: Row = {
      audit_number: i + 1,
      audit_id: code,
      audit_name: name,
      audit_description: description,
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

  const charts = buildIntelligenceCharts({
    audits: chartAudits,
    findings: (findingsRes.data ?? []) as Row[],
    products: (productsRes.data ?? []) as Row[],
    lines: (linesRes.data ?? []) as Row[],
  });
  return { refs, data, charts };
}

type LoadedFile = { attachment: IntelligenceAttachment; input: IntelligenceFileInput; dataUrl?: string };

async function loadAttachments(
  orgId: string,
  userId: string,
  files: Array<{ path: string; name: string }>,
): Promise<LoadedFile[]> {
  if (!files.length) return [];
  const prefix = `${orgId}/${userId}/`;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { inspectAttachment, safeFileName, AttachmentRejected } = await import(
    "@/lib/intelligence/attachment-safety.server"
  );
  const out: LoadedFile[] = [];
  let inlineBytes = 0;
  for (const f of files) {
    if (!f.path.startsWith(prefix)) throw new Error("An attached file is not yours. Attach it again.");
    const name = safeFileName(f.name);
    const { data: blob, error } = await supabaseAdmin.storage.from(INTELLIGENCE_ATTACHMENT_BUCKET).download(f.path);
    if (error || !blob) throw new Error(`Could not read ${name}. Attach it again.`);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const ext = f.path.slice(f.path.lastIndexOf(".") + 1);
    let inspected;
    try {
      inspected = await inspectAttachment(`file.${ext}`, bytes);
    } catch (e) {
      if (e instanceof AttachmentRejected) throw new Error(`${name} ${e.message}`);
      throw e;
    }
    const attachment: IntelligenceAttachment = { path: f.path, name, kind: inspected.kind, size: bytes.length };
    if (inspected.text !== undefined) {
      out.push({ attachment, input: { name, kind: inspected.kind, text: inspected.text } });
      continue;
    }
    inlineBytes += bytes.length;
    if (inlineBytes > MAX_INLINE_FILE_BYTES) {
      throw new Error("The attached PDFs and images are too large together (30 MB max). Remove one and try again.");
    }
    const base64 = Buffer.from(bytes).toString("base64");
    out.push({ attachment, input: { name, kind: inspected.kind }, dataUrl: `data:${inspected.mime};base64,${base64}` });
  }
  return out;
}

export const uploadIntelligenceAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { activeOrgId: string; name: string; base64: string }) => {
    const activeOrgId = String(input?.activeOrgId ?? "");
    if (!UUID_RE.test(activeOrgId)) throw new Error("Missing workspace.");
    const name = String(input?.name ?? "").slice(0, 200);
    if (!name) throw new Error("The file has no name.");
    const base64 = String(input?.base64 ?? "").replace(/^data:[^,]*;base64,/, "");
    if (!base64 || base64.length > Math.ceil((ATTACHMENT_MAX_BYTES * 4) / 3) + 16) {
      throw new Error(`${name} is larger than 10 MB.`);
    }
    return { activeOrgId, name, base64 };
  })
  .handler(async ({ data, context }): Promise<IntelligenceAttachment> => {
    const { supabase, userId } = context;
    await requireMember(supabase, data.activeOrgId, userId);

    const { withinRateLimits } = await import("@/lib/rate-limit.server");
    if (!(await withinRateLimits([[`intelligence-upload:user:${userId}`, 60, 3600]]))) {
      throw new Error("Too many uploads in the last hour. Try again later.");
    }

    const { inspectAttachment, safeFileName, AttachmentRejected } = await import(
      "@/lib/intelligence/attachment-safety.server"
    );
    const name = safeFileName(data.name);
    const bytes = new Uint8Array(Buffer.from(data.base64, "base64"));
    let inspected;
    try {
      inspected = await inspectAttachment(name, bytes);
    } catch (e) {
      if (e instanceof AttachmentRejected) throw new Error(`${name} ${e.message}`);
      throw new Error(`${name} could not be checked. Try again.`);
    }

    const path = `${data.activeOrgId}/${userId}/${crypto.randomUUID()}.${inspected.ext}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage
      .from(INTELLIGENCE_ATTACHMENT_BUCKET)
      .upload(path, inspected.bytes, { contentType: inspected.mime, upsert: false });
    if (error) throw new Error(`${name} could not be saved. Try again.`);
    return { path, name, kind: inspected.kind, size: inspected.bytes.length };
  });

export const runIntelligenceAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: IntelligenceInput) => validate(input))
  .handler(async ({ data, context }): Promise<IntelligenceReport> => {
    const { supabase, userId } = context;
    await requireMember(supabase, data.activeOrgId, userId);

    const { withinRateLimits } = await import("@/lib/rate-limit.server");
    if (!(await withinRateLimits([[`intelligence:user:${userId}`, 30, 3600]]))) {
      throw new Error("Too many analyses in the last hour. Try again later.");
    }

    const [{ refs, data: audits, charts: catalog }, files] = await Promise.all([
      gatherAudits(supabase, data.activeOrgId, data.scanIds),
      loadAttachments(data.activeOrgId, userId, data.attachments),
    ]);

    const apiKey = (process.env.OPENAI_API_KEY ?? "").trim();
    if (!apiKey) throw new Error("Intelligence is not available right now.");
    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({ apiKey, timeout: 240_000 });
    const text = buildIntelligenceInput(
      data.question,
      audits,
      catalog.map(({ id, title, about }) => ({ id, title, about })),
      files.map((f) => f.input),
    );
    type ContentPart =
      | { type: "input_text"; text: string }
      | { type: "input_file"; filename: string; file_data: string }
      | { type: "input_image"; image_url: string; detail: "high" };
    const content: ContentPart[] = [{ type: "input_text", text }];
    for (const f of files) {
      if (!f.dataUrl) continue;
      content.push(
        f.input.kind === "pdf"
          ? { type: "input_file", filename: f.attachment.name, file_data: f.dataUrl }
          : { type: "input_image", image_url: f.dataUrl, detail: "high" },
      );
    }
    const response = await client.responses.create({
      model: lunaModel(),
      instructions: INTELLIGENCE_INSTRUCTIONS,
      input: [{ role: "user", content }],
      max_output_tokens: 16000,
    });
    const raw = String(response.output_text ?? "").trim();
    const picked = extractChartPicks(raw, catalog);
    const report = hideModelNames(picked.text);
    const picks: Array<{ id: string; caption?: string }> = picked.found
      ? picked.picks
      : catalog.slice(0, 2).map((c) => ({ id: c.id }));
    const charts: IntelligenceChart[] = picks.map((p) => {
      const chart = catalog.find((c) => c.id === p.id)!;
      return p.caption ? { ...chart, caption: hideModelNames(p.caption) } : chart;
    });
    const attachments = files.map((f) => f.attachment);
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
        charts,
        attachments,
      } as never)
      .select("id, created_at")
      .single();
    if (error || !row) throw new Error("The report was written but could not be saved. Try again.");
    const saved = row as { id: string; created_at: string };
    return {
      id: saved.id,
      created_at: saved.created_at,
      question: data.question,
      report,
      audits: refs,
      charts,
      attachments,
    };
  });
