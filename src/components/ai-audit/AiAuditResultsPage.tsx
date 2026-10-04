import { AiAuditIncompleteState } from "@/components/ai-audit/results/AiAuditIncompleteState";
import { AiAuditPlanogramView } from "@/components/ai-audit/results/AiAuditPlanogramView";
import { AiAuditShelfOnlyView } from "@/components/ai-audit/results/AiAuditShelfOnlyView";
import { LunaAnalysisCard, lunaAnalysisFromMetrics } from "@/components/ai-audit/results/LunaAnalysisCard";
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

  const luna = <LunaAnalysisCard analysis={lunaAnalysisFromMetrics(data.metrics)} className="mb-4" />;

  if (ctx.viewKind === "planogram") {
    return (
      <>
        {luna}
        <AiAuditPlanogramView data={data} ctx={ctx} imageUrl={imageUrl} />
      </>
    );
  }

  return (
    <>
      {luna}
      <AiAuditShelfOnlyView data={data} ctx={ctx} imageUrl={imageUrl} />
    </>
  );
}
