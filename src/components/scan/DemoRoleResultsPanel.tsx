import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Maximize2, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScanResultsHeaderBar } from "@/components/scan/ScanResultsHeaderBar";
import { AI_DISCLAIMER } from "@/components/scan/ScanProgressPanel";
import { DemoScanResultsBody } from "@/components/scan/DemoScanResultsBody";
import { GuestDemoShell } from "@/components/scan/GuestDemoShell";
import {
  EMPTY_SCAN_CONTEXT,
  enrichScanResult,
  type ScanContextState,
} from "@/lib/scan-context";
import { isDemoOralCareContext } from "@/lib/demo-oral-care-planogram";
import { defaultAuditRoleTab, type AuditRoleTab } from "@/lib/role-audit-ui";
import { landingToScanResult } from "@/lib/demo-execution";
import type { LandingScanResult } from "@/lib/landing-audit-api";
import { trackLandingEvent } from "@/lib/landing-analytics";
import { ScanResultsActionsFooter } from "@/components/scan/ScanResultsActionsFooter";
import { parseDemoAllowance } from "@/lib/demo-allowance";

type DemoRoleResultsPanelProps = {
  result: LandingScanResult;
  elapsedSec?: number | null;
  showWorkspaceCta?: boolean;
  /** @deprecated — panel builds full CSV from enriched scan data internally */
  onDownloadCsv?: () => void;
  onWorkspaceCta?: () => void;
  scanContext?: ScanContextState;
  onScanContextChange?: (ctx: ScanContextState) => void;
  defaultCategory?: string;
  defaultSubCategory?: string;
  previewImageUrl?: string | null;
};

function landingImageUrl(landing: LandingScanResult): string | null {
  if (landing.annotated_image_base64) {
    return `data:${landing.annotated_image_mime || "image/jpeg"};base64,${landing.annotated_image_base64}`;
  }
  if (landing.original_image_base64) {
    return `data:${landing.original_image_mime || "image/jpeg"};base64,${landing.original_image_base64}`;
  }
  return null;
}

export function DemoRoleResultsPanel({
  result: landing,
  elapsedSec,
  showWorkspaceCta = false,
  onDownloadCsv,
  onWorkspaceCta,
  scanContext: scanContextProp,
  onScanContextChange,
  defaultCategory,
  defaultSubCategory,
  previewImageUrl,
}: DemoRoleResultsPanelProps) {
  const [localContext, setLocalContext] = useState<ScanContextState>(EMPTY_SCAN_CONTEXT);
  const scanContext = scanContextProp ?? localContext;
  const [activeRole, setActiveRole] = useState<AuditRoleTab>(() =>
    defaultAuditRoleTab(scanContext.auditRole),
  );
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (scanContext.auditRole) {
      setActiveRole(defaultAuditRoleTab(scanContext.auditRole));
    }
  }, [scanContext.auditRole]);
  const setScanContext = onScanContextChange ?? setLocalContext;

  const baseResult = useMemo(() => landingToScanResult(landing), [landing]);
  const data = useMemo(
    () => enrichScanResult(baseResult, scanContext),
    [baseResult, scanContext],
  );

  const imageUrl =
    data.annotated_image_url ?? data.original_image_url ?? previewImageUrl ?? landingImageUrl(landing);

  const panelBody = (
    <>
      <DemoScanResultsBody
        data={data}
        rawData={baseResult}
        activeRole={activeRole}
        onRoleChange={setActiveRole}
        compact={!fullscreen}
        demoMode
        imageUrl={imageUrl ?? undefined}
      />

      <ScanResultsActionsFooter
        data={data}
        demoMode
        activeRole={activeRole}
        landingSessionId={landing.landing_session_id}
        landingSnapshot={landing}
        demoAllowance={parseDemoAllowance(landing)}
      />

      <p className="mt-3 shrink-0 text-[11px] leading-relaxed text-muted-foreground">{AI_DISCLAIMER}</p>

      <div className="mt-3 flex shrink-0 flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          onClick={() => {
            trackLandingEvent("cta_click", { location: "fullscreen_demo" });
            setFullscreen(true);
          }}
        >
          <Maximize2 className="size-4" /> Fullscreen
        </Button>
        {showWorkspaceCta ? (
          <Button
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => {
              trackLandingEvent("cta_click", { location: "create_workspace" });
              onWorkspaceCta?.();
            }}
          >
            Create your workspace <ArrowRight className="size-4" />
          </Button>
        ) : null}
      </div>
    </>
  );

  return (
    <>
      <div className="flex min-h-0 flex-col">
        {elapsedSec != null && (
          <div className="mb-3 flex shrink-0 items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
            <Timer className="size-3.5 text-brand" />
            <span>
              AI Audit Complete ·{" "}
              <span className="font-semibold text-foreground">{elapsedSec}s</span>
            </span>
          </div>
        )}

        <ScanResultsHeaderBar
          timestamp={landing.audited_at}
          showDemoPlanogramBadge={isDemoOralCareContext(scanContext)}
        />

        {panelBody}
      </div>

      {fullscreen && (
        <GuestDemoShell
          title="Shelf execution report"
          description={[landing.category, landing.shelf_label].filter(Boolean).join(" · ") || "Demo audit"}
          onClose={() => setFullscreen(false)}
        >
          <div className="mx-auto max-w-6xl space-y-4">
            <DemoScanResultsBody
              data={data}
              rawData={baseResult}
              activeRole={activeRole}
              onRoleChange={setActiveRole}
              imageUrl={imageUrl ?? undefined}
              demoMode
            />
            <ScanResultsActionsFooter
              data={data}
              demoMode
              activeRole={activeRole}
              landingSessionId={landing.landing_session_id}
              landingSnapshot={landing}
              demoAllowance={parseDemoAllowance(landing)}
            />
          </div>
        </GuestDemoShell>
      )}
    </>
  );
}
