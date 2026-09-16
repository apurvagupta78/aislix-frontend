import { Badge } from "@/components/ui/badge";
import type { TemplateDefinition } from "@/lib/audit-builder/types";
import { summarizeRequiredInputs } from "@/lib/audit-builder/ensure-field-roles";

type Props = {
  definition: TemplateDefinition;
};

export function RequiredInputsSummary({ definition }: Props) {
  const summary = summarizeRequiredInputs(definition);
  const totalWork =
    summary.executableFieldCount +
    summary.evidenceRequiredCount +
    summary.aiConfirmationCount;

  if (totalWork === 0) return null;

  return (
    <div className="rounded-xl border border-brand/20 bg-brand/5 p-4">
      <p className="font-semibold">Your required inputs</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {summary.executableFieldCount} field{summary.executableFieldCount === 1 ? "" : "s"} to
        complete
        {summary.evidenceRequiredCount
          ? ` · ${summary.evidenceRequiredCount} evidence item${summary.evidenceRequiredCount === 1 ? "" : "s"} required`
          : ""}
        {summary.aiConfirmationCount
          ? ` · ${summary.aiConfirmationCount} AI suggestion${summary.aiConfirmationCount === 1 ? "" : "s"} requiring confirmation`
          : ""}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {summary.fieldLabels.map((label) => (
          <Badge key={label} variant="outline" className="text-[10px]">
            {label} · AUDITOR INPUT
          </Badge>
        ))}
        {summary.evidenceLabels.map((label) => (
          <Badge key={`ev-${label}`} variant="outline" className="text-[10px]">
            {label} · EVIDENCE
          </Badge>
        ))}
        {summary.aiLabels.map((label) => (
          <Badge key={`ai-${label}`} variant="outline" className="text-[10px]">
            {label} · AI CONFIRM
          </Badge>
        ))}
      </div>
    </div>
  );
}
