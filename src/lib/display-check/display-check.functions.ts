/**
 * Display / POSM check: the photo is uploaded by the client, then this server function reads it
 * with the display check prompt, saves the result and raises a fix for every problem found.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildDisplayCheckPrompt } from "@/lib/ai-audit/prompts/display-check.prompt";
import {
  displayCheckIssues,
  parseDisplayCheckPayload,
  type DisplayCheckResult,
} from "@/lib/display-check/display-check-parse";

export const DISPLAY_CHECK_FOLDER = "display-check";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FILE_RE = /^[0-9a-f-]{36}\.(jpe?g|png|webp)$/i;

export type RunDisplayCheckInput = {
  activeOrgId: string;
  storeId: string;
  storagePath: string;
  expectedBrand?: string | null;
  expectedDisplay?: string | null;
};

export type RunDisplayCheckOutput = { id: string; result: DisplayCheckResult; issuesRaised: number };

function contentTypeFor(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export const runDisplayCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: RunDisplayCheckInput) => {
    const activeOrgId = String(input?.activeOrgId ?? "");
    const storeId = String(input?.storeId ?? "");
    if (!UUID_RE.test(activeOrgId)) throw new Error("Missing workspace.");
    if (!UUID_RE.test(storeId)) throw new Error("Pick a store.");
    const parts = String(input?.storagePath ?? "").split("/");
    if (parts.length !== 3 || parts[0] !== activeOrgId || parts[1] !== DISPLAY_CHECK_FOLDER || !FILE_RE.test(parts[2] ?? "")) {
      throw new Error("Photo does not belong to this workspace.");
    }
    const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
    return {
      activeOrgId,
      storeId,
      storagePath: parts.join("/"),
      expectedBrand: text(input?.expectedBrand, 80),
      expectedDisplay: text(input?.expectedDisplay, 80),
    };
  })
  .handler(async ({ data, context }): Promise<RunDisplayCheckOutput> => {
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
    if (!(await withinRateLimits([[`display-check:user:${userId}`, 200, 3600]]))) {
      throw new Error("Too many display checks in the last hour. Try again later.");
    }

    const apiKey = (process.env.OPENAI_API_KEY ?? "").trim();
    if (!apiKey) throw new Error("Display checks are not available right now.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: blob, error: downloadError } = await supabaseAdmin.storage
      .from("audit-evidence")
      .download(data.storagePath);
    if (downloadError || !blob) throw new Error("Could not read the photo. Upload it again.");
    const bytes = Buffer.from(await blob.arrayBuffer());

    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({ apiKey, timeout: 90_000 });
    const model =
      (process.env.OPENAI_VISION_MODEL ?? "").trim() || (process.env.OPENAI_MODEL ?? "").trim() || "gpt-5.6-luna";
    const response = await client.responses.create({
      model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildDisplayCheckPrompt({ expectedBrand: data.expectedBrand, expectedDisplay: data.expectedDisplay }),
            },
            {
              type: "input_image",
              image_url: `data:${contentTypeFor(data.storagePath)};base64,${bytes.toString("base64")}`,
              detail: "high",
            },
          ],
        },
      ],
      text: { format: { type: "json_object" } },
      max_output_tokens: 2000,
    });
    const text = String(response.output_text ?? "").trim();
    let payload: unknown = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      throw new Error("The AI could not read this photo. Try again or retake it.");
    }
    const result = parseDisplayCheckPayload(payload, data.expectedBrand);
    const issues = displayCheckIssues(result, data.expectedBrand);

    const { data: row, error: insertError } = await supabaseAdmin
      .from("display_checks" as never)
      .insert({
        org_id: data.activeOrgId,
        store_id: data.storeId,
        created_by: userId,
        storage_path: data.storagePath,
        expected_brand: data.expectedBrand,
        expected_display: data.expectedDisplay,
        status: result.status,
        items: result.items,
        expected_brand_present: result.expectedBrandPresent,
        image_quality: result.imageQuality,
        summary: result.summary,
      } as never)
      .select("id")
      .single();
    if (insertError || !row) throw new Error("Could not save the display check.");
    const checkId = (row as { id: string }).id;

    let issuesRaised = 0;
    if (issues.length) {
      const { error: findingsError } = await supabaseAdmin.from("findings").insert(
        issues.map((issue) => ({
          org_id: data.activeOrgId,
          store_id: data.storeId,
          created_by: userId,
          finding_type: "display_issue",
          source_type: "display_check",
          source_id: checkId,
          severity: issue.severity,
          status: "open",
          audit_origin: "ai",
          confirmation_state: "ai_suggested",
          title: issue.title,
          description: issue.description,
        })) as never,
      );
      if (findingsError) {
        console.error("[display-check] could not raise findings", checkId, findingsError.message);
      } else {
        issuesRaised = issues.length;
        await supabaseAdmin
          .from("display_checks" as never)
          .update({ issues_raised: issuesRaised } as never)
          .eq("id", checkId);
      }
    }

    return { id: checkId, result, issuesRaised };
  });
