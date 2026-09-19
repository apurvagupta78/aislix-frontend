export { buildAstraVisionPrompt, type AstraPromptInput } from "@/lib/ai-audit/astra-prompt";
import type { NewAuditPlanogramChoice } from "@/lib/new-audit/planogram-setup";
import { getRoleProfile } from "@/lib/role-kpi-config";
import type { AuditRoleTab } from "@/lib/role-audit-ui";
import type { ScanContextState } from "@/lib/scan-context";

export type AiVisionContextRow = { label: string; value: string };

/** Human-readable Step 3 / planogram line for AI audit preview. */
export function buildAiPlanogramPreviewSummary(
  choice: NewAuditPlanogramChoice | null,
  ctx: ScanContextState,
): string {
  if (choice === "without") return "Without planogram — analyse visible shelf";
  if (choice === "with_demo") {
    const count = ctx.planogramRows.length;
    const category = ctx.planogramMeta?.category?.trim();
    const sub = ctx.planogramMeta?.sub_category?.trim();
    const categoryLabel = [category, sub].filter(Boolean).join(" · ");
    if (count > 0) {
      return categoryLabel
        ? `With planogram · ${count} products · ${categoryLabel}`
        : `With planogram · ${count} products loaded`;
    }
    return "With planogram · awaiting upload or manual setup";
  }
  return "—";
}

/**
 * Structured context that the vision backend receives when the auditor uploads
 * shelf photos (built in scan-pipeline.server.ts → Railway / Astra).
 *
 * Assignment submit only stores this configuration — the vision call happens at scan time.
 */
export function buildAiVisionContextPreview(input: {
  auditName: string;
  auditDescription: string;
  instructions: string;
  aiPlanogramChoice: NewAuditPlanogramChoice | null;
  scanContext: ScanContextState;
}): AiVisionContextRow[] {
  const role = (input.scanContext.auditRole ?? "supermarket") as AuditRoleTab;
  const roleLabel = getRoleProfile(role).label;
  const rows: AiVisionContextRow[] = [
    { label: "Customer role", value: roleLabel },
    {
      label: "Analysis mode",
      value:
        input.aiPlanogramChoice === "without"
          ? "Shelf photo only — image analysis (no planogram)"
          : "Compare shelf photo against uploaded planogram",
    },
  ];

  if (input.aiPlanogramChoice !== "without" && input.scanContext.planogramRows.length > 0) {
    rows.push({
      label: "Expected products",
      value: `${input.scanContext.planogramRows.length} SKUs from your planogram CSV`,
    });
    const category = input.scanContext.planogramMeta?.category?.trim();
    const sub = input.scanContext.planogramMeta?.sub_category?.trim();
    if (category) {
      rows.push({
        label: "Shelf category",
        value: sub ? `${category} · ${sub}` : category,
      });
    }
  }

  const auditorNotes = [input.auditDescription.trim(), input.instructions.trim()]
    .filter(Boolean)
    .join("\n\n");
  if (auditorNotes) {
    rows.push({ label: "Assignment notes", value: auditorNotes });
  }

  rows.push({
    label: "Vision payload (at scan time)",
    value:
      "Shelf image URLs, customer_type (audit role), planogram_items (expected SKUs, facings, prices), audit_package (KPI targets), category selections, and store context — sent as JSON to the Aislix vision API. Astra then generates detections, compliance scores, and role-specific summaries from that context plus the photo.",
  });

  if (input.auditName.trim()) {
    rows.unshift({ label: "Audit name", value: input.auditName.trim() });
  }

  return rows;
}
