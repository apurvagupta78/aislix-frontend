import { useEffect, useRef } from "react";

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

const CARD_TONES = ["purple", "blue", "pink", "green", "cyan"] as const;

/** Colours every result card in page order so no two neighbouring cards share a tint. */
function useCardTones(viewKind: string) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const paint = () => {
      const cards = [...root.querySelectorAll<HTMLElement>("[data-ai-card]")].filter(
        (card) => !card.querySelector("[data-ai-tile], [data-mp-tile]"),
      );
      cards.forEach((card, i) => {
        const tone = CARD_TONES[i % CARD_TONES.length]!;
        if (card.dataset.tone !== tone) card.dataset.tone = tone;
      });
    };
    paint();
    const observer = new MutationObserver(paint);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [viewKind]);
  return ref;
}

/** Graphical AI audit results — planogram or shelf-only with full Astra metrics. */
export function AiAuditResultsPage({ data, imageUrl }: Props) {
  const ctx = buildAiAuditDisplayContext(data);
  const tonesRef = useCardTones(ctx.isComplete ? ctx.viewKind : "incomplete");

  if (!ctx.isComplete || ctx.viewKind === "incomplete") {
    const modeLabel =
      ctx.intendedViewKind === "planogram"
        ? "Planogram comparison"
        : "Shelf intelligence (image-only)";
    return (
      <AiAuditIncompleteState
        scanId={data.scan_id}
        reason={ctx.incompleteReason ?? "The structured AI analysis is not available for this scan."}
        modeLabel={modeLabel}
      />
    );
  }

  const luna = <LunaAnalysisCard analysis={lunaAnalysisFromMetrics(data.metrics)} className="mb-4" />;

  return (
    <div ref={tonesRef} className="ai-tinted">
      {luna}
      {ctx.viewKind === "planogram" ? (
        <AiAuditPlanogramView data={data} ctx={ctx} imageUrl={imageUrl} />
      ) : (
        <AiAuditShelfOnlyView data={data} ctx={ctx} imageUrl={imageUrl} />
      )}
    </div>
  );
}
