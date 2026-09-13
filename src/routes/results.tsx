import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { markScanNotificationsRead } from "@/lib/notifications";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  IndianRupee,
  Loader2,
  RefreshCw,
  ScanLine,
} from "lucide-react";
import { fetchScanAssignmentId } from "@/lib/assignments";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { ScanResultsHeaderBar } from "@/components/scan/ScanResultsHeaderBar";
import { isDemoOralCareContext } from "@/lib/demo-oral-care-planogram";
import { EmptyState, ErrorState } from "@/components/States";
import { FixRescanVerifyPanel } from "@/components/scan-results/FixRescanVerifyPanel";
import { ScanResultsActionsFooter } from "@/components/scan/ScanResultsActionsFooter";
import { AI_DISCLAIMER } from "@/components/scan/ScanProgressPanel";
import { planHasFeature } from "@/lib/plan-features";
import { fetchUsageSummary } from "@/lib/subscription-limits";
import { useWorkspaceContext } from "@/hooks/use-customer-context";
import { defaultAuditRoleTab, type AuditRoleTab } from "@/lib/role-audit-ui";
import { ScanContextPanel } from "@/components/scan/ScanContextPanel";
import { ScanResultsBody } from "@/components/scan/DemoScanResultsBody";
import {
  EMPTY_SCAN_CONTEXT,
  enrichScanResultForDisplay,
  hasActiveScanContext,
  loadStoredScanContext,
  saveStoredScanContext,
  type ScanContextState,
} from "@/lib/scan-context";
import { ProcessingState, ScanResultHeader } from "@/components/scan-results/ResultHeader";
import { fetchScanResult } from "@/lib/scan-results";
import { retryScanAnalysis } from "@/lib/scan-api";
import { networkErrorMessage, sanitizeUserMessage } from "@/lib/api-errors";
import { fetchPlanogramComparison } from "@/lib/planogram-compliance";

