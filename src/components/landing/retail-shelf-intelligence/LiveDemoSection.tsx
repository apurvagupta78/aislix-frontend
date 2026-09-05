import { Fragment, useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowRight, ChevronDown, ChevronRight, Download, ImagePlus, Loader2, Sparkles } from "lucide-react";
import { rollupByBrand } from "@/lib/brand-rollup";
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
import { AI_DISCLAIMER, ScanProgressPanel } from "@/components/scan/ScanProgressPanel";
import {
  brandShareFromRows,
  TopBrandsByShelfShare,
} from "@/components/scan/TopBrandsByShelfShare";
import {
  DemoCategoryPicker,
  DEFAULT_DEMO_CATEGORY,
  DEFAULT_DEMO_SUBCATEGORY,
  useDemoCategory,
} from "@/components/scan/DemoCategoryPicker";
import { SectionHeading } from "./shared";

type Phase = "idle" | "scanning" | "done" | "error";

const MAX_BYTES = 10 * 1024 * 1024;
const MIN_SCAN_MS = 8_000;
const DEMO_TIMING_MESSAGE =
  "This usually takes 30–90 seconds for large shelves. Keep this page open.";

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
  const objectUrlRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPreviewImageUrl(DEFAULT_SAMPLE_IMAGE);
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  async function run(mode: "sample" | "upload", file?: File) {
    setError(null);
    setResult(null);
    setPhase("scanning");
    trackLandingEvent("demo_scan_started", { mode });

    // Keep the progress UI visible long enough to read — the analysis is real,
    // but a fast response should never look pre-recorded.
    const minVisible = new Promise<void>((resolve) => setTimeout(resolve, MIN_SCAN_MS));

    try {
      const [scan] = await Promise.all([
        mode === "sample"
          ? runLandingSample(DEFAULT_SAMPLE_ID, loadLandingSessionId() ?? undefined)
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
      const status = (err as { status?: number }).status;
      setError((err as Error).message || (status === 429 ? "Demo capacity is busy. Please try again shortly." : "Scan failed. Please try again."));
      setPhase("error");
      trackLandingEvent("demo_scan_failed");
    }
  }


  function onSample() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPreviewImageUrl(DEFAULT_SAMPLE_IMAGE);
    demoCategory.setState({
      categoryName: DEFAULT_DEMO_CATEGORY,
      subId: DEFAULT_DEMO_SUBCATEGORY,
      customSub: "",
    });
    void run("sample");
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
    void run("upload", file);
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

          <DemoCategoryPicker
            state={demoCategory.state}
            onChange={demoCategory.setState}
            categories={demoCategory.categories}
            disabled={scanning}
          />
          {!demoCategory.ready && (
            <p className="mt-2 text-center text-xs text-destructive">
              Select shelf category and sub-category before uploading.
            </p>
          )}

        <div
          className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center"
        >
          <Button
            size="xl"
            variant="default"
            className="min-h-11 w-full sm:w-auto"
            disabled={scanning}
            onClick={onSample}
          >
            <Sparkles className="size-4" /> Try Sample Shelf Below
          </Button>
          <Button
            variant="outline"
            size="xl"
            className="min-h-11 w-full sm:w-auto"
            disabled={scanning || !demoCategory.ready}
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus className="size-4" /> Upload Your Shelf Photo
          </Button>
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
                  <Loader2 className="size-3.5 animate-spin" /> Analyzing shelf…
                </Badge>
              </div>
            )}
          </div>

          {/* Analysis */}
          <div className="min-w-0 p-5 sm:p-7">
            {scanning && (
              <div className="grid min-h-72 place-items-center">
                <ScanProgressPanel active expectedMs={60_000} timingMessage={DEMO_TIMING_MESSAGE} />
              </div>
            )}

            {phase === "error" ? (
              <div className="min-h-72">
                <div className="sticky top-4 z-10 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{error}</span>
                </div>
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
  const brandShare =
    displayedResult.top_brands?.length
      ? displayedResult.top_brands
      : displayedResult.brand_share?.length
        ? displayedResult.brand_share
        : brandShareFromRows(displayedResult.inventory ?? []);
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
                    { label: "Unique SKUs", value: displayedResult.metrics?.unique_skus },
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

                <TopBrandsByShelfShare rows={brandShare} className="mt-5" />

                <DemoInventoryTable rows={displayedResult.inventory ?? []} />


                {displayedResult.scans_daily_limit != null && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {displayedResult.scans_used_today ?? 0} of {displayedResult.scans_daily_limit} free demo scans used
                    today
                  </p>
                )}

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
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
                <th className="px-3 py-2 font-medium">Qty</th>
                <th className="px-3 py-2 font-medium">Conf.</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={`${row.brand}-${row.product_name}-${i}`} className="border-t border-border">
                  <td className="px-3 py-2">{row.brand || "—"}</td>
                  <td className="px-3 py-2">{row.product_name || "—"}</td>
                  <td className="px-3 py-2">{row.quantity}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {row.confidence != null
                      ? `${Math.round(row.confidence <= 1 ? row.confidence * 100 : row.confidence)}%`
                      : "—"}
                  </td>
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
