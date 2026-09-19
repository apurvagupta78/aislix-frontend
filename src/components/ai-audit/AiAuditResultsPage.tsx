import { AiAuditIncompleteState } from "@/components/ai-audit/results/AiAuditIncompleteState";
import { AiAuditPlanogramView } from "@/components/ai-audit/results/AiAuditPlanogramView";
import { AiAuditShelfOnlyView } from "@/components/ai-audit/results/AiAuditShelfOnlyView";
import { buildAiAuditDisplayContext } from "@/lib/ai-audit/astra-display";
import type { ScanResult } from "@/lib/scan-results";

type Props = {
  data: ScanResult;
  imageUrl?: string | null;
};

/** Graphical AI audit results — planogram or shelf-only with full Astra metrics. */
export function AiAuditResultsPage({ data, imageUrl }: Props) {
  const ctx = buildAiAuditDisplayContext(data);

  if (!ctx.isComplete || ctx.viewKind === "incomplete") {
    const modeLabel =
      ctx.intendedViewKind === "planogram"
        ? "Planogram comparison"
        : "Shelf intelligence (image-only)";
    return (
      <AiAuditIncompleteState
        scanId={data.scan_id}
        reason={ctx.incompleteReason ?? "Structured Astra analysis is not available for this scan."}
        modeLabel={modeLabel}
      />
    );
  }

  if (ctx.viewKind === "planogram") {
    return <AiAuditPlanogramView data={data} ctx={ctx} imageUrl={imageUrl} />;
  }

  return <AiAuditShelfOnlyView data={data} ctx={ctx} imageUrl={imageUrl} />;
}
