import type { AuditTemplate } from "@/lib/audit-templates";
import type { SystemTemplateSpec } from "@/lib/audit-engine/template-factory";
import {
  DEMO_ORAL_CARE_META,
  DEMO_ORAL_CARE_ROWS,
  DEMO_PLANOGRAM_LABEL,
} from "@/lib/demo-oral-care-planogram";
import { toDraftRow, type DraftRow } from "@/lib/planogram";

/** With planogram (homepage demo) vs audit without expected layout. */
export type NewAuditPlanogramChoice = "with_demo" | "without";

export function demoPlanogramDraftRows(): DraftRow[] {
  return DEMO_ORAL_CARE_ROWS.map((row) => toDraftRow(row));
}

export function planogramChoiceLabel(choice: NewAuditPlanogramChoice | null): string {
  if (choice === "with_demo") return "With planogram · upload or manual setup";
  if (choice === "without") return "Without planogram";
  return "Not selected";
}

export function isPlanogramRelatedTemplate(input: {
  templateChoice: string;
  systemTemplateSpec?: SystemTemplateSpec | null;
  selectedTemplate?: AuditTemplate | null;
}): boolean {
  if (input.templateChoice === "planogram") return true;
  if (input.systemTemplateSpec?.purpose === "planogram") return true;
  if (input.selectedTemplate?.audit_purpose === "planogram") return true;
  const key = input.systemTemplateSpec?.key ?? "";
  if (key.includes("planogram")) return true;
  const name = (
    input.systemTemplateSpec?.name ??
    input.selectedTemplate?.name ??
    ""
  ).toLowerCase();
  return name.includes("planogram");
}

export function demoPlanogramSummary() {
  return {
    label: DEMO_PLANOGRAM_LABEL,
    name: DEMO_ORAL_CARE_META.name,
    category: DEMO_ORAL_CARE_META.category,
    positions: DEMO_ORAL_CARE_ROWS.length,
    fixture: DEMO_ORAL_CARE_META.fixture_id ?? "G01",
  };
}
