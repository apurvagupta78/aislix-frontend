/**
 * FNV QC vision: evidence image → Astra disposition → persist on digital line + finding.
 * Build bump: direct OpenAI path (bypass Railway shelf finalize for disposition JSON).
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

/** Download evidence bytes (prefer service-role client). */
async function loadFnvEvidenceBytes(
  supabase: SupabaseClient,
  storagePath: string,
  storageBucket?: RunFnvQcInput["storageBucket"],
): Promise<{ bytes: Buffer; contentType: string; fileName: string }> {
  const primary = resolveFnvEvidenceBucket(storagePath, storageBucket);
  const order =
    primary === "audit-evidence"
      ? (["audit-evidence", "scan-images"] as const)
      : (["scan-images", "audit-evidence"] as const);

  let lastError = "Evidence object not found.";
  for (const bucket of order) {
    const { data, error } = await supabase.storage.from(bucket).download(storagePath);
    if (error || !data) {
      lastError = error?.message ?? lastError;
      continue;
    }
    const bytes = Buffer.from(await data.arrayBuffer());
    const lower = storagePath.toLowerCase();
    const contentType = lower.endsWith(".png")
      ? "image/png"
      : lower.endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";
    const fileName = storagePath.split("/").pop() || "evidence.jpg";
    return { bytes, contentType, fileName };
  }
  throw new Error(`Could not download FNV evidence: ${lastError}`);
}

function isFnvTemplate(t: {
  template_type?: string | null;
  audit_purpose?: string | null;
  name?: string | null;
} | null): boolean {
  if (!t) return false;
  return (
    t.template_type === "fnv_qc_audit" ||
    t.audit_purpose === "fnv_qc" ||
    Boolean(t.name?.toLowerCase().includes("fnv"))
  );
}

