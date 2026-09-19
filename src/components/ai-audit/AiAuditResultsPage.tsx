import { AiAuditExpectedProductsView } from "@/components/ai-audit/results/AiAuditExpectedProductsView";
import { AiAuditPlanogramView } from "@/components/ai-audit/results/AiAuditPlanogramView";
import { AiAuditShelfOnlyView } from "@/components/ai-audit/results/AiAuditShelfOnlyView";
import { buildAiAuditDisplayContext } from "@/lib/ai-audit/astra-display";
import type { ScanResult } from "@/lib/scan-results";

type Props = {
  data: ScanResult;
  imageUrl?: string | null;
};

/** Graphical AI audit results — routes by Astra output shape. */
export function AiAuditResultsPage({ data, imageUrl }: Props) {
  const ctx = buildAiAuditDisplayContext(data);

  switch (ctx.viewKind) {
    case "planogram":
      return <AiAuditPlanogramView data={data} ctx={ctx} imageUrl={imageUrl} />;
    case "expected_products":
      return <AiAuditExpectedProductsView data={data} ctx={ctx} imageUrl={imageUrl} />;
    case "shelf_only":
    default:
      return <AiAuditShelfOnlyView data={data} ctx={ctx} imageUrl={imageUrl} />;
  }
}
