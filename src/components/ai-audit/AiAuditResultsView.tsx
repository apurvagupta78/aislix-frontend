import { useMemo, useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { AstraComparisonResults } from "@/components/ai-audit/AstraComparisonResults";
import { DemoScanResultsBody } from "@/components/scan/DemoScanResultsBody";
import { ScanResultsHeaderBar } from "@/components/scan/ScanResultsHeaderBar";
import { Button } from "@/components/ui/button";
import { landingToScanResult } from "@/lib/demo-execution";
import { downloadAstraComparisonCsv } from "@/lib/ai-audit/astra-comparison-export";
import { astraAnalysisFromScanResult, normalizeAstraAnalysis } from "@/lib/ai-audit/astra-response";
import { downloadLandingCsv, type LandingScanResult } from "@/lib/landing-scan-api";
import { downloadObservedProductsCsv } from "@/lib/observed-products-export";
import { defaultAuditRoleTab, type AuditRoleTab } from "@/lib/role-audit-ui";
import { enrichScanResult, type ScanContextState } from "@/lib/scan-context";
import type { ScanResult } from "@/lib/scan-results";

type Props = {
  scanResult?: ScanResult | null;
  landingResult?: LandingScanResult | null;
  scanContext: ScanContextState;
  assignmentId?: string;
  previewImageUrl?: string | null;
};

function downloadAuthenticatedCsv(result: ScanResult) {
  if (result.downloads?.csv_url) {
    const a = document.createElement("a");
    a.href = result.downloads.csv_url;
    a.download = `aislix-${result.scan_id}-report.csv`;
    a.click();
    return;
  }
  downloadObservedProductsCsv(result);
}

export function AiAuditResultsView({
  scanResult,
  landingResult,
  scanContext,
  assignmentId,
  previewImageUrl,
}: Props) {
  const [activeRole, setActiveRole] = useState<AuditRoleTab>(() =>
    defaultAuditRoleTab(scanContext.auditRole),
  );

  const data = useMemo(() => {
    if (scanResult) return enrichScanResult(scanResult, scanContext);
    if (landingResult) {
      const base = landingToScanResult(landingResult);
      return enrichScanResult(base, scanContext);
    }
    return null;
  }, [scanResult, landingResult, scanContext]);

  if (!data) return null;

  const imageUrl =
    data.annotated_image_url ??
    data.original_image_url ??
    previewImageUrl ??
    null;

  function handleDownloadCsv() {
    try {
      const astraAnalysis = data
        ? astraAnalysisFromScanResult(data)
        : landingResult
          ? normalizeAstraAnalysis(landingResult)
          : { mode: "shelf_only" as const };
      if (astraAnalysis.mode !== "shelf_only") {
        downloadAstraComparisonCsv(astraAnalysis, data?.scan_id ?? landingResult?.scan_id ?? "audit");
      } else if (landingResult?.csv_base64) {
        downloadLandingCsv(landingResult);
      } else if (scanResult) {
        downloadAuthenticatedCsv(scanResult);
      } else {
        downloadObservedProductsCsv(data!);
      }
      toast.success("CSV downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not download CSV.");
    }
  }

  return (
    <div className="space-y-4">
      <ScanResultsHeaderBar
        timestamp={data.created_at}
        assignmentId={assignmentId}
      />
      <AstraComparisonResults result={data} />
      <DemoScanResultsBody
        data={data}
        activeRole={activeRole}
        onRoleChange={setActiveRole}
        compact
        imageUrl={imageUrl}
        demoMode={Boolean(landingResult)}
      />
      <div className="flex flex-wrap gap-2 rounded-xl border border-[var(--aislix-border)] bg-[var(--aislix-surface)]/40 p-4">
        <Button type="button" variant="brand" size="sm" onClick={handleDownloadCsv}>
          <Download className="size-4" /> Download CSV
        </Button>
        {data.scan_id ? (
          <Button type="button" variant="outline" size="sm" asChild>
            <Link to="/results" search={{ scan: data.scan_id }}>
              <ExternalLink className="size-4" /> Open full report
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
