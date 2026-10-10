/**
 * Quick checks for store managers (no audit setup): the client uploads one photo, then these server
 * functions read it with the AI, save the result and, for failed FNV / hygiene checks, open a fix.
 */

import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildNoPlanogramPrompt } from "@/lib/ai-audit/astra-prompt";
import { buildFnvCheckPrompt } from "@/lib/ai-audit/prompts/fnv-check.prompt";
import { buildHygieneCheckPrompt } from "@/lib/ai-audit/prompts/hygiene-check.prompt";
import {
  FNV_VERDICT_LABEL,
  fnvDefectLabel,
  hygieneTypeLabel,
  parseFnvCheckPayload,
  parseHygieneCheckPayload,
  parseShelfCsvPayload,
  type FnvCheckResult,
  type HygieneCheckResult,
  type ShelfCsvResult,
} from "@/lib/quick-checks/quick-check-parse";

export const QUICK_CHECK_FOLDERS = {
  shelfCsv: "shelf-csv",
  fnv: "fnv-check",
  hygiene: "hygiene-check",
} as const;

type QuickCheckFolder = (typeof QUICK_CHECK_FOLDERS)[keyof typeof QUICK_CHECK_FOLDERS];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FILE_RE = /^[0-9a-f-]{36}\.(jpe?g|png|webp)$/i;

export type QuickCheckInput = {
  activeOrgId: string;
  storeId: string;
  storagePath: string;
  /** Shelf / item / area hint, depending on the check. */
  hint?: string | null;
};

type ValidInput = { activeOrgId: string; storeId: string; storagePath: string; hint: string | null };

function validate(input: QuickCheckInput, folder: QuickCheckFolder): ValidInput {
  const activeOrgId = String(input?.activeOrgId ?? "");
  const storeId = String(input?.storeId ?? "");
  if (!UUID_RE.test(activeOrgId)) throw new Error("Missing workspace.");
  if (!UUID_RE.test(storeId)) throw new Error("Pick a store.");
  const parts = String(input?.storagePath ?? "").split("/");
  if (parts.length !== 3 || parts[0] !== activeOrgId || parts[1] !== folder || !FILE_RE.test(parts[2] ?? "")) {
    throw new Error("Photo does not belong to this workspace.");
  }
  const hint = typeof input?.hint === "string" ? input.hint.trim().slice(0, 80) : "";
  return { activeOrgId, storeId, storagePath: parts.join("/"), hint: hint || null };
}

function contentTypeFor(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

const OPERATING_MODELS = new Set(["supermarket", "local_store", "dark_store", "warehouse", "fmcg_distributor"]);

function operatingModelFor(storeType: string | null): string {
  const slug = (storeType ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return OPERATING_MODELS.has(slug) ? slug : "supermarket";
}

async function prepare(
  supabase: SupabaseClient,
  userId: string,
  data: ValidInput,
  rateKey: string,
): Promise<{ bytes: Buffer; storeType: string | null }> {
  const { data: member } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("org_id", data.activeOrgId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (!member) throw new Error("You are not a member of this workspace.");

  const { data: store } = await supabase
    .from("stores")
    .select("id, org_id, store_type")
    .eq("id", data.storeId)
    .maybeSingle();
  if (!store || (store as { org_id: string }).org_id !== data.activeOrgId) {
    throw new Error("Store not found in your access.");
  }

  const { withinRateLimits } = await import("@/lib/rate-limit.server");
  if (!(await withinRateLimits([[`${rateKey}:user:${userId}`, 300, 3600]]))) {
    throw new Error("Too many checks in the last hour. Try again later.");
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: blob, error } = await supabaseAdmin.storage.from("audit-evidence").download(data.storagePath);
  if (error || !blob) throw new Error("Could not read the photo. Upload it again.");
  return {
    bytes: Buffer.from(await blob.arrayBuffer()),
    storeType: (store as { store_type?: string | null }).store_type ?? null,
  };
}

async function readPhoto(input: {
  model: string;
  prompt: string;
  bytes: Buffer;
  storagePath: string;
  maxOutputTokens: number;
  timeoutMs: number;
}): Promise<unknown> {
  const apiKey = (process.env.OPENAI_API_KEY ?? "").trim();
  if (!apiKey) throw new Error("Quick checks are not available right now.");
  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({ apiKey, timeout: input.timeoutMs });
  const response = await client.responses.create({
    model: input.model,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: input.prompt },
          {
            type: "input_image",
            image_url: `data:${contentTypeFor(input.storagePath)};base64,${input.bytes.toString("base64")}`,
            detail: "high",
          },
        ],
      },
    ],
    text: { format: { type: "json_object" } },
    max_output_tokens: input.maxOutputTokens,
  });
  const reason = (response as { incomplete_details?: { reason?: string } | null }).incomplete_details?.reason;
  if (response.status === "incomplete" && reason === "max_output_tokens") {
    throw new Error("This photo has too much to read at once. Take a closer photo of part of the shelf.");
  }
  const out = String(response.output_text ?? "").trim();
  try {
    return out ? (JSON.parse(out) as unknown) : {};
  } catch {
    throw new Error("The AI could not read this photo. Try again or retake it.");
  }
}

