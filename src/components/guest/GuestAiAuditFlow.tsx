import { Suspense, lazy, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, FileSpreadsheet, RotateCcw } from "lucide-react";

import { PageHeader } from "@/components/design-system";
import { AiDocumentAuditSetup } from "@/components/new-audit/AiDocumentAuditSetup";
import { NewAuditStepSection } from "@/components/new-audit/NewAuditStepSection";
import { STEP_3_DESCRIPTION, STEP_3_TITLE } from "@/components/new-audit/steps/NewAuditStep2StartMethod";
import { NewAuditStep7Capture } from "@/components/new-audit/steps/NewAuditStep7Capture";
import { ScanProgressPanel } from "@/components/scan/ScanProgressPanel";
import { Button } from "@/components/ui/button";
import {
  aiAnalysisReady,
  buildAiAnalysisRequest,
  defaultAiChecks,
  type AiAnalysisCheck,
} from "@/lib/ai-audit/ai-analysis";
import {
  buildDemoSampleDocumentContext,
  demoSampleDocument,
  DEMO_SAMPLE_CHECKS,
  DEMO_SAMPLE_QUESTION,
} from "@/lib/ai-audit/demo-sample-document";
import { usableReferenceRows } from "@/lib/ai-audit/reference-document";
import { networkErrorMessage } from "@/lib/api-errors";
import { DEMO_ORAL_CARE_META } from "@/lib/demo-oral-care-planogram";
import { trackLandingEvent } from "@/lib/landing-analytics";
import {
  DEFAULT_SAMPLE_ID,
  DEFAULT_SAMPLE_IMAGE,
  loadLandingSessionId,
  persistLandingSession,
  runLandingSample,
  runLandingUpload,
  type LandingScanContext,
  type LandingScanResult,
} from "@/lib/landing-scan-api";
import type { NewAuditPlanogramChoice } from "@/lib/new-audit/planogram-setup";
import { withReferencePlanogramRows } from "@/lib/new-audit/reference-context";
import { aiStep3Error } from "@/lib/new-audit/step-validation";
import { EMPTY_PLANOGRAM_META } from "@/lib/planogram-meta";
import { EMPTY_SCAN_CONTEXT, type ScanContextState } from "@/lib/scan-context";

const DemoRoleResultsPanel = lazy(() =>
  import("@/components/scan/DemoRoleResultsPanel").then((m) => ({ default: m.DemoRoleResultsPanel })),
);

const GUEST_SCAN_CONTEXT: ScanContextState = {
  ...EMPTY_SCAN_CONTEXT,
  planogramMeta: { ...EMPTY_PLANOGRAM_META, category: "" },
};
const SAMPLE_DOCUMENT_NAME = "sample-stock-list.csv";
const SCAN_TIMING_MESSAGE = "This usually takes 2–3 minutes for large shelves. Keep this page open.";

type Phase = "setup" | "scanning" | "done";

function landingImageUrl(result: LandingScanResult): string | null {
  const base64 = result.annotated_image_base64 ?? result.original_image_base64;
  if (!base64) return null;
  const mime = result.annotated_image_base64 ? result.annotated_image_mime : result.original_image_mime;
  return `data:${mime || "image/jpeg"};base64,${base64}`;
}

