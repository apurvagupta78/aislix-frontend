/**
 * FNV QC vision: evidence image → Astra disposition → persist on digital line + finding.
 */

import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildAstraVisionExtras } from "@/lib/ai-audit/astra-analysis";
import { parseFnvQcPayload, type FnvQcResult } from "@/lib/ai-audit/fnv-qc-parse";

export type RunFnvQcInput = {
  scanId: string;
  binKey: string;
  storagePath: string;
  /** Storage bucket for the evidence object. Defaults by path heuristic. */
  storageBucket?: "scan-images" | "audit-evidence" | null;
  productHint?: string | null;
  notes?: string | null;
};

function resolveFnvEvidenceBucket(
  storagePath: string,
  explicit?: RunFnvQcInput["storageBucket"],
): "scan-images" | "audit-evidence" {
  if (explicit === "scan-images" || explicit === "audit-evidence") return explicit;
  if (storagePath.includes("/custom-audit/") || storagePath.startsWith("custom-audit/")) {
    return "audit-evidence";
  }
  return "scan-images";
}

async function signFnvEvidenceUrl(
  supabase: SupabaseClient,
  storagePath: string,
  storageBucket?: RunFnvQcInput["storageBucket"],
): Promise<string> {
  const primary = resolveFnvEvidenceBucket(storagePath, storageBucket);
  const order =
    primary === "audit-evidence"
      ? (["audit-evidence", "scan-images"] as const)
      : (["scan-images", "audit-evidence"] as const);

  for (const bucket of order) {
    const { data: signed, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, 3600);
    if (!error && signed?.signedUrl) return signed.signedUrl;
  }
  throw new Error("Could not sign FNV evidence URL.");
}

async function runFnvQcCore(
  supabase: SupabaseClient,
  data: RunFnvQcInput,
): Promise<{ result: FnvQcResult | null; skipped?: string }> {
  const { data: scan } = await supabase
    .from("shelf_scans")
    .select("id, org_id, assignment_id, store_id, template_id")
    .eq("id", data.scanId)
    .maybeSingle();
  if (!scan) throw new Error("Audit not found.");

  const assignmentId = (scan as { assignment_id?: string | null }).assignment_id ?? null;
  let isFnv = false;

  // Prefer scan.template_id (always present after custom submit) over assignment lookup.
  const scanTemplateId = (scan as { template_id?: string | null }).template_id;
  if (scanTemplateId) {
    const { data: template } = await supabase
      .from("audit_templates")
      .select("template_type, audit_purpose, name")
      .eq("id", scanTemplateId)
      .maybeSingle();
    const t = template as {
      template_type?: string | null;
      audit_purpose?: string | null;
      name?: string | null;
    } | null;
    isFnv =
      t?.template_type === "fnv_qc_audit" ||
      t?.audit_purpose === "fnv_qc" ||
      Boolean(t?.name?.toLowerCase().includes("fnv"));
  }

  if (!isFnv && assignmentId) {
    const { data: assignment } = await supabase
      .from("scan_assignments")
      .select("template_id, campaign_id")
      .eq("id", assignmentId)
      .maybeSingle();
    const templateId = (assignment as { template_id?: string | null } | null)?.template_id;
    if (templateId) {
      const { data: template } = await supabase
        .from("audit_templates")
        .select("template_type, audit_purpose, name")
        .eq("id", templateId)
        .maybeSingle();
      const t = template as {
        template_type?: string | null;
        audit_purpose?: string | null;
        name?: string | null;
      } | null;
      isFnv =
        t?.template_type === "fnv_qc_audit" ||
        t?.audit_purpose === "fnv_qc" ||
        Boolean(t?.name?.toLowerCase().includes("fnv"));
    }
    if (!isFnv && (assignment as { campaign_id?: string | null } | null)?.campaign_id) {
      const { data: campaign } = await supabase
        .from("assignment_campaigns")
        .select("audit_purpose")
        .eq("id", (assignment as { campaign_id: string }).campaign_id)
        .maybeSingle();
      isFnv = (campaign as { audit_purpose?: string } | null)?.audit_purpose === "fnv_qc";
    }
  }
  if (!isFnv) return { result: null, skipped: "not_fnv" };

  const signedUrl = await signFnvEvidenceUrl(supabase, data.storagePath, data.storageBucket);

  const extras = buildAstraVisionExtras({
    purpose: "fnv_qc",
    category: data.productHint ?? null,
    notes: data.notes ?? null,
  });

  const { submitVisionJob, pollVisionJobOnce } = await import("@/lib/scan-pipeline.server");
  let payload: unknown;
  const submitted = await submitVisionJob({
    image_urls: [signedUrl],
    vision_prompt: extras.vision_prompt,
    analysis_mode: extras.analysis_mode,
    operating_model: extras.operating_model,
    scan_id: data.scanId,
    purpose: "fnv_qc",
  });
  if (submitted.kind === "completed") {
    payload = submitted.payload;
  } else {
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2500));
      const once = await pollVisionJobOnce(submitted.jobId);
      if (once.kind === "completed") {
        payload = once.payload;
        break;
      }
    }
    if (!payload) throw new Error("FNV QC analysis timed out.");
  }

  const result = parseFnvQcPayload(payload);
  const now = new Date().toISOString();

  let { data: lines } = await supabase
    .from("digital_audit_lines")
    .select("id, product_name, category, bin_key")
    .eq("scan_id", data.scanId)
    .eq("bin_key", data.binKey);

  // Universal audits may persist a single line under a location-derived bin_key while
  // evidence was keyed as record-N before alignment — fall back to all lines on the scan.
  if (!lines?.length) {
    const fallback = await supabase
      .from("digital_audit_lines")
      .select("id, product_name, category, bin_key")
      .eq("scan_id", data.scanId);
    lines = fallback.data;
  }

  const lineIds = ((lines ?? []) as { id: string }[]).map((l) => l.id);
  if (lineIds.length) {
    await supabase
      .from("digital_audit_lines")
      .update({
        qc_disposition: result.disposition,
        qc_defect_types: result.defect_types,
        qc_confidence: result.confidence,
        qc_notes: result.notes,
        qc_analyzed_at: now,
        ...(result.disposition === "DAMAGED" ? { rca_code: "damaged" } : {}),
      } as never)
      .in("id", lineIds);
  }

  if (result.disposition === "DAMAGED" && lineIds[0]) {
    const line = (lines ?? [])[0] as { id: string; product_name?: string; category?: string };
    const orgId = (scan as { org_id: string }).org_id;
    const storeId = (scan as { store_id: string | null }).store_id;
    const { data: existingFinding } = await supabase
      .from("findings")
      .select("id")
      .eq("scan_id", data.scanId)
      .eq("digital_audit_line_id", line.id)
      .eq("finding_type", "damaged_product")
      .limit(1)
      .maybeSingle();
    if (!existingFinding) {
      await supabase.from("findings").insert({
        org_id: orgId,
        scan_id: data.scanId,
        assignment_id: assignmentId,
        store_id: storeId,
        digital_audit_line_id: line.id,
        finding_type: "damaged_product",
        severity: "high",
        status: "open",
        audit_origin: "digital",
        confirmation_state: "ai_suggested",
        title: `FNV QC damaged — ${result.product ?? line.product_name ?? "product"}`,
        description:
          result.defect_types.length > 0
            ? `Defects: ${result.defect_types.join(", ")}. ${result.notes ?? ""}`.trim()
            : (result.notes ?? "Astra marked this unit DAMAGED."),
        product_name: result.product ?? line.product_name ?? null,
        category: result.category ?? line.category ?? null,
      } as never);
    }
  }

  return { result };
}

