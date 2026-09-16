import { MapPin, Sparkles, Store, Users } from "lucide-react";

import { AuditorFillPills } from "@/components/new-audit/AuditorFillPills";
import { Button } from "@/components/ui/button";
import type { FieldRole } from "@/lib/audit-builder/field-roles";
import type { OperatingModel } from "@/lib/audit-builder/types";
import { getOperatingModelCard } from "@/lib/audit-engine/operating-model-catalog";
import type { CaptureMethod, StartChoice } from "@/lib/new-audit/summary";
import { CAPTURE_METHOD_OPTIONS } from "@/lib/new-audit/summary";

type Props = {
  operatingModel: OperatingModel;
  locationCount: number;
  locationPreview?: string;
  method: CaptureMethod;
  startChoice: StartChoice;
  templateName?: string;
  auditorItems: { label: string; role: FieldRole }[];
  evidenceCount: number;
  onEdit?: () => void;
  className?: string;
};

function SummaryRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Store;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium leading-snug">{value}</p>
      </div>
    </div>
  );
}

export function SetupSummaryPanel({
  operatingModel,
  locationCount,
  locationPreview,
  method,
  startChoice,
  templateName,
  auditorItems,
  evidenceCount,
  onEdit,
  className,
}: Props) {
  const model = getOperatingModelCard(operatingModel);
  const methodLabel =
    CAPTURE_METHOD_OPTIONS.find((m) => m.value === method)?.title ?? "Not selected";
  const startLabel =
    startChoice === "template"
      ? templateName ?? "Template not selected"
      : startChoice === "csv"
        ? "Upload CSV"
        : startChoice === "custom"
          ? "Custom audit"
          : "Not selected";

  return (
    <aside
      className={`rounded-2xl border border-border bg-card p-5 shadow-sm ${className ?? ""}`}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="font-semibold">Your audit setup</h3>
        {onEdit ? (
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={onEdit}>
            Edit
          </Button>
        ) : null}
      </div>
      <div className="space-y-4">
        <SummaryRow icon={Store} label="Operating model" value={model?.title ?? "—"} />
        <SummaryRow
          icon={MapPin}
          label="Locations"
          value={
            locationCount
              ? `${locationCount} selected${locationPreview ? ` · ${locationPreview}` : ""}`
              : "None selected"
          }
        />
        <SummaryRow icon={Sparkles} label="Method" value={methodLabel} />
        <SummaryRow icon={Users} label="Template / data" value={startLabel} />
      </div>
      <div className="mt-5 border-t border-border pt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          What your auditor will fill
        </p>
        <AuditorFillPills items={auditorItems} compact />
        {evidenceCount > 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Evidence: {evidenceCount} required proof type{evidenceCount === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>
    </aside>
  );
}

export function MobileSetupSummary({
  operatingModel,
  locationCount,
  method,
  templateName,
}: {
  operatingModel: OperatingModel;
  locationCount: number;
  method: CaptureMethod;
  templateName?: string;
}) {
  const model = getOperatingModelCard(operatingModel);
  const methodLabel =
    CAPTURE_METHOD_OPTIONS.find((m) => m.value === method)?.title ?? "Method";
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground lg:hidden">
      <span>{model?.title ?? "Model"}</span>
      <span>{locationCount} location{locationCount === 1 ? "" : "s"}</span>
      <span>{methodLabel}</span>
      {templateName ? <span className="truncate">{templateName}</span> : null}
    </div>
  );
}
