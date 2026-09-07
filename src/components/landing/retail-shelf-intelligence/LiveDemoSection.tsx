import { Fragment, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, ChevronDown, ChevronRight, Download, ImagePlus, Loader2, Sparkles } from "lucide-react";
import { rollupByBrand } from "@/lib/brand-rollup";
import { averageConfidencePercent, displayVariant, uniqueSkuCount } from "@/lib/landing-inventory";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trackLandingEvent } from "@/lib/landing-analytics";
import {
  DEFAULT_SAMPLE_ID,
  DEFAULT_SAMPLE_IMAGE,
  downloadLandingCsv,
  loadLandingSessionId,
  persistLandingSession,
  runLandingSample,
  runLandingUpload,
  type LandingScanResult,
} from "@/lib/landing-scan-api";
import {
  FALLBACK_SAMPLES,
  fetchLandingSamples,
  sampleImageUrl,
  type LandingSample,
} from "@/lib/landingSamples";
import { AI_DISCLAIMER, ScanProgressPanel } from "@/components/scan/ScanProgressPanel";
import { TopBrandsByShelfShare } from "@/components/scan/TopBrandsByShelfShare";
import {
  DemoCategoryPicker,
  DEFAULT_DEMO_CATEGORY,
  DEFAULT_DEMO_SUBCATEGORY,
  EMPTY_DEMO_CATEGORY_STATE,
  useDemoCategory,
} from "@/components/scan/DemoCategoryPicker";

import { SectionHeading } from "./shared";
import { networkErrorMessage } from "@/lib/api-errors";

type Phase = "idle" | "scanning" | "done" | "error";

const MAX_BYTES = 10 * 1024 * 1024;
const MIN_SCAN_MS = 6_000;
const SAMPLE_TIMING_MESSAGE = "Sample shelves finish in seconds.";
const UPLOAD_TIMING_MESSAGE =
  "Live scans usually take 1–3 minutes. Keep this page open. Complex shelves may take up to 4 minutes.";

function annotatedSrc(result: LandingScanResult): string | null {
  if (result.annotated_image_base64) {
    return `data:${result.annotated_image_mime || "image/jpeg"};base64,${result.annotated_image_base64}`;
  }
  if (result.original_image_base64) {
    return `data:${result.original_image_mime || "image/jpeg"};base64,${result.original_image_base64}`;
  }
  return null;
}

