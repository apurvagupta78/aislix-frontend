import { AlertTriangle, ScanLine } from "lucide-react";

import { PlanogramModeOption } from "@/components/planogram/PlanogramModeOption";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { NewAuditPlanogramChoice } from "@/lib/new-audit/planogram-setup";
import { cn } from "@/lib/utils";

type Props = {
  value: NewAuditPlanogramChoice | null;
  onChange: (value: NewAuditPlanogramChoice) => void;
  showCostNotice?: boolean;
  className?: string;
};

export function AiPlanogramChoice({
  value,
  onChange,
  showCostNotice = true,
  className,
}: Props) {
  return (
    <div className={cn("space-y-4", className)}>
      {showCostNotice ? (
        <Alert className="border-[var(--aislix-darkstore-border)] bg-[var(--aislix-darkstore-bg)]">
          <AlertTriangle className="size-4 text-[var(--aislix-primary)]" />
          <AlertDescription className="text-sm text-[var(--aislix-primary)]">
            AI audits use additional vision processing —{" "}
            <strong>this will cost more</strong> than a standard digital audit.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <PlanogramModeOption
          label="With planogram"
          detail="Upload your planogram CSV or configure the shelf manually."
          selected={value === "with_demo"}
          recommended
          onClick={() => onChange("with_demo")}
        />
        <PlanogramModeOption
          label="Without planogram"
          detail="Analyse the visible shelf without an expected layout."
          selected={value === "without"}
          onClick={() => onChange("without")}
        />
      </div>

      {value === "without" ? (
        <div className="flex items-start gap-3 rounded-xl border border-[var(--aislix-border)] bg-[var(--aislix-surface)]/50 p-4">
          <ScanLine className="mt-0.5 size-5 shrink-0 text-[var(--aislix-secondary)]" />
          <p className="text-xs text-[var(--aislix-secondary)]">
            AI will identify products and issues from photos without a reference planogram.
          </p>
        </div>
      ) : null}
    </div>
  );
}