async function runFnvQcViaOpenAI(
  evidence: { bytes: Buffer; contentType: string },
  visionPrompt: string,
): Promise<unknown> {
  const OpenAI = (await import("openai")).default;
  const apiKey = (process.env.OPENAI_API_KEY ?? "").trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured for FNV QC.");
  }
  const model =
    (process.env.OPENAI_VISION_MODEL ?? "").trim() ||
    (process.env.OPENAI_FNV_MODEL ?? "").trim() ||
    (process.env.OPENAI_MODEL ?? "").trim() ||
    "gpt-5.6-luna";

  const client = new OpenAI({ apiKey, timeout: 120_000 });
  const mime = evidence.contentType || "image/jpeg";
  const dataUrl = `data:${mime};base64,${evidence.bytes.toString("base64")}`;

  const response = await client.responses.create({
    model,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: visionPrompt },
          { type: "input_image", image_url: dataUrl },
        ],
      },
    ],
    text: { format: { type: "json_object" } },
    max_output_tokens: 1024,
  });

  const text = String(response.output_text ?? "").trim();
  if (!text) {
    throw new Error("FNV QC vision returned an empty response.");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (err) {
    throw new Error(
      `FNV QC vision response was not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

async function runFnvQcCore(
  supabase: SupabaseClient,
  data: RunFnvQcInput,
  /** Trusted writer — bypasses RLS for disposition persist after authz read. */
  writer?: SupabaseClient,
): Promise<{ result: FnvQcResult | null; skipped?: string }> {
  const db = writer ?? supabase;
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
    isFnv = isFnvTemplate(
      template as {
        template_type?: string | null;
        audit_purpose?: string | null;
        name?: string | null;
      } | null,
    );
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
      isFnv = isFnvTemplate(
        template as {
          template_type?: string | null;
          audit_purpose?: string | null;
          name?: string | null;
        } | null,
      );
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

  let evidence: { bytes: Buffer; contentType: string; fileName: string };
  try {
    evidence = await loadFnvEvidenceBytes(db, data.storagePath, data.storageBucket);
  } catch {
    evidence = await loadFnvEvidenceBytes(supabase, data.storagePath, data.storageBucket);
  }

  const extras = buildAstraVisionExtras({
    purpose: "fnv_qc",
    category: data.productHint ?? null,
    notes: data.notes ?? null,
  });

  // Prefer direct OpenAI on the app server. Railway shelf finalize still rejects
  // disposition-only JSON until that deploy is live (error_code=no_products).
  let payload: unknown;
  try {
    payload = await runFnvQcViaOpenAI(evidence, extras.vision_prompt);
  } catch (primaryErr) {
    console.error("[fnv-qc] direct OpenAI failed; trying Railway multipart", {
      scanId: data.scanId,
      message: primaryErr instanceof Error ? primaryErr.message : String(primaryErr),
    });
    const { submitVisionJobMultipart, pollVisionJobOnce, PipelineError } = await import(
      "@/lib/scan-pipeline.server"
    );
    const visionJobId = `${data.scanId}__fnv__${data.binKey || "default"}`.slice(0, 120);
    try {
      const submitted = await submitVisionJobMultipart({
        scanId: visionJobId,
        file: evidence.bytes,
        fileName: evidence.fileName,
        contentType: evidence.contentType,
        vision_prompt: extras.vision_prompt,
        analysis_mode: extras.analysis_mode,
        operating_model: extras.operating_model,
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
    } catch (err) {
      if (err instanceof PipelineError && err.detail) {
        console.error("[fnv-qc] railway vision failed", {
          scanId: data.scanId,
          code: err.code,
          detail: err.detail.slice(0, 500),
        });
      }
      throw primaryErr instanceof Error ? primaryErr : err;
    }
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
  if (!lineIds.length) {
    throw new Error("FNV QC produced a disposition but no digital audit lines were found to update.");
  }

  const patch = {
    qc_disposition: result.disposition,
    qc_defect_types: result.defect_types,
    qc_confidence: result.confidence,
    qc_notes: result.notes,
    qc_analyzed_at: now,
    ...(result.disposition === "DAMAGED" ? { rca_code: "damaged" } : {}),
  } as never;

  // Persist with writer (service role) so RLS cannot silently no-op the update.
  const { data: updatedRows, error: updateErr } = await db
    .from("digital_audit_lines")
    .update(patch)
    .in("id", lineIds)
    .select("id, qc_disposition");
  if (updateErr) {
    throw new Error(`FNV QC could not persist disposition: ${updateErr.message}`);
  }
  const persisted = (updatedRows ?? []).filter(
    (row) => (row as { qc_disposition?: string | null }).qc_disposition === result.disposition,
  );
  if (persisted.length === 0) {
    throw new Error(
      "FNV QC disposition was computed but not saved (0 rows updated). Check org access to digital_audit_lines.",
    );
  }

  if (result.disposition === "DAMAGED" && lineIds[0]) {
    const line = (lines ?? [])[0] as { id: string; product_name?: string; category?: string };
    const orgId = (scan as { org_id: string }).org_id;
    const storeId = (scan as { store_id: string | null }).store_id;
    const { data: existingFinding } = await db
      .from("findings")
      .select("id")
      .eq("scan_id", data.scanId)
      .eq("digital_audit_line_id", line.id)
      .eq("finding_type", "damaged_product")
      .limit(1)
      .maybeSingle();
    if (!existingFinding) {
      await db.from("findings").insert({
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

async function getFnvWriter(userClient: SupabaseClient, scanId: string): Promise<SupabaseClient> {
  // Authz: caller must be able to read the scan under RLS.
  const { data: scan, error } = await userClient
    .from("shelf_scans")
    .select("id")
    .eq("id", scanId)
    .maybeSingle();
  if (error || !scan) throw new Error("Audit not found or not authorized.");
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return supabaseAdmin as unknown as SupabaseClient;
  } catch {
    return userClient;
  }
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
    const writer = await getFnvWriter(context.supabase, data.scanId);
    return runFnvQcCore(context.supabase, data, writer);
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
    const writer = await getFnvWriter(supabase, data.scanId);
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
    let lastSkip: string | undefined;
    for (const row of evidenceRows as { bin_key: string; storage_path: string }[]) {
      const path = String(row.storage_path ?? "").trim();
      const binKey = String(row.bin_key ?? "default").trim() || "default";
      if (!path) continue;
      const out = await runFnvQcCore(
        supabase,
        {
          scanId: data.scanId,
          binKey,
          storagePath: path,
          storageBucket: "audit-evidence",
          productHint: data.productHint ?? null,
        },
        writer,
      );
      if (out.skipped) lastSkip = out.skipped;
      if (out.result) ran += 1;
    }
    if (ran === 0) {
      throw new Error(
        lastSkip === "not_fnv"
          ? "FNV QC ensure skipped: scan was not classified as FNV on the server."
          : "FNV QC ensure ran but did not persist a disposition. Re-upload evidence and retry.",
      );
    }
    return { ran };
  });