function shelfModel(): string {
  return (process.env.OPENAI_VISION_MODEL ?? "").trim() || (process.env.OPENAI_MODEL ?? "").trim() || "gpt-5.6-luna";
}

function lunaModel(): string {
  return (
    (process.env.OPENAI_LUNA_MODEL ?? "").trim() ||
    (process.env.OPENAI_DOC_MODEL ?? "").trim() ||
    (process.env.OPENAI_MODEL ?? "").trim() ||
    "gpt-5.6-luna"
  );
}

/* ------------------------------------------------------------------ */

export type ShelfCsvOutput = { id: string; result: ShelfCsvResult };

export const runShelfCsvCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: QuickCheckInput) => validate(input, QUICK_CHECK_FOLDERS.shelfCsv))
  .handler(async ({ data, context }): Promise<ShelfCsvOutput> => {
    const { supabase, userId } = context;
    const { bytes, storeType } = await prepare(supabase, userId, data, "shelf-csv");
    const payload = await readPhoto({
      model: shelfModel(),
      prompt: buildNoPlanogramPrompt({ operatingModelSlug: operatingModelFor(storeType), location: data.hint }),
      bytes,
      storagePath: data.storagePath,
      maxOutputTokens: 16384,
      timeoutMs: 240_000,
    });
    const result = parseShelfCsvPayload(payload);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("shelf_csv_checks" as never)
      .insert({
        org_id: data.activeOrgId,
        store_id: data.storeId,
        created_by: userId,
        storage_path: data.storagePath,
        shelf_label: data.hint,
        products: result.products,
        products_count: result.productsCount,
        brands_count: result.brandsCount,
        facings_total: result.facingsTotal,
        units_total: result.unitsTotal,
        image_quality: result.imageQuality,
      } as never)
      .select("id")
      .single();
    if (error || !row) throw new Error("Could not save the shelf check.");
    return { id: (row as { id: string }).id, result };
  });

/* ------------------------------------------------------------------ */

export type FnvCheckOutput = { id: string; result: FnvCheckResult; issueRaised: boolean };

