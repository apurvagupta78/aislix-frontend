import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  Check,
  FileText,
  ImageIcon,
  Loader2,
  RefreshCw,
  ScanLine,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  SCAN_STAGES,
  formatBytes,
  submitScan,
  validateScanFile,
  type ScanResponse,
} from "@/lib/scan-api";

export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title: "New Shelf Scan — Aislix" },
      {
        name: "description",
        content:
          "Capture or upload a shelf photo and run Aislix computer vision to detect products, brands and inventory.",
      },
      { property: "og:title", content: "New shelf scan — Aislix" },
      {
        property: "og:description",
        content: "Take a photo or upload a shelf image to start an AI retail audit.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ScanPage,
});

type Phase = "idle" | "processing" | "success" | "error";

function ScanPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const [phase, setPhase] = useState<Phase>("idle");
  const [stageIndex, setStageIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResponse | null>(null);

  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (stageTimer.current) clearInterval(stageTimer.current);
    },
    [],
  );

  const acceptFile = useCallback((incoming: File | undefined | null) => {
    if (!incoming) return;
    const problem = validateScanFile(incoming);
    if (problem) {
      setFileError(problem);
      return;
    }
    setFileError(null);
    setErrorMessage(null);
    setResult(null);
    setPhase("idle");
    setFile(incoming);
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    if (stageTimer.current) clearInterval(stageTimer.current);
    setFile(null);
    setFileError(null);
    setErrorMessage(null);
    setResult(null);
    setProgress(0);
    setStageIndex(0);
    setPhase("idle");
  }, []);

  const startScan = useCallback(async () => {
    if (!file || phase === "processing") return; // guards duplicate submissions

    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("processing");
    setErrorMessage(null);
    setStageIndex(0);
    setProgress(0);

    try {
      const response = await submitScan(file, {
        signal: controller.signal,
        onUploadProgress: (percent) => {
          setStageIndex(0);
          setProgress(Math.min(18, Math.round(percent * 0.18)));
        },
      });

      // Upload finished; walk the remaining analysis stages until the
      // response is rendered. Replace with backend-reported stages when
      // POST /scan streams status.
      setStageIndex(1);
      setProgress(24);
      await new Promise<void>((resolve) => {
        let p = 24;
        stageTimer.current = setInterval(() => {
          p = Math.min(100, p + 4);
          setProgress(p);
          setStageIndex(
            Math.min(SCAN_STAGES.length - 1, Math.floor((p / 100) * SCAN_STAGES.length)),
          );
          if (p >= 100) {
            if (stageTimer.current) clearInterval(stageTimer.current);
            resolve();
          }
        }, 90);
      });

      setResult(response);
      setPhase("success");
    } catch (error) {
      if (stageTimer.current) clearInterval(stageTimer.current);
      if (error instanceof DOMException && error.name === "AbortError") {
        setPhase("idle");
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : "The scan could not be completed.");
      setPhase("error");
    } finally {
      abortRef.current = null;
    }
  }, [file, phase]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    if (stageTimer.current) clearInterval(stageTimer.current);
    setPhase("idle");
    setProgress(0);
    setStageIndex(0);
  }, []);

  return (
    <AppShell
      title="New scan"
      description="Capture a shelf with your camera or upload an image to run an AI audit."
      actions={
        file ? (
          <Button variant="subtle" size="sm" className="rounded-xl" onClick={reset}>
            <Trash2 className="size-4" /> Clear
          </Button>
        ) : undefined
      }
    >
      <input
        ref={cameraInput}
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          acceptFile(e.target.files?.[0]);
          e.currentTarget.value = "";
        }}
      />
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/jpg,image/png"
        className="sr-only"
        onChange={(e) => {
          acceptFile(e.target.files?.[0]);
          e.currentTarget.value = "";
        }}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {!file ? (
            <div className="card-surface p-4 sm:p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => cameraInput.current?.click()}
                  className="group flex flex-col items-start gap-3 rounded-2xl border border-border bg-surface p-5 text-left transition-all hover:border-brand/45 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="grid size-11 place-items-center rounded-xl bg-gradient-brand text-brand-foreground transition-transform group-hover:scale-105">
                    <Camera className="size-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">Take photo</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Opens the rear camera on mobile devices
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="group flex flex-col items-start gap-3 rounded-2xl border border-border bg-surface p-5 text-left transition-all hover:border-brand/45 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand transition-transform group-hover:scale-105">
                    <UploadCloud className="size-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">Upload image</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Browse files or your photo gallery
                    </span>
                  </span>
                </button>
              </div>

              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInput.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") fileInput.current?.click();
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  acceptFile(e.dataTransfer.files?.[0]);
                }}
                className={cn(
                  "mt-3 hidden cursor-pointer place-items-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors sm:grid",
                  dragging
                    ? "border-brand bg-brand-soft/60"
                    : "border-border bg-surface hover:border-brand/50 hover:bg-brand-soft/35",
                )}
              >
                <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">
                  <ImageIcon className="size-5" />
                </span>
                <p className="mt-4 text-sm font-medium">Drag and drop a shelf image here</p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  JPG, JPEG or PNG · up to 10 MB · one image per scan
                </p>
              </div>

              {fileError && (
                <div
                  role="alert"
                  className="mt-3 flex items-start gap-2.5 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3"
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <p className="text-sm text-destructive">{fileError}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="card-surface overflow-hidden">
              <div className="relative bg-muted">
                {previewUrl && (
                  <img
                    src={previewUrl}
                    alt={`Preview of the shelf image ${file.name}`}
                    className="max-h-[26rem] w-full animate-fade-in object-contain"
                  />
                )}
                <div className="absolute right-3 top-3 flex gap-2">
                  <Button
                    variant="subtle"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => fileInput.current?.click()}
                  >
                    <RefreshCw className="size-4" /> Replace
                  </Button>
                  <Button variant="subtle" size="icon" className="rounded-xl" onClick={reset}>
                    <X className="size-4" />
                    <span className="sr-only">Remove image</span>
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-border px-4 py-4 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-green-soft text-accent-green">
                    <Check className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(file.size)} · ready to scan
                    </p>
                  </div>
                </div>
                <Button
                  variant="brand"
                  size="sm"
                  className="rounded-xl"
                  onClick={startScan}
                  disabled={phase === "processing"}
                >
                  <ScanLine className="size-4" /> Start scan
                </Button>
              </div>
            </div>
          )}

          {phase === "error" && (
            <div
              role="alert"
              className="card-surface flex flex-col gap-4 border-destructive/25 p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive">
                  <AlertTriangle className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Scan failed</p>
                  <p className="mt-1 text-sm text-muted-foreground">{errorMessage}</p>
                </div>
              </div>
              <Button variant="brand" size="sm" className="rounded-xl" onClick={startScan}>
                <RefreshCw className="size-4" /> Try again
              </Button>
            </div>
          )}

          {phase === "success" && (
            <div className="card-surface flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-green-soft text-accent-green">
                  <Check className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Scan complete</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {result?.scan_id ? `Scan ${result.scan_id} is ready.` : "Your scan is ready."}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {result?.report_url && (
                  <Button asChild variant="brand" size="sm" className="rounded-xl">
                    <a href={result.report_url} target="_blank" rel="noreferrer">
                      <FileText className="size-4" /> View report
                    </a>
                  </Button>
                )}
                <Button variant="subtle" size="sm" className="rounded-xl" onClick={reset}>
                  New scan <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="card-surface p-5 sm:p-6">
            <h2 className="text-sm font-semibold tracking-tight">What happens next</h2>
            <ol className="mt-4 space-y-3">
              {SCAN_STAGES.map((stage, i) => (
                <li key={stage} className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
                    {i + 1}
                  </span>
                  <span className="text-sm text-muted-foreground">{stage}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="card-surface p-5 sm:p-6">
            <h2 className="text-sm font-semibold tracking-tight">Capture tips</h2>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li>Frame the full shelf height in one shot.</li>
              <li>Stand 1.5–2 m back and hold the phone level.</li>
              <li>Avoid glare, shadows and motion blur.</li>
            </ul>
          </div>
        </aside>
      </div>

      {phase === "processing" && (
        <ProcessingOverlay
          stageIndex={stageIndex}
          progress={progress}
          previewUrl={previewUrl}
          onCancel={cancel}
        />
      )}
    </AppShell>
  );
}

function ProcessingOverlay({
  stageIndex,
  progress,
  previewUrl,
  onCancel,
}: {
  stageIndex: number;
  progress: number;
  previewUrl: string | null;
  onCancel: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-busy="true"
      aria-label="Scan in progress"
      className="fixed inset-0 z-50 animate-fade-in overflow-y-auto bg-background/98 backdrop-blur-sm"
    >
      <div className="mx-auto flex min-h-full w-full max-w-xl flex-col justify-center px-5 py-10">
        <div className="text-center">
          <div className="relative mx-auto grid size-24 place-items-center">
            <span className="absolute inset-0 animate-pulse rounded-full bg-brand-soft" />
            {previewUrl ? (
              <img
                src={previewUrl}
                alt=""
                className="relative size-20 rounded-full object-cover shadow-card"
              />
            ) : (
              <span className="relative grid size-20 place-items-center rounded-full bg-gradient-brand">
                <Loader2 className="size-7 animate-spin text-brand-foreground" />
              </span>
            )}
          </div>
          <h2 className="mt-6 text-lg font-semibold tracking-tight sm:text-xl">
            Analyzing your shelf
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Keep this page open — this usually takes under a minute.
          </p>
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate">{SCAN_STAGES[stageIndex]}</span>
            <span className="shrink-0 tabular-nums">{progress}%</span>
          </div>
          <Progress value={progress} className="mt-2 h-2 rounded-full" />
        </div>

        <ul className="mt-8 space-y-3">
          {SCAN_STAGES.map((stage, i) => {
            const done = i < stageIndex || progress >= 100;
            const active = i === stageIndex && progress < 100;
            return (
              <li key={stage} className="flex items-center gap-3">
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full",
                    done
                      ? "bg-accent-green text-brand-foreground"
                      : active
                        ? "bg-brand text-brand-foreground"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {done ? (
                    <Check className="size-3.5" />
                  ) : active ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-current" />
                  )}
                </span>
                <span
                  className={cn(
                    "text-sm",
                    done || active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {stage}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="mt-9 flex justify-center">
          <Button variant="ghost" size="sm" className="rounded-xl" onClick={onCancel}>
            Cancel scan
          </Button>
        </div>
      </div>
    </div>
  );
}
