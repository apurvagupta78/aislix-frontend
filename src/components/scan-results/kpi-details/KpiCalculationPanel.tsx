import type { MouseEvent } from "react";
import { buildKpiCalculationPanelContent } from "@/lib/kpi-calculation-panel";
import type { KpiDetailsContext } from "@/lib/kpi-details-data";
import type { KpiMetric } from "@/lib/execution-metrics";
import type { AuditKpiId } from "@/lib/role-kpi-config";
import type { AuditKpiResult } from "@/lib/retail-intelligence";
import type { ScanResult } from "@/lib/scan-results";

export function KpiCalculationPanel({
  kpiId,
  result,
  metric,
  raw,
  ctx,
  className,
  onSummaryClick,
}: {
  kpiId: AuditKpiId;
  result: ScanResult;
  metric?: KpiMetric;
  raw?: AuditKpiResult;
  ctx?: KpiDetailsContext | null;
  className?: string;
  onSummaryClick?: (e: MouseEvent) => void;
}) {
  const content = buildKpiCalculationPanelContent(kpiId, result, metric, raw, ctx);

  return (
    <details className={className ?? "mt-3 group"}>
      <summary
        className="cursor-pointer text-[11px] font-medium text-brand hover:underline"
        onClick={onSummaryClick}
      >
        How is this calculated?
      </summary>
      <div className="mt-2 space-y-3 rounded-md border border-border/60 bg-muted/20 px-3 py-2.5">
        {content.demo_label ? (
          <p className="text-[10px] font-medium uppercase tracking-wide text-brand">
            Aislix Demo Data
          </p>
        ) : null}
        {content.sections.map((section) => (
          <div
            key={section.title}
            className="border-b border-border/40 pb-2.5 last:border-b-0 last:pb-0"
          >
            <p className="text-[9px] font-semibold uppercase tracking-wide text-foreground/70">
              {section.title}
            </p>
            <ul className="mt-1 space-y-0.5">
              {section.lines.map((line, i) => (
                <li
                  key={`${section.title}-${i}`}
                  className="text-[10px] leading-relaxed text-muted-foreground whitespace-pre-line"
                >
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="pt-0.5 text-[9px] italic text-muted-foreground/90">
          Deterministic calculation from audit data — not an AI-generated estimate.
        </p>
      </div>
    </details>
  );
}
