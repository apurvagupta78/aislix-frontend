import { NewAuditStepSection } from "@/components/new-audit/NewAuditStepSection";
import { Badge } from "@/components/ui/badge";
import { ASSIGNMENT_MODE_LABELS } from "@/lib/assignment-engine";
import { CAPTURE_METHOD_OPTIONS } from "@/lib/new-audit/summary";
import type { CaptureMethod, StartChoice } from "@/lib/new-audit/summary";

type PreviewRow = { label: string; value: string };

type Props = {
  auditName: string;
  auditDescription: string;
  startChoice: StartChoice;
  templateName?: string;
  operatingModelLabel?: string;
  method: CaptureMethod;
  planogramSummary?: string;
  assigneeSummary: string;
  scheduleSummary: string;
  evidenceSummary?: string;
  showEvidence?: boolean;
  stepNumber?: number;
  sectionId?: string;
  assignToSelf?: boolean;
  complete?: boolean;
};

function PreviewGroup({ title, rows }: { title: string; rows: PreviewRow[] }) {
  return (
    <div className="rounded-xl border border-[var(--aislix-border)] bg-[var(--aislix-surface)]/40 p-4">
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.1em] text-[var(--aislix-secondary)]">
        {title}
      </p>
      <dl className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between"
          >
            <dt className="text-sm text-[var(--aislix-secondary)]">{row.label}</dt>
            <dd className="whitespace-pre-wrap text-sm font-medium text-[var(--aislix-primary)] sm:max-w-[60%] sm:text-right">
              {row.value || "—"}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function startMethodLabel(choice: StartChoice, templateName?: string) {
  if (choice === "template") return templateName ? `Template · ${templateName}` : "Select Template";
  if (choice === "csv") return "Upload CSV";
  if (choice === "custom") return "Start from Scratch";
  return "—";
}

export function NewAuditStep7Preview({
  auditName,
  auditDescription,
  startChoice,
  templateName,
  operatingModelLabel,
  method,
  planogramSummary,
  assigneeSummary,
  scheduleSummary,
  evidenceSummary,
  showEvidence = true,
  stepNumber = 7,
  sectionId = "step-7-preview",
  assignToSelf,
  complete,
}: Props) {
  const modeLabel =
    CAPTURE_METHOD_OPTIONS.find((o) => o.value === method)?.title ?? method;

  const assigneeDisplay =
    assigneeSummary && assigneeSummary !== "Not selected" ? assigneeSummary : "—";

  return (
    <NewAuditStepSection
      id={sectionId}
      stepNumber={stepNumber}
      title="Preview"
      description={
        method === "ai" && assignToSelf
          ? "Review your setup, then continue to capture your shelf photo."
          : "Review your configuration before submitting."
      }
      complete={complete}
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge variant="outline">{modeLabel}</Badge>
        {method !== "ai" ? (
          <Badge variant="outline">{startMethodLabel(startChoice, templateName)}</Badge>
        ) : null}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <PreviewGroup
          title="Step 1 · Details"
          rows={[
            { label: "Audit Name", value: auditName },
            { label: "Description", value: auditDescription || "—" },
          ]}
        />
        <PreviewGroup
          title="Step 2 · Perform"
          rows={[{ label: "Mode", value: modeLabel }]}
        />
        <PreviewGroup
          title="Step 3 · Start"
          rows={
            method === "ai"
              ? [{ label: "Planogram", value: planogramSummary ?? "—" }]
              : [
                  { label: "Method", value: startMethodLabel(startChoice, templateName) },
                  ...(operatingModelLabel && startChoice === "template"
                    ? [{ label: "Operating model", value: operatingModelLabel }]
                    : []),
                  ...(planogramSummary ? [{ label: "Planogram", value: planogramSummary }] : []),
                ]
          }
        />
        <PreviewGroup title="Step 4 · Who" rows={[{ label: "Assigned to", value: assigneeDisplay }]} />
        <PreviewGroup title="Step 5 · When" rows={[{ label: "Schedule", value: scheduleSummary }]} />
        {showEvidence && evidenceSummary ? (
          <PreviewGroup title="Step 6 · Evidence" rows={[{ label: "Level", value: evidenceSummary }]} />
        ) : null}
      </div>
    </NewAuditStepSection>
  );
}

export function formatScheduleSummary(
  mode: keyof typeof ASSIGNMENT_MODE_LABELS,
  publishAt?: string,
): string {
  if (mode === "assign_now") return "Assign Now";
  if (mode === "schedule_once") {
    return publishAt ? `Schedule Once · ${publishAt}` : "Schedule Once";
  }
  return ASSIGNMENT_MODE_LABELS[mode] ?? mode;
}
