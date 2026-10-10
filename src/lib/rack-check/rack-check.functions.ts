/**
 * Dark store rack quick check: the photo is uploaded by the client, then this server function reads
 * it with the rack overview prompt and saves the bin grid. Quick checks never open fixes or enter
 * audit history; the rows and photos are kept only for usage reporting.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildRackOverviewPrompt } from "@/lib/ai-audit/prompts/rack-overview.prompt";
import { normalizeCode, parseRackCheckPayload, type RackCheckResult } from "@/lib/rack-check/rack-check-parse";

export const RACK_CHECK_FOLDER = "rack-check";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FILE_RE = /^[0-9a-f-]{36}\.(jpe?g|png|webp)$/i;

export type RunRackCheckInput = {
  activeOrgId: string;
  storeId: string;
  storagePath: string;
  rackCode?: string | null;
};

export type RunRackCheckOutput = { id: string; result: RackCheckResult };

function contentTypeFor(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export const runRackCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: RunRackCheckInput) => {
    const activeOrgId = String(input?.activeOrgId ?? "");
    const storeId = String(input?.storeId ?? "");
    if (!UUID_RE.test(activeOrgId)) throw new Error("Missing workspace.");
    if (!UUID_RE.test(storeId)) throw new Error("Pick a store.");
    const parts = String(input?.storagePath ?? "").split("/");
    if (parts.length !== 3 || parts[0] !== activeOrgId || parts[1] !== RACK_CHECK_FOLDER || !FILE_RE.test(parts[2] ?? "")) {
      throw new Error("Photo does not belong to this workspace.");
    }
    const rawRack = typeof input?.rackCode === "string" ? input.rackCode.trim() : "";
    const rackCode = rawRack ? normalizeCode(rawRack) : null;
    if (rawRack && !rackCode) throw new Error("Rack code can use letters, numbers and dashes only, e.g. D07.");
    return { activeOrgId, storeId, storagePath: parts.join("/"), rackCode };
  })
  .handler(async ({ data, context }): Promise<RunRackCheckOutput> => {
    const { supabase, userId } = context;

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
      .select("id, org_id")
      .eq("id", data.storeId)
      .maybeSingle();
    if (!store || (store as { org_id: string }).org_id !== data.activeOrgId) {
      throw new Error("Store not found in your access.");
    }

    const { withinRateLimits } = await import("@/lib/rate-limit.server");
    if (!(await withinRateLimits([[`rack-check:user:${userId}`, 300, 3600]]))) {
      throw new Error("Too many rack checks in the last hour. Try again later.");
    }

    const apiKey = (process.env.OPENAI_API_KEY ?? "").trim();
    if (!apiKey) throw new Error("Rack checks are not available right now.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: blob, error: downloadError } = await supabaseAdmin.storage
      .from("audit-evidence")
      .download(data.storagePath);
    if (downloadError || !blob) throw new Error("Could not read the photo. Upload it again.");
    const bytes = Buffer.from(await blob.arrayBuffer());

    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({ apiKey, timeout: 120_000 });
    const model =
      (process.env.OPENAI_VISION_MODEL ?? "").trim() || (process.env.OPENAI_MODEL ?? "").trim() || "gpt-5.6-luna";
    const response = await client.responses.create({
      model,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: buildRackOverviewPrompt({ rackCode: data.rackCode }) },
            {
              type: "input_image",
              image_url: `data:${contentTypeFor(data.storagePath)};base64,${bytes.toString("base64")}`,
              detail: "high",
            },
          ],
        },
      ],
      text: { format: { type: "json_object" } },
      max_output_tokens: 6000,
    });
    const text = String(response.output_text ?? "").trim();
    let payload: unknown = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      throw new Error("The AI could not read this photo. Try again or retake it.");
    }
    const result = parseRackCheckPayload(payload);

    const { data: row, error: insertError } = await supabaseAdmin
      .from("rack_checks" as never)
      .insert({
        org_id: data.activeOrgId,
        store_id: data.storeId,
        created_by: userId,
        storage_path: data.storagePath,
        rack_code: data.rackCode,
        rack_code_read: result.rackCodeRead,
        status: result.status,
        shelves: result.shelves,
        bins_total: result.counts.total,
        bins_empty: result.counts.empty,
        bins_low: result.counts.low,
        bins_stocked: result.counts.stocked,
        bins_messy: result.counts.messy,
        bins_not_visible: result.counts.notVisible,
        image_quality: result.imageQuality,
        summary: result.summary,
      } as never)
      .select("id")
      .single();
    if (insertError || !row) throw new Error("Could not save the rack check.");
    return { id: (row as { id: string }).id, result };
  });
