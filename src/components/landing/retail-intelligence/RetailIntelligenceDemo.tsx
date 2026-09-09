import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowRight, Download, ImagePlus, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DemoCategoryPicker,
  DEFAULT_DEMO_CATEGORY,
  DEFAULT_DEMO_SUBCATEGORY,
  EMPTY_DEMO_CATEGORY_STATE,
  useDemoCategory,

} from "@/components/scan/DemoCategoryPicker";
import { AI_DISCLAIMER, ScanProgressPanel } from "@/components/scan/ScanProgressPanel";
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
import { averageConfidencePercent, displayVariant, uniqueSkuCount } from "@/lib/landing-inventory";
import { TopBrandsByShelfShare } from "@/components/scan/TopBrandsByShelfShare";
import { LANDING_SAMPLE_EVENT, LANDING_UPLOAD_EVENT } from "./HeroSection";
import { LeadCaptureSection } from "./LeadCaptureSection";
import { networkErrorMessage } from "@/lib/api-errors";

type Phase = "idle" | "scanning" | "done" | "error";

const MAX_BYTES = 10 * 1024 * 1024;
const MIN_SCAN_MS = 8_000;
const DEMO_TIMING_MESSAGE =
  "This usually takes 2–3 minutes for large shelves. Keep this page open.";

function imageSrc(result: LandingScanResult): string | null {
  if (result.annotated_image_base64) {
    return `data:${result.annotated_image_mime || "image/jpeg"};base64,${result.annotated_image_base64}`;
  }
  if (result.original_image_base64) {
    return `data:${result.original_image_mime || "image/jpeg"};base64,${result.original_image_base64}`;
  }
  return null;
}

