import { AlertTriangle, RefreshCw } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { AiAuditCard } from "@/components/ai-audit/results/AiAuditUi";

type Props = {
  scanId: string;
  reason: string;
  modeLabel: string;
};

export function AiAuditIncompleteState({ scanId, reason, modeLabel }: Props) {
  return (
    <div className="space-y-4">
      <AiAuditCard title="Analysis incomplete" description={modeLabel}>
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="rounded-full bg-amber-500/10 p-4">
            <AlertTriangle className="size-10 text-amber-600" />
          </div>
          <div className="max-w-lg space-y-2">
            <p className="text-sm font-medium text-foreground">{reason}</p>
            <p className="text-xs text-muted-foreground">
              Aislix requires the full structured Astra JSON response. Legacy inventory-only payloads
              cannot render the complete metrics dashboard.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild variant="default" size="sm" className="gap-1.5 rounded-xl">
              <Link to="/">
                <RefreshCw className="size-3.5" />
                Run a new scan
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <Link to="/results/debug" search={{ scan: scanId }}>
                Inspect raw payload
              </Link>
            </Button>
          </div>
        </div>
      </AiAuditCard>
    </div>
  );
}