export const runFnvCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: QuickCheckInput) => validate(input, QUICK_CHECK_FOLDERS.fnv))
  .handler(async ({ data, context }): Promise<FnvCheckOutput> => {
    const { supabase, userId } = context;
    const { bytes } = await prepare(supabase, userId, data, "fnv-check");
    const payload = await readPhoto({
      model: lunaModel(),
      prompt: buildFnvCheckPrompt({ item: data.hint }),
      bytes,
      storagePath: data.storagePath,
      maxOutputTokens: 2000,
      timeoutMs: 120_000,
    });
    const result = parseFnvCheckPayload(payload);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("fnv_checks" as never)
      .insert({
        org_id: data.activeOrgId,
        store_id: data.storeId,
        created_by: userId,
        storage_path: data.storagePath,
        item_hint: data.hint,
        product: result.product,
        verdict: result.verdict,
        confidence: result.confidence,
        units_visible: result.unitsVisible,
        units_not_sellable: result.unitsNotSellable,
        defects: result.defects,
        reason: result.reason,
        action: result.action,
        image_quality: result.imageQuality,
      } as never)
      .select("id")
      .single();
    if (error || !row) throw new Error("Could not save the FNV check.");
    const checkId = (row as { id: string }).id;

    let issueRaised = false;
    if (result.verdict === "not_sellable") {
      const item = result.product ?? data.hint ?? "Produce";
      const units = result.unitsNotSellable ? `${result.unitsNotSellable} unit${result.unitsNotSellable === 1 ? "" : "s"} not sellable. ` : "";
      const defects = result.defects.length ? `Defects: ${result.defects.map(fnvDefectLabel).join(", ")}. ` : "";
      const { error: findingError } = await supabaseAdmin.from("findings").insert({
        org_id: data.activeOrgId,
        store_id: data.storeId,
        created_by: userId,
        finding_type: "damaged_product",
        source_type: "fnv_check",
        source_id: checkId,
        severity: "high",
        status: "open",
        audit_origin: "ai",
        confirmation_state: "ai_suggested",
        title: `${FNV_VERDICT_LABEL.not_sellable} produce — ${item}`,
        description: `${units}${defects}${result.reason ?? ""} ${result.action ?? ""}`.trim(),
        product_name: result.product,
      } as never);
      if (findingError) {
        console.error("[fnv-check] could not raise finding", checkId, findingError.message);
      } else {
        issueRaised = true;
        await supabaseAdmin.from("fnv_checks" as never).update({ issues_raised: 1 } as never).eq("id", checkId);
      }
    }
    return { id: checkId, result, issueRaised };
  });

/* ------------------------------------------------------------------ */

export type HygieneCheckOutput = { id: string; result: HygieneCheckResult; issueRaised: boolean };

export const runHygieneCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: QuickCheckInput) => validate(input, QUICK_CHECK_FOLDERS.hygiene))
  .handler(async ({ data, context }): Promise<HygieneCheckOutput> => {
    const { supabase, userId } = context;
    const { bytes } = await prepare(supabase, userId, data, "hygiene-check");
    const payload = await readPhoto({
      model: lunaModel(),
      prompt: buildHygieneCheckPrompt({ area: data.hint }),
      bytes,
      storagePath: data.storagePath,
      maxOutputTokens: 3000,
      timeoutMs: 120_000,
    });
    const result = parseHygieneCheckPayload(payload);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("hygiene_checks" as never)
      .insert({
        org_id: data.activeOrgId,
        store_id: data.storeId,
        created_by: userId,
        storage_path: data.storagePath,
        area: data.hint,
        verdict: result.verdict,
        confidence: result.confidence,
        issues: result.issues,
        summary: result.summary,
        image_quality: result.imageQuality,
      } as never)
      .select("id")
      .single();
    if (error || !row) throw new Error("Could not save the hygiene check.");
    const checkId = (row as { id: string }).id;

    let issueRaised = false;
    if (result.verdict === "failed") {
      const severity = result.issues.some((i) => i.severity === "high")
        ? "high"
        : result.issues.some((i) => i.severity === "medium")
          ? "medium"
          : "low";
      const steps = result.issues
        .map((i) => `• ${hygieneTypeLabel(i.type)}${i.where ? ` (${i.where})` : ""}: ${i.whatToDo ?? "Clean and tidy this area."}`)
        .join("\n");
      const { error: findingError } = await supabaseAdmin.from("findings").insert({
        org_id: data.activeOrgId,
        store_id: data.storeId,
        created_by: userId,
        finding_type: "shelf_execution_issue",
        source_type: "hygiene_check",
        source_id: checkId,
        severity,
        status: "open",
        audit_origin: "ai",
        confirmation_state: "ai_suggested",
        title: `Hygiene failed${data.hint ? ` — ${data.hint}` : ""}`,
        description: [result.summary, steps].filter(Boolean).join("\n\n") || "Shelf hygiene needs attention.",
      } as never);
      if (findingError) {
        console.error("[hygiene-check] could not raise finding", checkId, findingError.message);
      } else {
        issueRaised = true;
        await supabaseAdmin.from("hygiene_checks" as never).update({ issues_raised: 1 } as never).eq("id", checkId);
      }
    }
    return { id: checkId, result, issueRaised };
  });
