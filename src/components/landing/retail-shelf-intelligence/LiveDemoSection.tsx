import { useEffect, useRef, useState } from "react";
import { AlertCircle, ImagePlus, Loader2, Sparkles } from "lucide-react";
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
import { ScanProgressPanel } from "@/components/scan/ScanProgressPanel";
import { DemoRoleResultsPanel } from "@/components/scan/DemoRoleResultsPanel";
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
const MIN_SCAN_MS = 8_000;
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
  const [elapsedSec, setElapsedSec] = useState<number | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isSampleFlow, setIsSampleFlow] = useState(true);
  const objectUrlRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    setPreviewImageUrl(DEFAULT_SAMPLE_IMAGE);
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  async function run(mode: "sample" | "upload", file?: File) {
    setError(null);
    setResult(null);
    setElapsedSec(null);
    setPhase("scanning");
    trackLandingEvent("demo_scan_started", { mode });
    const startedAt = Date.now();

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
    // Switching to the upload flow: the visitor picks their own shelf type.
    setPendingFile(file);
    setIsSampleFlow(false);
    setError(null);
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

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {isSampleFlow ? (
            <>
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
                disabled={scanning}
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus className="size-4" /> Upload Your Shelf Photo
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


        <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card shadow-lift">
          {/* Results first — full width */}
          <div className="p-4 sm:p-6 lg:p-8">
            {scanning && (
              <div className="grid min-h-48 place-items-center py-8">
                <ScanProgressPanel active expectedMs={60_000} timingMessage={DEMO_TIMING_MESSAGE} />
              </div>
            )}

            {phase === "error" ? (
              <div>
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{error}</span>
                </div>
                <EmptyResults />
              </div>
            ) : null}

            {phase === "idle" && <EmptyResults />}

            {phase === "done" && result && (
              <DemoRoleResultsPanel
                result={result}
                elapsedSec={elapsedSec}
                showWorkspaceCta={showWorkspaceCta}
                defaultCategory={demoCategory.state.categoryName}
                defaultSubCategory={
                  demoCategory.categories
                    .find((c) => c.name === demoCategory.state.categoryName)
                    ?.subcategories?.find((s) => s.id === demoCategory.state.subId)?.label
                }
                onDownloadCsv={() => downloadLandingCsv(result)}
                onWorkspaceCta={() =>
                  document.querySelector("#lead")?.scrollIntoView({ behavior: "smooth" })
                }
              />
            )}
          </div>

          {/* Shelf image at bottom */}
          {shownImage && (
            <div className="relative border-t border-border bg-surface px-4 py-5 sm:px-6 sm:py-6">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {phase === "done" ? "Annotated shelf photo" : "Shelf photo"}
              </p>
              <div className="relative mx-auto max-w-3xl">
                <img
                  src={shownImage}
                  alt={phase === "done" ? "Shelf photo analyzed by Aislix" : "Sample retail shelf"}
                  className="mx-auto max-h-[min(52vh,520px)] w-full rounded-lg object-contain"
                />
                {scanning && (
                  <div className="absolute inset-0 rounded-lg bg-foreground/15">
                    <Badge className="absolute left-3 top-3 gap-2 rounded-md bg-primary px-3 py-2 text-primary-foreground">
                      <Loader2 className="size-3.5 animate-spin" /> Analyzing shelf…
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** Strict empty state — never shows placeholder numbers. */
function EmptyResults() {
  return (
    <div className="mt-5 grid min-h-72 place-items-center text-center">
      <p className="max-w-xs text-sm text-muted-foreground">
        Run a sample or upload a photo — execution, merchandising, brand, and executive views
        will appear here with the same panels as a full workspace scan.
      </p>
    </div>
  );
}
