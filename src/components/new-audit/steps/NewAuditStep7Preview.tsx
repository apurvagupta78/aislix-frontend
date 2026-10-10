import { NewAuditStepSection } from "@/components/new-audit/NewAuditStepSection";
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
  /** AI audits: what Luna was asked to analyse. */
  aiAnalysisSummary?: string;
  /** Chosen stores — one audit is created for each. */
  storeNames?: string[];
  assigneeSummary: string;
  scheduleSummary: string;
  evidenceSummary?: string;
  showEvidence?: boolean;
  stepNumber?: number;
  sectionId?: string;
  assignToSelf?: boolean;
  complete?: boolean;
  /** Editing: the audit keeps this setup, so the start rows are replaced by it. */
  setupSummary?: string;
};

function PreviewGroup({ title, rows }: { title: string; rows: PreviewRow[] }) {
  return (
    <div className="rounded-xl border border-[var(--aislix-border)] bg-white p-4">
      <p className="mb-3 text-sm font-semibold text-[var(--aislix-primary)]">
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
  if (choice === "template") return templateName ? `Template · ${templateName}` : "Template";
  if (choice === "csv") return "Upload your document";
  if (choice === "custom") return "Start from scratch";
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
  aiAnalysisSummary,
  storeNames = [],
  assigneeSummary,
  scheduleSummary,
  evidenceSummary,
  showEvidence = true,
  stepNumber = 7,
  sectionId = "step-7-preview",
  assignToSelf,
  complete,
  setupSummary,
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
      <div className="grid gap-3 md:grid-cols-2">
        <PreviewGroup
          title="Details"
          rows={[
            { label: "Audit name", value: auditName },
            { label: "Description", value: auditDescription || "—" },
          ]}
        />
        <PreviewGroup
          title="How"
          rows={[{ label: "Mode", value: modeLabel }]}
        />
        <PreviewGroup
          title="Start"
          rows={
            setupSummary
              ? [{ label: "Setup", value: setupSummary }]
              : method === "ai"
              ? [
                  { label: "Audit against", value: planogramSummary ?? "—" },
                  { label: "AI analyses", value: aiAnalysisSummary ?? "—" },
                ]
              : [
                  { label: "Method", value: startMethodLabel(startChoice, templateName) },
                  ...(operatingModelLabel && startChoice === "template"
                    ? [{ label: "Operating model", value: operatingModelLabel }]
                    : []),
                  ...(planogramSummary ? [{ label: "Planogram", value: planogramSummary }] : []),
                ]
          }
        />
        <PreviewGroup
          title="Where"
          rows={[
            {
              label: storeNames.length === 1 ? "Store" : "Stores",
              value: storeNames.length ? storeNames.join(", ") : "—",
            },
            ...(storeNames.length > 1
              ? [{ label: "Audits created", value: `${storeNames.length} · one per store` }]
              : []),
          ]}
        />
        <PreviewGroup title="Who" rows={[{ label: "Assigned to", value: assigneeDisplay }]} />
        <PreviewGroup title="When" rows={[{ label: "Schedule", value: scheduleSummary }]} />
        {showEvidence && evidenceSummary ? (
          <PreviewGroup title="Evidence" rows={[{ label: "Required", value: evidenceSummary }]} />
        ) : null}
      </div>
    </NewAuditStepSection>
  );
}

export function formatScheduleSummary(
  mode: keyof typeof ASSIGNMENT_MODE_LABELS,
  publishAt?: string,
): string {
  if (mode === "assign_now") return "Assign now";
  if (mode === "schedule_once") {
    return publishAt ? `Schedule once · ${publishAt}` : "Schedule once";
  }
  return ASSIGNMENT_MODE_LABELS[mode] ?? mode;
}