export const Route = createFileRoute("/results")({
  validateSearch: (search: Record<string, unknown>): { scan?: string } => {
    const scan = search["scan"];
    return typeof scan === "string" && scan.length > 0 ? { scan } : {};
  },
  head: () => ({
    meta: [
      { title: "Shelf Execution Report — Aislix" },
      {
        name: "description",
        content:
          "Shelf execution score, action center, share of shelf, planogram compliance and SKU availability for a single Aislix shelf audit.",
      },
      { property: "og:title", content: "Shelf execution report — Aislix" },
      {
        property: "og:description",
        content: "Execution-first shelf audit: score, KPIs, actions, inventory and planogram compliance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Results,
});

function Results() {
  const { scan } = Route.useSearch();
  const navigate = useNavigate();
  const workspace = useWorkspaceContext();

  const query = useQuery({
    queryKey: ["scan-result", scan],
    queryFn: ({ signal }) => fetchScanResult(scan!, signal),
    enabled: !!scan,
    retry: 1,
    staleTime: 30_000,
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      return status === "processing" || status === "queued" ? 4000 : false;
    },
  });

  const scanStatus = query.data?.status;
  const comparisonQuery = useQuery({
    queryKey: ["planogram-comparison", scan],
    queryFn: () => fetchPlanogramComparison(scan!),
    enabled: Boolean(scan) && scanStatus === "completed",
    retry: false,
  });
  const comparison = comparisonQuery.data ?? null;

  const assignmentQuery = useQuery({
    queryKey: ["scan-assignment-id", scan],
    queryFn: () => fetchScanAssignmentId(scan!),
    enabled: Boolean(scan),
    retry: false,
  });
  const queryClient = useQueryClient();

  // Viewing a scan's results acknowledges its bell notifications.
  useEffect(() => {
    if (!scan) return;
    void markScanNotificationsRead(scan).then(() => {
      void queryClient.invalidateQueries({ queryKey: ["inbox"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
    });
  }, [scan, queryClient]);

  const data = query.data;
  const loading = !!scan && query.isPending;
  const processing = data?.status === "processing" || data?.status === "queued";
  const usageQuery = useQuery({
    queryKey: ["org-usage"],
    queryFn: () => fetchUsageSummary(),
    retry: false,
    staleTime: 60_000,
  });
  const planCode = usageQuery.data?.plan_code ?? "free";
  const financialLocked =
    !usageQuery.data?.platform_bypass && !planHasFeature(planCode, "financial_impact");

  const [roleOverride, setRoleOverride] = useState<AuditRoleTab | undefined>();
  const [scanContext, setScanContext] = useState<ScanContextState>(() => loadStoredScanContext());
  const [showOptionalPricing, setShowOptionalPricing] = useState(false);
  const assignmentId = assignmentQuery.data ?? null;
  const scanHadPlanogram = Boolean(data?.planogram?.requested || assignmentId);
  const allowClientPlanogram = scanHadPlanogram || showOptionalPricing;

  useEffect(() => {
    if (!scan || scanHadPlanogram) return;
    setShowOptionalPricing(false);
    setScanContext(EMPTY_SCAN_CONTEXT);
    saveStoredScanContext(EMPTY_SCAN_CONTEXT);
  }, [scan, scanHadPlanogram]);

  const activeRole =
    roleOverride ??
    defaultAuditRoleTab(scanContext.auditRole ?? workspace.customerType);
  const display = useMemo(
    () =>
      data
        ? enrichScanResultForDisplay(data, scanContext, { allowClientPlanogram })
        : undefined,
    [data, scanContext, allowClientPlanogram],
  );
  const imageUrl = data?.annotated_image_url ?? data?.original_image_url ?? undefined;

  const goToScan = (id?: string | null) => {
    if (!id) return;
    navigate({ to: "/results", search: { scan: id } });
  };

  return (
    <AppShell
      title="Scan results"
      description={
        data
          ? [data.scan_id, data.store, data.aisle].filter(Boolean).join(" · ")
          : "AI breakdown of a single shelf scan."
      }
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="subtle"
            size="sm"
            className="rounded-xl"
            disabled={!data?.navigation?.previous_scan_id}
            onClick={() => goToScan(data?.navigation?.previous_scan_id)}
          >
            <ArrowLeft className="size-4" /> Previous
          </Button>
          <Button
            variant="subtle"
            size="sm"
            className="rounded-xl"
            disabled={!data?.navigation?.next_scan_id}
            onClick={() => goToScan(data?.navigation?.next_scan_id)}
          >
            Next <ArrowRight className="size-4" />
          </Button>
          <Button asChild variant="subtle" size="sm" className="rounded-xl">
            <Link to="/compare" search={scan ? { a: scan } : {}}>
              Compare
            </Link>
          </Button>
          <Button asChild variant="subtle" size="sm" className="rounded-xl">
            <Link to="/history">Scan history</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="rounded-xl">
            <Link to="/dashboard">Dashboard</Link>
          </Button>
        </div>
      }
    >
      {!scan ? (
        <EmptyState
          icon={<ScanLine className="size-5" />}
          title="No scan selected"
          description="Open a scan from your history, or run a new shelf scan to see results here."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild variant="brand" size="sm" className="rounded-xl">
                <Link to="/scan">Start a new scan</Link>
              </Button>
              <Button asChild variant="subtle" size="sm" className="rounded-xl">
                <Link to="/history">Browse scan history</Link>
              </Button>
            </div>
          }
        />
      ) : query.isError ? (
        <ErrorState
          title="Couldn't load this scan"
          description={
            query.error instanceof Error
              ? sanitizeUserMessage(query.error.message)
              : "We couldn't load this scan right now. Please try again."
          }
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <div className="space-y-4">
          {(loading || processing) && (
            <ScanResultHeader
              data={data}
              loading={loading}
              assignmentId={assignmentQuery.data ?? null}
            />
          )}

          {data?.status === "failed" ? (
            <FailedState scanId={data.scan_id} onRetried={() => void query.refetch()} />
          ) : processing ? (
            <ProcessingState scanId={data?.scan_id} />
          ) : (
            <>
              {assignmentQuery.data && (
                <FixRescanVerifyPanel
                  assignmentId={assignmentQuery.data}
                  scanId={data?.scan_id}
                />
              )}

              {!scanHadPlanogram &&
              (showOptionalPricing || hasActiveScanContext(scanContext)) ? (
                <div className="mb-4 overflow-hidden rounded-2xl border border-border bg-surface">
                  <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
                    <div className="flex items-center gap-2">
                      <IndianRupee className="size-4 text-muted-foreground" />
                      <p className="text-sm font-medium">Optional products &amp; prices</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-lg text-xs"
                      onClick={() => {
                        setShowOptionalPricing(false);
                        setScanContext(EMPTY_SCAN_CONTEXT);
                        saveStoredScanContext(EMPTY_SCAN_CONTEXT);
                      }}
                    >
                      Hide
                    </Button>
                  </div>
                  <ScanContextPanel
                    value={scanContext}
                    onChange={(next) => {
                      setScanContext(next);
                      saveStoredScanContext(next);
                    }}
                    defaultCategory={data?.scan_category ?? ""}
                    defaultSubCategory={data?.scan_sub_category ?? ""}
                    defaultLocation={data?.location ?? data?.aisle ?? ""}
                    defaultOpen
                    embedded
                  />
                </div>
              ) : !scanHadPlanogram ? (
                <div className="mb-4 flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setShowOptionalPricing(true)}
                  >
                    <IndianRupee className="size-4" /> Add optional products &amp; prices
                  </Button>
                </div>
              ) : null}

              {display && (
                <div className="flex min-h-0 flex-col">
                  <ScanResultsHeaderBar
                    timestamp={data?.created_at}
                    showDemoPlanogramBadge={isDemoOralCareContext(scanContext)}
                    assignmentId={assignmentId}
                  />
                  <ScanResultsBody
                    data={display}
                    rawData={data}
                    activeRole={activeRole}
                    onRoleChange={setRoleOverride}
                    loading={loading}
                    planogramComparison={comparison}
                    financialLocked={financialLocked}
                    planCode={planCode}
                    imageUrl={imageUrl}
                  />
                  <ScanResultsActionsFooter
                    data={display}
                    loading={loading}
                    activeRole={activeRole}
                    hasWorkspace
                  />
                  <p className="mt-3 shrink-0 text-[11px] leading-relaxed text-muted-foreground">
                    {AI_DISCLAIMER}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </AppShell>
  );
}

function FailedState({ scanId, onRetried }: { scanId: string; onRetried: () => void }) {
  const [retrying, setRetrying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const retry = async () => {
    setRetrying(true);
    setMessage(null);
    try {
      await retryScanAnalysis(scanId);
      onRetried();
    } catch (error) {
      setMessage(networkErrorMessage(error));
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      role="alert"
      className="card-surface flex flex-col items-center gap-4 px-6 py-14 text-center"
    >
      <span className="grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="size-5" />
      </span>
      <div>
        <h2 className="text-base font-semibold tracking-tight">This scan failed to process</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          The uploaded images are safe in storage. Retrying re-runs the AI analysis without
          re-uploading anything.
        </p>
        {message && <p className="mt-3 text-sm text-destructive">{message}</p>}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          variant="brand"
          size="sm"
          className="rounded-xl"
          onClick={() => void retry()}
          disabled={retrying}
        >
          {retrying ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          {retrying ? "Retrying analysis" : "Retry analysis"}
        </Button>
        <Button asChild variant="subtle" size="sm" className="rounded-xl">
          <Link to="/scan">Start a new scan</Link>
        </Button>
      </div>
    </div>
  );
}