export function LiveDemoSection({
  onResult,
  showWorkspaceCta = false,
  homepageIntro = false,
}: {
  onResult?: (result: LandingScanResult, imageUrl: string | null) => void;
  showWorkspaceCta?: boolean;
  homepageIntro?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const demoCategory = useDemoCategory();
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(DEFAULT_SAMPLE_IMAGE);
  const [result, setResult] = useState<LandingScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isSampleFlow, setIsSampleFlow] = useState(true);
  const [sampleId, setSampleId] = useState(DEFAULT_SAMPLE_ID);
  const [scanMode, setScanMode] = useState<"sample" | "upload">("sample");
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const samplesQuery = useQuery({
    queryKey: ["landing-samples"],
    queryFn: fetchLandingSamples,
    staleTime: 30 * 60_000,
    retry: false,
  });
  const samples: LandingSample[] = samplesQuery.data?.length ? samplesQuery.data : FALLBACK_SAMPLES;


  useEffect(() => {
    setPreviewImageUrl(DEFAULT_SAMPLE_IMAGE);
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  async function run(mode: "sample" | "upload", file?: File, overrideSampleId?: string) {
    setError(null);
    setErrorStatus(null);
    setResult(null);
    setScanMode(mode);
    setPhase("scanning");
    trackLandingEvent("demo_scan_started", { mode });

    // Keep the progress UI visible long enough to read — the analysis is real,
    // but a fast response should never look pre-recorded.
    const minVisible = new Promise<void>((resolve) => setTimeout(resolve, MIN_SCAN_MS));

    try {
      const [scan] = await Promise.all([
        mode === "sample"
          ? runLandingSample(overrideSampleId ?? sampleId, loadLandingSessionId() ?? undefined)
          : file
            ? runLandingUpload(file, {
              ...demoCategory.context,
              landingSessionId: loadLandingSessionId() ?? undefined,
            })
            : Promise.resolve(null),
        minVisible,
      ]);
      if (!scan) throw new Error("Choose a shelf photo to continue.");
      setResult(scan);
      persistLandingSession(scan);
      setPhase("done");
      trackLandingEvent("demo_scan_completed", {
        scan_id: scan.scan_id,
        landing_session_id: scan.landing_session_id,
      });
      onResult?.(scan, annotatedSrc(scan));
    } catch (err) {
      await minVisible;
      const status = (err as { status?: number }).status ?? null;
      setErrorStatus(status);
      setError(networkErrorMessage(err));
      setPhase("error");
      trackLandingEvent("demo_scan_failed");
    }
  }


  function selectSample(id: string) {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setSampleId(id);
    setPendingFile(null);
    setIsSampleFlow(true);
    setResult(null);
    setError(null);
    setErrorStatus(null);
    setPhase("idle");
    setPreviewImageUrl(sampleImageUrl(id));
  }

  function onSample(id: string = sampleId) {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPendingFile(null);
    setIsSampleFlow(true);
    setSampleId(id);
    setPreviewImageUrl(sampleImageUrl(id));
    demoCategory.setState({
      categoryName: DEFAULT_DEMO_CATEGORY,
      subId: DEFAULT_DEMO_SUBCATEGORY,
      customSub: "",
    });
    void run("sample", undefined, id);
  }

  function onFile(file: File) {
    if (!/^image\/(jpeg|png)$/.test(file.type)) {
      setError("Please upload a JPEG or PNG shelf photo.");
      setPhase("error");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image is larger than 10MB. Please upload a smaller photo.");
      setPhase("error");
      return;
    }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setPreviewImageUrl(url);
    // Switching to the upload flow: the visitor picks their own shelf type.
    setPendingFile(file);
    setIsSampleFlow(false);
    setError(null);
    setErrorStatus(null);
    setPhase("idle");
    demoCategory.setState(EMPTY_DEMO_CATEGORY_STATE);
    pickerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const shownImage = phase === "done" && result ? (annotatedSrc(result) ?? previewImageUrl) : previewImageUrl;
  const scanning = phase === "scanning";

  return (
    <section
      id={homepageIntro ? "start-scanning" : "demo"}
      className="scroll-mt-16 bg-surface py-16 sm:py-20"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          title={homepageIntro ? "See What AI Sees on Every Shelf." : "See What Aislix Sees"}
          subtitle={
            homepageIntro
              ? "Aislix analyzes a single shelf photo to identify products, brands, stock gaps and placement issues — giving your retail team the intelligence to act faster."
              : "Try a real shelf scan — no login required."
          }
          {...(homepageIntro ? {} : { eyebrow: "Live demo" })}
          className={homepageIntro ? "max-w-3xl" : undefined}
        />

        <p className="mt-4 text-center text-xs text-muted-foreground sm:text-sm">
          No signup required for demo · Sample scan in seconds · Upload your shelf in ~2 min
        </p>

        {isSampleFlow && samples.length > 1 ? (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {samples.map((sample) => (
              <button
                key={sample.id}
                type="button"
                disabled={scanning}
                aria-pressed={sample.id === sampleId}
                onClick={() => selectSample(sample.id)}
                className={
                  sample.id === sampleId
                    ? "rounded-full border border-brand bg-brand/10 px-4 py-1.5 text-xs font-medium text-brand"
                    : "rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"
                }
              >
                {sample.label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {isSampleFlow ? (
            <>
              <Button
                size="xl"
                variant="default"
                className="min-h-11 w-full sm:w-auto"
                disabled={scanning}
                onClick={() => onSample()}
              >
                <Sparkles className="size-4" /> Try sample shelf scan
              </Button>
              <Button
                variant="ghost"
                size="xl"
                className="min-h-11 w-full text-muted-foreground sm:w-auto"
                disabled={scanning}
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus className="size-4" /> Or upload your shelf
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="xl"
                className="min-h-11 w-full sm:w-auto"
                disabled={scanning}
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus className="size-4" /> Change Photo
              </Button>
              <Button
                size="xl"
                className="min-h-11 w-full sm:w-auto"
                disabled={scanning || !demoCategory.ready}
                onClick={() => void run("upload", pendingFile!)}
              >
                <Sparkles className="size-4" /> Scan my shelf
              </Button>
              <Button
                variant="ghost"
                size="xl"
                className="min-h-11 w-full text-muted-foreground sm:w-auto"
                disabled={scanning}
                onClick={() => selectSample(DEFAULT_SAMPLE_ID)}
              >
                Back to sample shelf
              </Button>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) onFile(f);
            }}
          />
        </div>

        {!isSampleFlow ? (
          <div ref={pickerRef} className="mt-6">
            <DemoCategoryPicker
              state={demoCategory.state}
              onChange={demoCategory.setState}
              categories={demoCategory.categories}
              disabled={scanning}
            />
            {pendingFile && !demoCategory.ready ? (
              <p className="mt-2 text-center text-xs text-destructive">
                Select a category and sub-category before uploading.
              </p>
            ) : null}
          </div>
        ) : null}



        <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card shadow-lift lg:grid lg:grid-cols-[55fr_45fr] lg:divide-x lg:divide-border">
          {/* Shelf image */}
          <div className="relative grid min-h-80 h-full place-items-center overflow-hidden bg-surface lg:min-h-[600px]">
            {shownImage && (
              <img
                src={shownImage}
                alt={phase === "done" ? "Shelf photo analyzed by Aislix" : "Sample retail shelf"}
                className="h-full max-h-[700px] w-full object-contain p-3 sm:p-5"
              />
            )}
            {scanning && (
              <div className="absolute inset-0 bg-foreground/20">
                <Badge className="absolute left-4 top-4 gap-2 rounded-md bg-primary px-3 py-2 text-primary-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  {scanMode === "sample" ? "Running demo scan…" : "Analyzing shelf…"}
                </Badge>
              </div>
            )}
          </div>

          {/* Analysis */}
          <div className="min-w-0 p-5 sm:p-7">
            {scanning && (
              <div className="grid min-h-72 place-items-center">
                <ScanProgressPanel
                  active
                  expectedMs={scanMode === "sample" ? 15_000 : 150_000}
                  title={scanMode === "sample" ? "Running demo scan…" : "Analyzing shelf…"}
                  timingMessage={
                    scanMode === "sample" ? SAMPLE_TIMING_MESSAGE : UPLOAD_TIMING_MESSAGE
                  }
                />
              </div>
            )}

            {phase === "error" ? (
              <div className="min-h-72">
                <div className="sticky top-4 z-10 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{error}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => onSample()}>
                    <Sparkles className="size-4" /> Try sample shelf
                  </Button>
                  {pendingFile ? (
                    <Button size="sm" variant="outline" onClick={() => void run("upload", pendingFile)}>
                      Upload again
                    </Button>
                  ) : null}
                  {errorStatus === 429 ? (
                    <Button size="sm" variant="outline" asChild>
                      <a href="/signup">Sign up for full access</a>
                    </Button>
                  ) : null}
                </div>
                <p className="mt-3 text-sm text-muted-foreground">Scan failed — try again</p>
                <EmptyResults />
              </div>
            ) : null}


            {phase === "idle" && <EmptyResults />}

            {phase === "done" && result && (
              <SampleResult result={result} liveResult={result} showWorkspaceCta={showWorkspaceCta} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

const METRIC_LABELS = ["Products detected", "Unique SKUs", "Shelf health"] as const;

/** Strict empty state — never shows placeholder numbers. */
function EmptyResults() {
  return (
    <div className="mt-5">
      <div className="grid grid-cols-3 gap-3">
        {METRIC_LABELS.map((label) => (
          <div key={label} className="rounded-lg border border-border bg-surface p-3">
            <p className="text-lg font-semibold text-foreground">—</p>
            <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 overflow-hidden rounded-lg border border-border">
        <div className="grid grid-cols-[1fr_1.5fr_0.45fr] bg-surface px-3 py-2 text-xs uppercase text-muted-foreground">
          <span>Brand</span><span>Product</span><span>Qty</span>
        </div>
        <p className="border-t border-border px-3 py-10 text-center text-sm text-muted-foreground">
          No scan results yet.
        </p>
      </div>
    </div>
  );
}


function SampleResult({
  result: displayedResult,
  liveResult,
  showWorkspaceCta,
}: {
  result: LandingScanResult;
  liveResult: LandingScanResult | null;
  showWorkspaceCta: boolean;
}) {
  // Bind strictly to the API's in-audit brand share. Never recompute from
  // inventory rows — that mixes in out-of-scope detections and skews %.
  const brandShare =
    displayedResult.top_brands?.length
      ? displayedResult.top_brands
      : (displayedResult.brand_share ?? []);
  const avgConfidence = averageConfidencePercent(displayedResult);
  return (
    <div>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <Badge className="gap-1.5 rounded-md bg-brand text-brand-foreground">
                    <Sparkles className="size-3" /> Live AI analysis
                  </Badge>
                  {displayedResult.scanned_at ? (
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(displayedResult.scanned_at).toLocaleString()}
                    </span>
                  ) : null}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Products detected", value: displayedResult.metrics?.total_products },
                    { label: "Unique SKUs", value: uniqueSkuCount(displayedResult) },
                    {
                      label: "Shelf health",
                      value:
                        displayedResult.metrics?.shelf_health_score != null
                          ? `${Math.round(displayedResult.metrics.shelf_health_score)}%`
                          : undefined,
                    },
                  ].map((m) => (
                    <div
                      key={m.label}
                      className="rounded-lg border border-border bg-surface p-3"
                    >
                      <p className="text-lg font-semibold tracking-tight text-foreground">
                        {m.value ?? "—"}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                        {m.label}
                      </p>
                    </div>
                  ))}
                </div>

                {displayedResult.executive_summary && (
                  <ExecutiveSummary text={displayedResult.executive_summary} />
                )}

                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{AI_DISCLAIMER}</p>

                <TopBrandsByShelfShare rows={brandShare} scope={displayedResult.brand_share_scope} className="mt-5" />

                <DemoInventoryTable rows={displayedResult.inventory ?? []} />

                {avgConfidence != null && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Average AI confidence: {avgConfidence}%
                  </p>
                )}

                {displayedResult.scans_daily_limit != null && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {displayedResult.scans_used_today ?? 0} of {displayedResult.scans_daily_limit} free demo scans used
                    today
                  </p>
                )}

                <p className="mt-5 text-sm text-muted-foreground">
                  Want unlimited scans for your stores?{" "}
                  <a href="/signup" className="font-medium text-brand hover:underline">
                    Create a free workspace
                  </a>
                </p>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto"
                    disabled={!liveResult?.csv_base64}
                    onClick={() => liveResult && downloadLandingCsv(liveResult)}
                  >
                    <Download className="size-4" /> Download CSV
                  </Button>
                  {showWorkspaceCta ? (
                    <Button
                      size="lg"
                      className="w-full sm:w-auto"
                      onClick={() =>
                        document.querySelector("#lead")?.scrollIntoView({ behavior: "smooth" })
                      }
                    >
                      Create your workspace <ArrowRight className="size-4" />
                    </Button>
                  ) : null}
                </div>
    </div>
  );
}

function ExecutiveSummary({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 260;
  return (
    <div className="mt-4">
      <p
        className={`text-sm leading-relaxed text-muted-foreground ${
          expanded || !long ? "" : "line-clamp-4"
        }`}
      >
        {text}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 text-xs font-medium text-brand hover:underline"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}

type DemoRow = NonNullable<LandingScanResult["inventory"]>[number];

function ViewToggle({
  value,
  onChange,
}: {
  value: "sku" | "brand";
  onChange: (v: "sku" | "brand") => void;
}) {
  return (
    <div className="mt-5 flex items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">View:</span>
      <div className="inline-flex rounded-lg border border-border bg-surface p-0.5">
        {([
          { key: "sku", label: "By SKU" },
          { key: "brand", label: "By brand" },
        ] as const).map((o) => (
          <button
            key={o.key}
            type="button"
            aria-pressed={value === o.key}
            onClick={() => onChange(o.key)}
            className={
              value === o.key
                ? "rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                : "rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            }
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function DemoInventoryTable({ rows }: { rows: DemoRow[] }) {
  const [view, setView] = useState<"sku" | "brand">("sku");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const groups = rollupByBrand(rows as any) as unknown as {
    brand: string;
    skuCount: number;
    totalQty: number;
    items: DemoRow[];
  }[];

  return (
    <div>
      <ViewToggle value={view} onChange={setView} />
      <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-border">
        {view === "sku" ? (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-surface text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Brand</th>
                <th className="px-3 py-2 font-medium">Product</th>
                <th className="px-3 py-2 font-medium">Variant</th>
                <th className="px-3 py-2 font-medium">Qty</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={`${row.brand}-${row.product_name}-${i}`} className="border-t border-border">
                  <td className="px-3 py-2">{row.brand || "—"}</td>
                  <td className="px-3 py-2">{row.product_name || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{displayVariant(row)}</td>
                  <td className="px-3 py-2">{row.quantity}</td>
                  <td className="px-3 py-2">
                    <Badge
                      variant={row.status_label === "Needs review" ? "outline" : "secondary"}
                      className="rounded-lg text-xs"
                    >
                      {row.status_label ?? "Detected"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-surface text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Brand</th>
                <th className="px-3 py-2 font-medium">SKUs</th>
                <th className="px-3 py-2 font-medium">Total qty</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g.brand}>
                  <tr className="border-t border-border">
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="flex items-center gap-1.5 font-medium text-foreground"
                        onClick={() => setOpen((o) => ({ ...o, [g.brand]: !o[g.brand] }))}
                        aria-expanded={!!open[g.brand]}
                      >
                        {open[g.brand] ? (
                          <ChevronDown className="size-3.5" />
                        ) : (
                          <ChevronRight className="size-3.5" />
                        )}
                        {g.brand}
                      </button>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{g.skuCount}</td>
                    <td className="px-3 py-2 tabular-nums">{g.totalQty}</td>
                  </tr>
                  {open[g.brand] &&
                    g.items.map((row, i) => (
                      <tr key={`${g.brand}-item-${i}`} className="border-t border-border bg-muted/30">
                        <td className="px-3 py-1.5 pl-9 text-muted-foreground" colSpan={2}>
                          {row.product_name || "—"}
                        </td>
                        <td className="px-3 py-1.5 tabular-nums text-muted-foreground">
                          {row.quantity}
                        </td>
                      </tr>
                    ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
