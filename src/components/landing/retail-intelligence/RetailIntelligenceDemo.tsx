import { useEffect, useRef, useState } from "react";
import { AlertCircle, ImagePlus, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_DEMO_CATEGORY,
  DEFAULT_DEMO_SUBCATEGORY,
  EMPTY_DEMO_CATEGORY_STATE,
  useDemoCategory,
} from "@/components/scan/DemoCategoryPicker";
import { DemoScanSetupPanel } from "@/components/scan/DemoScanSetupPanel";
import { DemoRoleResultsPanel } from "@/components/scan/DemoRoleResultsPanel";
import { ScanProgressPanel } from "@/components/scan/ScanProgressPanel";
import { trackLandingEvent } from "@/lib/landing-analytics";
import {
  DEFAULT_SAMPLE_ID,
  DEFAULT_SAMPLE_IMAGE,
  loadLandingSessionId,
  persistLandingSession,
  runLandingSample,
  runLandingUpload,
  type LandingScanResult,
} from "@/lib/landing-scan-api";
import { buildDemoOralCareScanContext } from "@/lib/demo-oral-care-planogram";
import { EMPTY_SCAN_CONTEXT, type ScanContextState } from "@/lib/scan-context";
import { LANDING_SAMPLE_EVENT, LANDING_UPLOAD_EVENT } from "./HeroSection";
import { LeadCaptureSection } from "./LeadCaptureSection";
import { networkErrorMessage } from "@/lib/api-errors";

type Phase = "idle" | "scanning" | "done" | "error";
type SetupMode = null | "sample" | "upload";

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
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(DEFAULT_SAMPLE_IMAGE);
  const [result, setResult] = useState<LandingScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState<number | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [setupMode, setSetupMode] = useState<SetupMode>(null);
  const [scanContext, setScanContext] = useState<ScanContextState>(EMPTY_SCAN_CONTEXT);
  const [resultScanContext, setResultScanContext] = useState<ScanContextState>(EMPTY_SCAN_CONTEXT);
  const objectUrlRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const demoCardRef = useRef<HTMLDivElement>(null);

  const subCategoryLabel = demoCategory.categories
    .find((c) => c.name === demoCategory.state.categoryName)
    ?.subcategories?.find((s) => s.id === demoCategory.state.subId)?.label;

  function scrollToDemo() {
    window.requestAnimationFrame(() => {
      demoCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function beginSampleSetup() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPendingFile(null);
    setSetupMode("sample");
    setPreviewImageUrl(DEFAULT_SAMPLE_IMAGE);
    setScanContext(buildDemoOralCareScanContext());
    setError(null);
    setResult(null);
    setPhase("idle");
    demoCategory.setState({
      categoryName: DEFAULT_DEMO_CATEGORY,
      subId: DEFAULT_DEMO_SUBCATEGORY,
      customSub: "",
    });
    scrollToDemo();
  }

  useEffect(() => {
    const handleSample = () => beginSampleSetup();
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
    setSetupMode("upload");
    setScanContext(EMPTY_SCAN_CONTEXT);
    setError(null);
    setResult(null);
    setPhase("idle");
    demoCategory.setState(EMPTY_DEMO_CATEGORY_STATE);
    scrollToDemo();
  }

  const shownImage = phase === "done" && result ? (imageSrc(result) ?? previewImageUrl) : previewImageUrl;
  const scanning = phase === "scanning";
  const showImagePane = Boolean(previewImageUrl) && phase !== "done";

  const setupPanel =
    setupMode && (phase === "idle" || phase === "error") ? (
      <DemoScanSetupPanel
        mode={setupMode}
        state={demoCategory.state}
        onChange={demoCategory.setState}
        categories={demoCategory.categories}
        ready={demoCategory.ready}
        disabled={scanning}
        scanContext={scanContext}
        onScanContextChange={setScanContext}
        defaultCategory={demoCategory.state.categoryName}
        defaultSubCategory={subCategoryLabel}
        onStart={(ctx) => {
          setResultScanContext(ctx);
          setScanContext(ctx);
          void run(setupMode, setupMode === "upload" ? (pendingFile ?? undefined) : undefined);
        }}
      />
    ) : null;

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

          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Button
              size="xl"
              className="min-h-11 w-full bg-accent-green text-brand-foreground hover:bg-accent-green/90 sm:w-auto"
              disabled={scanning}
              onClick={beginSampleSetup}
            >
              <Sparkles className="size-4" /> Try Sample Shelf
            </Button>
            {setupMode === "upload" ? (
              <Button
                variant="outline"
                size="xl"
                className="min-h-11 w-full sm:w-auto"
                disabled={scanning}
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus className="size-4" /> Change Photo
              </Button>
            ) : (
              <Button
                variant="outline"
                size="xl"
                className="min-h-11 w-full sm:w-auto"
                disabled={scanning}
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus className="size-4" /> Upload Shelf Photo
              </Button>
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

          <div
            ref={demoCardRef}
            className="mt-8 overflow-hidden rounded-lg border border-border bg-card shadow-lift"
          >
            <div className="p-4 sm:p-6 lg:p-8">
              {scanning && (
                <div className="grid min-h-48 place-items-center py-8">
                  <ScanProgressPanel active expectedMs={60_000} timingMessage={DEMO_TIMING_MESSAGE} />
                </div>
              )}

              {phase === "error" && error ? (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}

              {!scanning && setupPanel}

              {!scanning && phase === "idle" && !setupMode ? <EmptyResults /> : null}

              {!scanning && phase === "done" && result ? (
                <DemoRoleResultsPanel
                  result={result}
                  elapsedSec={elapsedSec}
                  scanContext={resultScanContext}
                  onScanContextChange={setScanContext}
                  defaultCategory={demoCategory.state.categoryName}
                  defaultSubCategory={subCategoryLabel}
                  previewImageUrl={previewImageUrl}
                  onWorkspaceCta={() =>
                    document.getElementById("lead")?.scrollIntoView({ behavior: "smooth", block: "center" })
                  }
                />
              ) : null}
            </div>

            {showImagePane ? (
              <div className="relative border-t border-border bg-surface px-4 py-5 sm:px-6 sm:py-6">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {phase === "done" ? "Annotated shelf photo" : "Shelf photo"}
                </p>
                <div className="relative mx-auto max-w-3xl">
                  <img
                    src={shownImage ?? previewImageUrl ?? DEFAULT_SAMPLE_IMAGE}
                    alt={phase === "done" ? "Shelf photo analyzed by Aislix" : "Sample toothpaste shelf"}
                    className="mx-auto max-h-[min(52vh,520px)] w-full rounded-lg object-contain"
                  />
                  {scanning ? (
                    <div className="absolute inset-0 rounded-lg bg-brand/15">
                      <Badge className="absolute left-3 top-3 gap-2 rounded-md bg-brand px-3 py-2 text-brand-foreground">
                        <Loader2 className="size-3.5 animate-spin" /> Analyzing image…
                      </Badge>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <LeadCaptureSection landingSessionId={result?.landing_session_id ?? loadLandingSessionId()} />
    </>
  );
}

function EmptyResults() {
  return (
    <div className="grid min-h-48 place-items-center py-8 text-center">
      <p className="max-w-md text-sm text-muted-foreground">
        Choose the sample shelf or upload your photo above — then confirm category, optionally add a
        planogram, and start scanning. Execution, merchandising, brand, and executive views will
        appear here.
      </p>
    </div>
  );
}
