import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { trackEvent } from "@/lib/analytics";
import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { runScanAnalysis, SCAN_STAGES } from "@/lib/scan-api";
import { ScanProgressPanel } from "@/components/scan/ScanProgressPanel";
import { networkErrorMessage } from "@/lib/api-errors";

export const Route = createFileRoute("/processing")({
  validateSearch: (search: Record<string, unknown>): { scan?: string } => {
    const scan = search["scan"];
    return typeof scan === "string" && scan.length > 0 ? { scan } : {};
  },
  head: () => ({
    meta: [
      { title: "Analyzing retail image — Aislix" },
      {
        name: "description",
        content:
          "Aislix is identifying products, checking availability and placement, and preparing retail execution insights.",
      },
      { property: "og:title", content: "Analyzing your retail image — Aislix" },
      { property: "og:description", content: "Retail execution intelligence pipeline in progress." },
    ],
  }),
  component: Processing,
});

function Processing() {
  const { scan } = Route.useSearch();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!scan) {
      setError("Missing scan id. Start a new scan from the scan page.");
      return;
    }

    let cancelled = false;

    runScanAnalysis(scan)
      .then(() => {
        if (cancelled) return;
        setDone(true);
        trackEvent("scan_completed", { scan_id: scan });
        setTimeout(() => {
          navigate({ to: "/results", search: { scan } });
        }, 700);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(networkErrorMessage(err));
      });

    return () => {
      cancelled = true;
    };
  }, [navigate, scan]);


  return (
    <AppShell
      title="Processing scan"
      description={scan ? `Scan ${scan.slice(0, 8)}…` : "Analyzing retail image"}
    >
      <div className="mx-auto max-w-2xl">
        <div className="card-surface p-9 text-center">
          {error ? (
            <div className="space-y-4">
              <span className="mx-auto grid size-16 place-items-center rounded-full bg-destructive/10 text-destructive">
                <AlertTriangle className="size-7" />
              </span>
              <h2 className="text-xl font-semibold tracking-tight">Analysis failed</h2>
              <p className="text-sm text-muted-foreground">{error}</p>
              <div className="flex justify-center gap-2">
                <Button asChild variant="subtle" size="sm" className="rounded-xl">
                  <Link to="/scan">New scan</Link>
                </Button>
                {scan ? (
                  <Button
                    variant="brand"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => window.location.reload()}
                  >
                    Retry
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <>
              <div className="relative mx-auto grid size-28 place-items-center">
                <div className="absolute inset-0 animate-pulse rounded-full bg-brand-soft" />
                <div className="relative grid size-20 place-items-center rounded-full bg-gradient-brand shadow-card">
                  <Loader2 className="size-8 animate-spin text-brand-foreground" />
                </div>
              </div>
              <p className="mt-7 text-sm text-muted-foreground">
                Aislix is identifying products, checking availability and placement, and preparing
                your retail execution insights.
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight">
                {done ? "Analysis complete" : "Analyzing your retail image"}
              </h2>
              <div className="mt-8 text-left">
                <ScanProgressPanel
                  active={!done}
                  done={done}
                  expectedMs={120_000}
                  stages={SCAN_STAGES}
                  showStageList
                  timingMessage={
                    done
                      ? "Opening your scan results…"
                      : "This may take a few minutes for larger or more complex images. Please keep this page open."
                  }
                />
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
