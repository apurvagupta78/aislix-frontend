import { useMemo, useState } from "react";
import { ArrowRight, Download, Maximize2, Sparkles, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AI_DISCLAIMER } from "@/components/scan/ScanProgressPanel";
import { DemoScanResultsBody } from "@/components/scan/DemoScanResultsBody";
import { GuestDemoShell } from "@/components/scan/GuestDemoShell";
import { ScanContextPanel } from "@/components/scan/ScanContextPanel";
import {
  EMPTY_SCAN_CONTEXT,
  applyScanContext,
  type ScanContextState,
} from "@/lib/scan-context";
import type { ResultViewMode } from "@/lib/customer-context";
import { landingToScanResult } from "@/lib/demo-execution";
import type { LandingScanResult } from "@/lib/landing-scan-api";
import { trackLandingEvent } from "@/lib/landing-analytics";

type DemoRoleResultsPanelProps = {
  result: LandingScanResult;
  elapsedSec?: number | null;
  showWorkspaceCta?: boolean;
  onDownloadCsv?: () => void;
  onWorkspaceCta?: () => void;
  scanContext?: ScanContextState;
  onScanContextChange?: (ctx: ScanContextState) => void;
  defaultCategory?: string;
  defaultSubCategory?: string;
};

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
}: DemoRoleResultsPanelProps) {
  const [view, setView] = useState<ResultViewMode>("execution");
  const [fullscreen, setFullscreen] = useState(false);
  const [localContext, setLocalContext] = useState<ScanContextState>(EMPTY_SCAN_CONTEXT);

  const scanContext = scanContextProp ?? localContext;
  const setScanContext = onScanContextChange ?? setLocalContext;

  const data = useMemo(() => {
    const base = landingToScanResult(landing);
    return applyScanContext(base, scanContext);
  }, [landing, scanContext]);

  const panelBody = (
    <>
      <ScanContextPanel
        value={scanContext}
        onChange={setScanContext}
        defaultCategory={defaultCategory ?? landing.category}
        defaultSubCategory={defaultSubCategory}
        className="mb-3"
      />

      <DemoScanResultsBody
        data={data}
        view={view}
        onViewChange={setView}
        compact
        landingInventory={landing.inventory ?? []}
        showPlanogramStub={scanContext.planogramRows.length > 0}
      />

      <p className="mt-3 shrink-0 text-[11px] leading-relaxed text-muted-foreground">{AI_DISCLAIMER}</p>

      {landing.scans_daily_limit != null && (
        <p className="mt-2 shrink-0 text-xs text-muted-foreground">
          {landing.scans_used_today ?? 0} of {landing.scans_daily_limit} free demo scans used today
        </p>
      )}

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
        <Button
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          disabled={!onDownloadCsv}
          onClick={() => {
            trackLandingEvent("cta_click", { location: "download_csv" });
            onDownloadCsv?.();
          }}
        >
          <Download className="size-4" /> Download CSV
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
              Analysis completed in{" "}
              <span className="font-semibold text-foreground">{elapsedSec}s</span>
            </span>
          </div>
        )}

        <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
          <Badge className="gap-1.5 rounded-md bg-brand text-brand-foreground">
            <Sparkles className="size-3" /> Live AI analysis
          </Badge>
          {landing.scanned_at ? (
            <span className="text-[11px] text-muted-foreground">
              {new Date(landing.scanned_at).toLocaleString()}
            </span>
          ) : null}
        </div>

        {panelBody}
      </div>

      {fullscreen && (
        <GuestDemoShell
          title="Shelf execution report"
          description={[landing.category, landing.shelf_label].filter(Boolean).join(" · ") || "Demo scan"}
          onClose={() => setFullscreen(false)}
        >
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              {(landing.annotated_image_base64 || landing.original_image_base64) && (
                <img
                  src={
                    landing.annotated_image_base64
                      ? `data:${landing.annotated_image_mime || "image/jpeg"};base64,${landing.annotated_image_base64}`
                      : `data:${landing.original_image_mime || "image/jpeg"};base64,${landing.original_image_base64}`
                  }
                  alt="Analyzed shelf"
                  className="max-h-[70vh] w-full object-contain p-4"
                />
              )}
            </div>
            <div className="min-w-0">
              <ScanContextPanel
                value={scanContext}
                onChange={setScanContext}
                defaultCategory={defaultCategory ?? landing.category}
                defaultSubCategory={defaultSubCategory}
                className="mb-4"
              />
              <DemoScanResultsBody
                data={data}
                view={view}
                onViewChange={setView}
                landingInventory={landing.inventory ?? []}
                showPlanogramStub={scanContext.planogramRows.length > 0}
              />
            </div>
          </div>
        </GuestDemoShell>
      )}
    </>
  );
}