/** Guest version of New audit → AI audit: same Step 3 and photo step, run on the public demo API. */
export function GuestAiAuditFlow({ intent }: { intent?: "sample" | "upload" }) {
  const navigate = useNavigate();
  const startWithSample = intent === "sample";
  const [choice, setChoice] = useState<NewAuditPlanogramChoice>("reference");
  const [scanContext, setScanContext] = useState<ScanContextState>(() =>
    startWithSample ? buildDemoSampleDocumentContext() : GUEST_SCAN_CONTEXT,
  );
  const [checks, setChecks] = useState<AiAnalysisCheck[]>(() =>
    startWithSample ? [...DEMO_SAMPLE_CHECKS] : [],
  );
  const [question, setQuestion] = useState(() => (startWithSample ? DEMO_SAMPLE_QUESTION : ""));
  const [captureFiles, setCaptureFiles] = useState<File[]>([]);
  const [useSamplePhoto, setUseSamplePhoto] = useState(startWithSample);
  const [phase, setPhase] = useState<Phase>("setup");
  const [result, setResult] = useState<LandingScanResult | null>(null);
  const [resultContext, setResultContext] = useState<ScanContextState>(GUEST_SCAN_CONTEXT);
  const [elapsedSec, setElapsedSec] = useState<number | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const aiScanContext = useMemo(
    () =>
      choice === "reference"
        ? withReferencePlanogramRows(scanContext)
        : { ...scanContext, reference: undefined },
    [choice, scanContext],
  );
  const referenceRows = choice === "reference" ? (scanContext.reference?.rows ?? []) : null;
  const analysis = useMemo(
    () => buildAiAnalysisRequest(checks, question, referenceRows),
    [checks, question, referenceRows],
  );
  const setupError = aiStep3Error(choice, aiScanContext, aiAnalysisReady(analysis));
  const hasPhoto = useSamplePhoto || captureFiles.length > 0;
  const photoError = hasPhoto ? null : "Add a shelf photo or use the sample shelf photo.";
  const scanning = phase === "scanning";
  const canRun = !scanning && !setupError && !photoError;
  const usingSampleDocument = scanContext.reference?.meta.filename === SAMPLE_DOCUMENT_NAME;

  function loadSampleDocument() {
    const reference = demoSampleDocument();
    setScanContext((ctx) => ({
      ...ctx,
      reference,
      planogramMeta: {
        ...(ctx.planogramMeta ?? EMPTY_PLANOGRAM_META),
        category: DEMO_ORAL_CARE_META.category,
        sub_category: DEMO_ORAL_CARE_META.sub_category,
      },
    }));
    setChecks(defaultAiChecks(reference.rows));
    if (!question.trim()) setQuestion(DEMO_SAMPLE_QUESTION);
  }

  async function run() {
    const photo = captureFiles[0];
    if (!canRun || (!useSamplePhoto && !photo)) return;
    const ctx: ScanContextState = { ...aiScanContext, aiAnalysis: analysis };
    const category = ctx.planogramMeta?.category?.trim() || undefined;
    const subCategory = ctx.planogramMeta?.sub_category?.trim() || undefined;
    const landingContext: LandingScanContext = {
      category,
      sub_category: subCategory,
      sub_category_label: subCategory,
      scanContext: ctx,
    };
    const mode = useSamplePhoto ? "sample" : "upload";
    setRunError(null);
    setResult(null);
    setResultContext(ctx);
    setPhase("scanning");
    window.scrollTo({ top: 0, behavior: "smooth" });
    trackLandingEvent("demo_scan_started", { mode });
    const startedAt = Date.now();
    try {
      const sessionId = loadLandingSessionId() ?? undefined;
      const scan =
        useSamplePhoto || !photo
          ? await runLandingSample(DEFAULT_SAMPLE_ID, sessionId, landingContext)
          : await runLandingUpload(photo, { ...landingContext, landingSessionId: sessionId });
      setResult(scan);
      setElapsedSec(Math.max(1, Math.round((Date.now() - startedAt) / 1000)));
      persistLandingSession(scan);
      setPhase("done");
      trackLandingEvent("demo_scan_completed", {
        scan_id: scan.scan_id,
        landing_session_id: scan.landing_session_id,
      });
    } catch (err) {
      const status = (err as { status?: number }).status;
      setRunError(
        status === 429
          ? "You've used all free demo audits for today. Create a free account to keep auditing."
          : networkErrorMessage(err),
      );
      setPhase("setup");
      trackLandingEvent("demo_scan_failed");
    }
  }

  function startOver() {
    setResult(null);
    setElapsedSec(null);
    setRunError(null);
    setPhase("setup");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const sampleDocumentAction = usingSampleDocument ? null : (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#D9E2E8] bg-white px-4 py-3 text-xs text-[#667085]">
      <span>No document handy? Try the sample stock list for the sample shelf.</span>
      <Button type="button" variant="outline" size="sm" onClick={loadSampleDocument}>
        <FileSpreadsheet className="size-4" /> Use sample stock list
      </Button>
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-36">
      <PageHeader
        title="New audit"
        description="Try an AI audit as a guest — no login needed. Results are not saved to a workspace."
      />

      {runError ? (
        <div className="rounded-xl border border-[#ECBDCC] bg-white px-4 py-3 text-sm text-[#04203F]">
          {runError}
        </div>
      ) : null}

      {scanning ? (
        <div className="grid min-h-64 place-items-center rounded-xl border border-[#D9E2E8] bg-white p-6">
          <ScanProgressPanel active expectedMs={60_000} timingMessage={SCAN_TIMING_MESSAGE} />
        </div>
      ) : null}

      {phase === "done" && result ? (
        <div className="rounded-xl border border-[#D9E2E8] bg-white p-4 sm:p-6">
          <Suspense fallback={<div className="py-8 text-center text-sm text-[#667085]">Loading results…</div>}>
            <DemoRoleResultsPanel
              result={result}
              elapsedSec={elapsedSec}
              showWorkspaceCta
              scanContext={resultContext}
              onScanContextChange={setResultContext}
              defaultCategory={resultContext.planogramMeta?.category}
              defaultSubCategory={resultContext.planogramMeta?.sub_category}
              previewImageUrl={useSamplePhoto ? DEFAULT_SAMPLE_IMAGE : landingImageUrl(result)}
              onWorkspaceCta={() => void navigate({ to: "/signup" })}
            />
          </Suspense>
        </div>
      ) : null}

      {phase === "setup" ? (
        <div className="space-y-6">
          <NewAuditStepSection
            id="step-3-start"
            stepNumber={1}
            title={STEP_3_TITLE}
            description={STEP_3_DESCRIPTION}
            complete={!setupError}
            error={setupError}
          >
            <AiDocumentAuditSetup
              choice={choice}
              scanContext={scanContext}
              onScanContextChange={setScanContext}
              onChoiceChange={setChoice}
              checks={checks}
              question={question}
              onChecksChange={setChecks}
              onQuestionChange={setQuestion}
              uploadAction={sampleDocumentAction}
            />
          </NewAuditStepSection>

          <NewAuditStep7Capture
            stepNumber={2}
            maxPhotos={1}
            captureFiles={captureFiles}
            onCaptureChange={(files) => setCaptureFiles(files)}
            role={aiScanContext.auditRole}
            disabled={scanning}
            complete={hasPhoto}
            sample={{
              imageUrl: DEFAULT_SAMPLE_IMAGE,
              active: useSamplePhoto,
              onUse: () => setUseSamplePhoto(true),
              onClear: () => setUseSamplePhoto(false),
            }}
          />
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--aislix-border)] bg-white/95 px-4 py-3 backdrop-blur md:px-6">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <Button variant="ghost" asChild>
            <Link to="/">Cancel</Link>
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="hidden sm:inline-flex" asChild>
              <Link to="/signup">Create free account</Link>
            </Button>
            {phase === "done" ? (
              <Button variant="brand" onClick={startOver}>
                <RotateCcw className="size-4" /> Run another audit
              </Button>
            ) : (
              <Button
                variant="brand"
                disabled={!canRun}
                title={setupError ?? photoError ?? undefined}
                onClick={() => void run()}
              >
                <CheckCircle2 className="size-4" />
                {scanning ? "Running AI audit…" : "Run AI audit"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
