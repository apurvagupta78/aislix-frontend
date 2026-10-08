import { resolveFieldRole } from "@/lib/audit-builder/ensure-field-roles";
import type { FieldRole } from "@/lib/audit-builder/field-roles";
import type { TemplateDefinition } from "@/lib/audit-builder/types";
import { AISLIX_PALETTE, ACCENT_TINT } from "@/lib/ai-audit/kpi-palette";

const ROLE_LABEL: Partial<Record<FieldRole, { label: string; tint: string; border: string }>> = {
  auditor_input: { label: "Auditee fills", tint: ACCENT_TINT.purple, border: AISLIX_PALETTE.purple },
  evidence: { label: "Photo evidence", tint: ACCENT_TINT.blue, border: AISLIX_PALETTE.blue },
  reference: { label: "Already provided", tint: ACCENT_TINT.cyan, border: AISLIX_PALETTE.cyan },
  ai_suggested: { label: "Auditee confirms", tint: ACCENT_TINT.purple, border: AISLIX_PALETTE.purple },
  human_confirmed: { label: "Auditee confirms", tint: ACCENT_TINT.purple, border: AISLIX_PALETTE.purple },
};

/** One-off checklist templates (no repeating lines): show every question the auditee answers. */
export function TemplateChecklistPreview({ definition, templateName }: { definition: TemplateDefinition; templateName: string }) {
  const sections = [...definition.sections].sort((a, b) => a.order - b.order);
  const visible = definition.fields.filter((f) => {
    const role = resolveFieldRole(f);
    return role !== "system" && role !== "calculated";
  });

  return (
    <div className="space-y-4 rounded-2xl border border-[#D9E2E8] bg-white p-4">
      <div>
        <h4 className="text-sm font-semibold text-[#04203F]">Template fields</h4>
        <p className="mt-0.5 text-xs text-[#667085]">
          “{templateName}” is a checklist — the auditee answers each field once per audit. No lines to set up.
        </p>
      </div>
      {sections.map((section) => {
        const fields = visible.filter((f) => f.section === section.key).sort((a, b) => a.order - b.order);
        if (!fields.length) return null;
        return (
          <div key={section.key} className="space-y-2">
            <h5 className="text-xs font-medium text-[#667085]">{section.title}</h5>
            <ul className="grid gap-2 sm:grid-cols-2">
              {fields.map((f) => {
                const style = ROLE_LABEL[resolveFieldRole(f)] ?? ROLE_LABEL.auditor_input!;
                return (
                  <li
                    key={f.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[#D9E2E8] px-3 py-2"
                  >
                    <span className="min-w-0 truncate text-sm text-[#04203F]">
                      {f.label}
                      {f.required ? <span className="ml-1 text-xs text-[#667085]">· required</span> : null}
                    </span>
                    <span
                      className="shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium text-[#04203F]"
                      style={{ background: style.tint, borderColor: style.border }}
                    >
                      {style.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