export function RetailIntelligenceDemo() {
  const [phase, setPhase] = useState<Phase>("idle");
  const demoCategory = useDemoCategory();
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [result, setResult] = useState<LandingScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState<number | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isSampleFlow, setIsSampleFlow] = useState(true);
  const objectUrlRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    setPreviewImageUrl(DEFAULT_SAMPLE_IMAGE);

    const handleSample = () => void run("sample");
    const handleUpload = () => fileRef.current?.click();
    window.addEventListener(LANDING_SAMPLE_EVENT, handleSample);
    window.addEventListener(LANDING_UPLOAD_EVENT, handleUpload);

    return () => {
      window.removeEventListener(LANDING_SAMPLE_EVENT, handleSample);
      window.removeEventListener(LANDING_UPLOAD_EVENT, handleUpload);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  async function run(kind: "sample" | "upload", file?: File) {
    setError(null);
    setResult(null);
    setElapsedSec(null);
    setPhase("scanning");
    trackLandingEvent("demo_scan_started", { kind });
    const startedAt = Date.now();

    const minVisible = new Promise<void>((resolve) => setTimeout(resolve, MIN_SCAN_MS));

    try {
      const [scan] = await Promise.all([
        kind === "sample"
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
      setElapsedSec(Math.max(1, Math.round((Date.now() - startedAt) / 1000)));
      persistLandingSession(scan);
      setPhase("done");
      trackLandingEvent("demo_scan_completed", {
        products: scan.metrics?.total_products ?? 0,
      });
      window.setTimeout(
        () => document.getElementById("lead")?.scrollIntoView({ behavior: "smooth", block: "center" }),
        600,
      );
    } catch (err) {
      await minVisible;
      const status = (err as { status?: number }).status;
      setError(
        status === 429
          ? "You've used all free demo scans for today. Create a free account to keep scanning."
          : networkErrorMessage(err),
      );
      setPhase("error");
      trackLandingEvent("demo_scan_failed");
    }
  }

  function onSample() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPendingFile(null);
    setIsSampleFlow(true);
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
    setPendingFile(file);
    setIsSampleFlow(false);
    setError(null);
    setPhase("idle");
    demoCategory.setState(EMPTY_DEMO_CATEGORY_STATE);
    pickerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const shownImage = phase === "done" && result ? (imageSrc(result) ?? previewImageUrl) : previewImageUrl;
  const scanning = phase === "scanning";

  return (
    <>
      <section id="demo" className="scroll-mt-16 border-t border-border bg-background py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand">Live shelf audit</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">See What Aislix Sees</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
              Run a live AI shelf scan right here — no signup, no setup.
            </p>
          </div>

          <div ref={pickerRef}>
            <DemoCategoryPicker
              state={demoCategory.state}
              onChange={demoCategory.setState}
              categories={demoCategory.categories}
              disabled={scanning}
            />
          </div>
          {pendingFile && !demoCategory.ready && (
            <p className="mt-2 text-center text-xs text-destructive">
              Select category and sub-category for your shelf before analyzing.
            </p>
          )}
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            {isSampleFlow ? (
              <>
                <Button
                  size="xl"
                  className="min-h-11 w-full bg-accent-green text-brand-foreground hover:bg-accent-green/90 sm:w-auto"
                  disabled={scanning}
                  onClick={onSample}
                >
                  <Sparkles className="size-4" /> Try Sample Shelf
                </Button>
                <Button
                  variant="outline"
                  size="xl"
                  className="min-h-11 w-full sm:w-auto"
                  disabled={scanning}
                  onClick={() => fileRef.current?.click()}
                >
                  <ImagePlus className="size-4" /> Upload Shelf Photo
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
                  className="min-h-11 w-full bg-accent-green text-brand-foreground hover:bg-accent-green/90 sm:w-auto"
                  disabled={scanning || !demoCategory.ready}
                  onClick={() => void run("upload", pendingFile!)}
                >
                  <Sparkles className="size-4" /> Analyze My Shelf
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


          <div className="mt-8 overflow-hidden rounded-lg border border-border bg-card shadow-lift lg:grid lg:grid-cols-[55fr_45fr]">
            {/* IMAGE PANEL */}
            <div className="relative grid min-h-80 place-items-center overflow-hidden bg-surface lg:min-h-[620px] lg:border-r lg:border-border">
              {shownImage ? (
                <>
                  <img
                    src={shownImage}
                    alt={phase === "done" ? "Shelf photo analyzed by Aislix" : "Sample toothpaste shelf"}
                    className="h-full max-h-[720px] w-full object-contain p-3 sm:p-5"
                  />
                  {scanning && (
                    <div className="absolute inset-0 bg-brand/15">
                      <Badge className="absolute left-4 top-4 gap-2 rounded-md bg-brand px-3 py-2 text-brand-foreground">
                        <Loader2 className="size-3.5 animate-spin" /> Analyzing shelf…
                      </Badge>
                    </div>
                  )}
                </>
              ) : (
                <div className="grid min-h-72 place-items-center p-8 text-center">
                  <div>
                    <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">
                      <ImagePlus className="size-5" />
                    </span>
                    <p className="mt-4 text-sm text-muted-foreground">
                      Pick the sample shelf or upload your own photo (JPEG/PNG, up to 10MB).
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* RESULTS PANEL */}
            <div className="min-w-0 p-5 sm:p-7">
              {scanning && (
                <div className="grid min-h-72 place-items-center">
                  <ScanProgressPanel active expectedMs={60_000} timingMessage={DEMO_TIMING_MESSAGE} />
                </div>
              )}

              {phase === "error" && (
                <div className="grid min-h-72 place-items-center text-center">
                  <div>
                    <AlertCircle className="mx-auto size-6 text-destructive" />
                    <p className="mt-3 text-sm text-foreground">{error}</p>
                  </div>
                </div>
              )}

              {phase === "idle" && (
                <div className="grid min-h-72 place-items-center text-center">
                  <p className="max-w-xs text-sm text-muted-foreground">
                    Your detected products, unique SKUs and shelf health score will appear here.
                  </p>
                </div>
              )}

              {phase === "done" && result && (
                <div>
                  {elapsedSec != null && (
                    <div className="mb-4 flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
                      <Timer className="size-3.5 text-brand" />
                      <span>
                        Analysis completed in{" "}
                        <span className="font-semibold text-foreground">{elapsedSec}s</span>
                      </span>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Products detected", value: result.metrics?.total_products },
                      { label: "Unique SKUs", value: uniqueSkuCount(result) },
                      {
                        label: "Shelf health",
                        value:
                          result.metrics?.shelf_health_score != null
                            ? `${Math.round(result.metrics.shelf_health_score)}%`
                            : undefined,
                      },
                    ].map((m) => (
                      <div key={m.label} className="rounded-md border border-border bg-surface p-3">
                        <p className="text-lg font-semibold tracking-tight">{m.value ?? "—"}</p>
                        <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                          {m.label}
                        </p>
                      </div>
                    ))}
                  </div>

                  {result.executive_summary && (
                    <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                      {result.executive_summary}
                    </p>
                  )}

                  <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{AI_DISCLAIMER}</p>

                  {/* Bind strictly to the API's in-audit brand share — never
                      recompute from inventory rows. */}
                  <TopBrandsByShelfShare
                    rows={
                      result.top_brands?.length
                        ? result.top_brands
                        : (result.brand_share ?? [])
                    }
                    scope={result.brand_share_scope}
                    className="mt-5"
                  />

                  <div className="mt-5 max-h-80 overflow-auto rounded-md border border-border">
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
                        {result.inventory?.map((row, i) => (
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
                  </div>

                  {averageConfidencePercent(result) != null && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Average AI confidence: {averageConfidencePercent(result)}%
                    </p>
                  )}

                  {result.scans_daily_limit != null && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      {result.scans_used_today ?? 0} of {result.scans_daily_limit} free demo scans used
                      today
                    </p>
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => document.getElementById("lead")?.scrollIntoView({ behavior: "smooth", block: "center" })}
                    className="mt-4 flex h-auto w-full justify-between rounded-none border-y border-border px-0 py-3 text-left text-sm font-medium text-foreground hover:bg-transparent hover:text-brand"
                  >
                    Want to save this audit? <ArrowRight className="size-4" />
                  </Button>

                  <div className="mt-4">
                    <Button
                      variant="outline"
                      className="min-h-11 w-full"
                      disabled={!result.csv_base64}
                      onClick={() => {
                        trackLandingEvent("cta_click", { location: "download_csv" });
                        downloadLandingCsv(result);
                      }}
                    >
                      <Download className="size-4" /> Download CSV
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <LeadCaptureSection landingSessionId={result?.landing_session_id ?? loadLandingSessionId()} />
    </>
  );
}