export const runFnvQcOnBinEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: RunFnvQcInput) => {
    if (!input?.scanId || !input?.binKey || !input?.storagePath) {
      throw new Error("Missing FNV QC evidence.");
    }
    return input;
  })
  .handler(async ({ data, context }): Promise<{ result: FnvQcResult | null; skipped?: string }> => {
    return runFnvQcCore(context.supabase, data);
  });

/**
 * Re-run FNV QC for every evidence row on a scan that still lacks qc_disposition.
 * Used after submit (DB-authoritative) and when opening an FNV audit with null QC.
 */
export const ensureFnvQcForScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { scanId: string; productHint?: string | null }) => {
    if (!input?.scanId) throw new Error("Missing scanId.");
    return input;
  })
  .handler(async ({ data, context }): Promise<{ ran: number; skipped?: string }> => {
    const { supabase } = context;
    const { data: pending } = await supabase
      .from("digital_audit_lines")
      .select("id")
      .eq("scan_id", data.scanId)
      .is("qc_disposition", null)
      .limit(1);
    if (!pending?.length) return { ran: 0, skipped: "already_complete" };

    const { data: evidenceRows, error: evidenceErr } = await supabase
      .from("audit_evidence")
      .select("bin_key, storage_path")
      .eq("scan_id", data.scanId);
    if (evidenceErr) throw new Error(evidenceErr.message);
    if (!evidenceRows?.length) return { ran: 0, skipped: "no_evidence" };

    let ran = 0;
    for (const row of evidenceRows as { bin_key: string; storage_path: string }[]) {
      const path = String(row.storage_path ?? "").trim();
      const binKey = String(row.bin_key ?? "default").trim() || "default";
      if (!path) continue;
      const out = await runFnvQcCore(supabase, {
        scanId: data.scanId,
        binKey,
        storagePath: path,
        storageBucket: "audit-evidence",
        productHint: data.productHint ?? null,
      });
      if (out.result) ran += 1;
    }
    return { ran };
  });
