import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, Sparkles, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trackLandingEvent } from "@/lib/landing-analytics";
import {
  DEFAULT_SAMPLE_ID,
  DEFAULT_SAMPLE_IMAGE,
  loadLandingSessionId,
  mergeLandingScanContext,
  persistLandingSession,
  runLandingSample,
  runLandingUpload,
  type LandingScanResult,
} from "@/lib/landing-scan-api";
import { ScanProgressPanel } from "@/components/scan/ScanProgressPanel";
import {
  DEFAULT_DEMO_CATEGORY,
  DEFAULT_DEMO_SUBCATEGORY,
  EMPTY_DEMO_CATEGORY_STATE,
  useDemoCategory,
} from "@/components/scan/use-demo-category";
import { buildDemoOralCareScanContext } from "@/lib/demo-oral-care-planogram";
import { EMPTY_SCAN_CONTEXT, type ScanContextState } from "@/lib/scan-context";
import { HomepageDemoAuditPreview } from "./HomepageDemoAuditPreview";
import { SectionHeading } from "./shared";
import { networkErrorMessage } from "@/lib/api-errors";

const DemoRoleResultsPanel = lazy(() =>
  import("@/components/scan/DemoRoleResultsPanel").then((m) => ({
    default: m.DemoRoleResultsPanel,
  })),
);
const DemoScanSetupPanel = lazy(() =>
  import("@/components/scan/DemoScanSetupPanel").then((m) => ({
    default: m.DemoScanSetupPanel,
  })),
);

type Phase = "idle" | "scanning" | "done" | "error";
type SetupMode = null | "sample" | "upload";

const MAX_BYTES = 10 * 1024 * 1024;
const MIN_SCAN_MS = 2_000;
const DEMO_TIMING_MESSAGE =
  "This usually takes 2–3 minutes for large shelves. Keep this page open.";

function annotatedSrc(result: LandingScanResult): string | null {
  if (result.annotated_image_base64) {
    return `data:${result.annotated_image_mime || "image/jpeg"};base64,${result.annotated_image_base64}`;
  }
  if (result.original_image_base64) {
    return `data:${result.original_image_mime || "image/jpeg"};base64,${result.original_image_base64}`;
  }
  return null;
}

function resolveSubLabel(
  categories: ReturnType<typeof useDemoCategory>["categories"],
  categoryName: string,
  subId: string,
): string | undefined {
  return categories
    .find((c) => c.name === categoryName)
    ?.subcategories?.find((s) => s.id === subId)?.label;
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
  const [setupMode, setSetupMode] = useState<SetupMode>(null);
  const demoCategory = useDemoCategory({ enabled: Boolean(setupMode) });
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [result, setResult] = useState<LandingScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState<number | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [scanContext, setScanContext] = useState<ScanContextState>(EMPTY_SCAN_CONTEXT);
  /** Context used for results — set synchronously on Start so KPIs are not lost to React batching. */
  const [resultScanContext, setResultScanContext] = useState<ScanContextState>(EMPTY_SCAN_CONTEXT);
  const objectUrlRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const demoCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const subCategoryLabel = resolveSubLabel(
    demoCategory.categories,
    demoCategory.state.categoryName,
    demoCategory.state.subId,
  );

  function scrollToDemo() {
    window.requestAnimationFrame(() => {
      demoCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function run(mode: "sample" | "upload", file?: File, activeScanContext?: ScanContextState) {
    setError(null);
    setResult(null);
    setElapsedSec(null);
    setPhase("scanning");
    trackLandingEvent("demo_scan_started", { mode });
    const startedAt = Date.now();
    const minVisible = new Promise<void>((resolve) => setTimeout(resolve, MIN_SCAN_MS));

    try {
      const landingContext = mergeLandingScanContext(
        demoCategory.context,
        activeScanContext ?? scanContext,
      );
      const [scan] = await Promise.all([
        mode === "sample"
          ? runLandingSample(DEFAULT_SAMPLE_ID, loadLandingSessionId() ?? undefined, landingContext)
          : file
            ? runLandingUpload(file, {
                ...landingContext,
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
        scan_id: scan.scan_id,
        landing_session_id: scan.landing_session_id,
      });
      onResult?.(scan, annotatedSrc(scan));
    } catch (err) {
      await minVisible;
      const status = (err as { status?: number }).status;
      setError(
        status === 429
          ? "You've used all free demo audits for today. Create a free account to keep auditing."
          : networkErrorMessage(err),
      );
      setPhase("error");
      trackLandingEvent("demo_scan_failed");
    }
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

  function beginUploadSetup() {
    setPendingFile(null);
    setPreviewImageUrl(null);
    setSetupMode("upload");
    setScanContext(EMPTY_SCAN_CONTEXT);
    setError(null);
    setResult(null);
    setPhase("idle");
    demoCategory.setState(EMPTY_DEMO_CATEGORY_STATE);
    scrollToDemo();
  }

  function onFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Please upload or capture a shelf photo (JPEG or PNG).");
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

  const scanning = phase === "scanning";
  const homepageIdlePreview = homepageIntro && phase === "idle" && !setupMode;
  const displayImageUrl =
    (phase === "done" && result ? (annotatedSrc(result) ?? previewImageUrl) : null) ??
    previewImageUrl;
  /** Rich in-card preview replaces the bottom image pane only in homepage idle state. */
  const showImagePane =
    Boolean(displayImageUrl) && phase !== "done" && !homepageIdlePreview;

  const setupPanel =
    setupMode && (phase === "idle" || phase === "error") ? (
      <Suspense
        fallback={
          <div className="py-8 text-center text-sm text-muted-foreground">Loading setup…</div>
        }
      >
        <DemoScanSetupPanel
          mode={setupMode}
          homepageIntro={homepageIntro}
          state={demoCategory.state}
          onChange={demoCategory.setState}
          categories={demoCategory.categories}
          ready={demoCategory.ready}
          disabled={scanning}
          scanContext={scanContext}
          onScanContextChange={setScanContext}
          defaultCategory={demoCategory.state.categoryName}
          defaultSubCategory={subCategoryLabel}
          hasPhoto={Boolean(pendingFile)}
          previewImageUrl={previewImageUrl}
          onPickUploadPhoto={() => fileRef.current?.click()}
          onTakeMobilePhoto={() => cameraRef.current?.click()}
          onStart={(ctx) => {
            setResultScanContext(ctx);
            setScanContext(ctx);
            void run(
              setupMode,
              setupMode === "upload" ? (pendingFile ?? undefined) : undefined,
              ctx,
            );
          }}
        />
      </Suspense>
    ) : null;

  return (
    <section
      id={homepageIntro ? "start-scanning" : "demo"}
      className={
        homepageIntro
          ? "scroll-mt-20 bg-card py-20 lg:py-28"
          : "scroll-mt-16 bg-surface py-16 sm:py-20"
      }
    >
      <div className={homepageIntro ? "mx-auto max-w-7xl px-5 lg:px-8" : "mx-auto max-w-6xl px-5 sm:px-8"}>
        {homepageIntro ? (
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-[#2A6FA8]">Try Aislix free</p>
            <h2 className="mt-3 text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-4xl">
              See what Aislix can find on your shelf.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              Run the sample audit, or drop in a photo of your own shelf. You&apos;ll get products,
              gaps, price issues and planogram fit in about a minute.
            </p>
          </div>
        ) : (
          <SectionHeading
            title="See What Aislix Sees"
            subtitle="Try a real shelf audit — no login required."
            eyebrow="Live demo"
          />
        )}

        <div
          className={
            homepageIntro
              ? "mt-8 flex flex-col gap-3 sm:flex-row"
              : "mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center"
          }
        >
          <Button
            size="xl"
            variant="default"
            className="min-h-11 w-full rounded-xl sm:w-auto"
            disabled={scanning}
            onClick={beginSampleSetup}
          >
            {homepageIntro ? (
              <>
                <Sparkles className="size-4" /> Run audit
              </>
            ) : (
              <>
                <Sparkles className="size-4" /> Try Sample Shelf Below
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="xl"
            className="min-h-11 w-full rounded-xl sm:w-auto"
            disabled={scanning}
            onClick={beginUploadSetup}
          >
            <Upload className="size-4" />
            {homepageIntro ? "Upload shelf photo" : "Upload Your Shelf Photo"}
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
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
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
          className={
            homepageIntro
              ? "mt-10 overflow-hidden rounded-3xl border border-border bg-surface p-3 shadow-soft sm:p-4"
              : "mt-8 overflow-hidden rounded-xl border border-border bg-card shadow-lift"
          }
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

            {!scanning && homepageIdlePreview ? <HomepageDemoAuditPreview /> : null}

            {!scanning && phase === "idle" && !setupMode && !homepageIntro ? (
              <EmptyResults />
            ) : null}

            {!scanning && phase === "done" && result ? (
              <Suspense
                fallback={
                  <div className="py-8 text-center text-sm text-muted-foreground">Loading results…</div>
                }
              >
                <DemoRoleResultsPanel
                  result={result}
                  elapsedSec={elapsedSec}
                  showWorkspaceCta={showWorkspaceCta}
                  scanContext={resultScanContext}
                  onScanContextChange={setScanContext}
                  defaultCategory={demoCategory.state.categoryName}
                  defaultSubCategory={subCategoryLabel}
                  previewImageUrl={previewImageUrl}
                  onWorkspaceCta={() =>
                    document.querySelector("#pricing")?.scrollIntoView({ behavior: "smooth" })
                  }
                />
              </Suspense>
            ) : null}
          </div>

          {showImagePane ? (
            <div className="relative border-t border-border bg-surface px-4 py-5 sm:px-6 sm:py-6">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {phase === "done"
                  ? "Annotated shelf photo"
                  : homepageIntro
                    ? "Your shelf photo"
                    : "Shelf photo"}
              </p>
              <div className="relative mx-auto max-w-3xl">
                <img
                  src={displayImageUrl ?? DEFAULT_SAMPLE_IMAGE}
                  alt={phase === "done" ? "Shelf photo analyzed by Aislix" : "Sample retail shelf"}
                  loading="lazy"
                  decoding="async"
                  className="mx-auto max-h-[min(52vh,520px)] w-full rounded-lg object-contain"
                />
                {scanning ? (
                  <div className="absolute inset-0 rounded-lg bg-foreground/15">
                    <Badge className="absolute left-3 top-3 gap-2 rounded-md bg-primary px-3 py-2 text-primary-foreground">
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
  );
}

function EmptyResults() {
  return (
    <div className="grid min-h-48 place-items-center py-6 text-center">
      <p className="max-w-md text-sm text-muted-foreground">
        Choose the sample shelf or upload your photo above — then confirm category, optionally add a
        planogram, and start auditing. Execution, merchandising, brand, and executive views will
        appear here.
      </p>
    </div>
  );
}
