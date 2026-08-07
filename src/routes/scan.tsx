import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  Check,
  ImageIcon,
  Loader2,
  Plus,
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
  MAX_SCAN_IMAGES,
  SCAN_STAGES,
  formatBytes,
  retryScanAnalysis,
  runScanAnalysis,
  submitScanImages,
  validateScanFile,
} from "@/lib/scan-api";

export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title: "New Shelf Scan — Aislix" },
      {
        name: "description",
        content:
          "Capture or upload shelf photos and run the Aislix AI pipeline to detect products, brands and inventory.",
      },
      { property: "og:title", content: "New shelf scan — Aislix" },
      {
        property: "og:description",
        content: "Take photos or upload shelf images to start an AI retail audit.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ScanPage,
});

type Phase = "idle" | "uploading" | "error";

type Attachment = { id: string; file: File; url: string };

function ScanPage() {
  const [items, setItems] = useState<Attachment[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rawResponse, setRawResponse] = useState<string | null>(null);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);

  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const itemsRef = useRef<Attachment[]>([]);

  itemsRef.current = items;

  const stopTimer = () => {
    if (stageTimer.current) {
      clearInterval(stageTimer.current);
      stageTimer.current = null;
    }
  };

  useEffect(
    () => () => {
      abortRef.current?.abort();
      stopTimer();
      for (const item of itemsRef.current) URL.revokeObjectURL(item.url);
    },
    [],
  );

  const acceptFiles = useCallback((incoming: FileList | File[] | null | undefined) => {
    const files = Array.from(incoming ?? []);
    if (!files.length) return;

    setFileError(null);
    setErrorMessage(null);
    setScanId(null);
    setPhase("idle");

    setItems((current) => {
      const next = [...current];
      for (const file of files) {
        if (next.length >= MAX_SCAN_IMAGES) {
          setFileError(`You can scan up to ${MAX_SCAN_IMAGES} images at a time.`);
          break;
        }
        const problem = validateScanFile(file);
        if (problem) {
          setFileError(problem);
          continue;
        }
        next.push({
          id: `${file.name}-${file.size}-${Date.now()}-${next.length}`,
          file,
          url: URL.createObjectURL(file),
        });
      }
      return next;
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((current) => {
      const target = current.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return current.filter((item) => item.id !== id);
    });
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    stopTimer();
    setItems((current) => {
      for (const item of current) URL.revokeObjectURL(item.url);
      return [];
    });
    setFileError(null);
    setErrorMessage(null);
    setScanId(null);
    setProgress(0);
    setStageIndex(0);
    setPhase("idle");
  }, []);

  /** Creeps the progress bar through the analysis stages while the API works. */
  const startStageTicker = useCallback(() => {
    stopTimer();
    let p = 22;
    setProgress(p);
    setStageIndex(1);
    stageTimer.current = setInterval(() => {
      p = Math.min(94, p + 1.5);
      setProgress(Math.round(p));
      setStageIndex(Math.min(SCAN_STAGES.length - 1, Math.floor((p / 100) * SCAN_STAGES.length)));
    }, 700);
  }, []);

  const finish = useCallback(
    async (id: string) => {
      stopTimer();
      setStageIndex(SCAN_STAGES.length - 1);
      setProgress(100);
      await navigate({ to: "/results", search: { scan: id } });
    },
    [navigate],
  );

  const startScan = useCallback(async () => {
    if (!items.length || phase === "uploading" || phase === "analyzing") return;

    const controller = new AbortController();
    abortRef.current = controller;
    setErrorMessage(null);
    setStageIndex(0);
    setProgress(0);
    setPhase("uploading");

    let createdScanId: string | null = null;
    try {
      const created = await submitScanImages(
        items.map((item) => item.file),
        {
          signal: controller.signal,
          onUploadProgress: (percent) => {
            setStageIndex(0);
            setProgress(Math.min(20, Math.round(percent * 0.2)));
          },
        },
      );
      createdScanId = created.scan_id;
      setScanId(created.scan_id);

      setPhase("analyzing");
      startStageTicker();
      const analysis = await runScanAnalysis(created.scan_id);
      await finish(analysis.scan_id);
    } catch (error) {
      stopTimer();
      if (error instanceof DOMException && error.name === "AbortError") {
        setPhase("idle");
        setProgress(0);
        return;
      }
      if (createdScanId) setScanId(createdScanId);
      setErrorMessage(
        error instanceof Error ? error.message : "The scan could not be completed.",
      );
      setPhase("error");
    } finally {
      abortRef.current = null;
    }
  }, [items, phase, startStageTicker, finish]);

  /** Retries analysis only — the images are already in storage. */
  const retryScan = useCallback(async () => {
    if (!scanId) {
      void startScan();
      return;
    }
    setErrorMessage(null);
    setPhase("analyzing");
    startStageTicker();
    try {
      const analysis = await retryScanAnalysis(scanId);
      await finish(analysis.scan_id);
    } catch (error) {
      stopTimer();
      setErrorMessage(error instanceof Error ? error.message : "The scan could not be completed.");
      setPhase("error");
    }
  }, [scanId, startScan, startStageTicker, finish]);

  const cancelUpload = useCallback(() => {
    abortRef.current?.abort();
    stopTimer();
    setPhase("idle");
    setProgress(0);
    setStageIndex(0);
  }, []);

  const busy = phase === "uploading" || phase === "analyzing";

  return (
    <AppShell
      title="New scan"
      description="Capture shelves with your camera or upload images to run an AI audit."
      actions={
        items.length && !busy ? (
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
          acceptFiles(e.target.files);
          e.currentTarget.value = "";
        }}
      />
      <input
        ref={fileInput}
        type="file"
        multiple
        accept="image/jpeg,image/jpg,image/png"
        className="sr-only"
        onChange={(e) => {
          acceptFiles(e.target.files);
          e.currentTarget.value = "";
        }}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="card-surface p-4 sm:p-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => cameraInput.current?.click()}
                disabled={busy}
                className="group flex flex-col items-start gap-3 rounded-2xl border border-border bg-surface p-5 text-left transition-all hover:border-brand/45 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
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
                disabled={busy}
                className="group flex flex-col items-start gap-3 rounded-2xl border border-border bg-surface p-5 text-left transition-all hover:border-brand/45 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand transition-transform group-hover:scale-105">
                  <UploadCloud className="size-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">Upload images</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Select up to {MAX_SCAN_IMAGES} shelf photos
                  </span>
                </span>
              </button>
            </div>

            {items.length === 0 && (
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
                  acceptFiles(e.dataTransfer.files);
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
                <p className="mt-4 text-sm font-medium">Drag and drop shelf images here</p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  JPG, JPEG or PNG · up to 10 MB each · up to {MAX_SCAN_IMAGES} per scan
                </p>
              </div>
            )}

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

          {items.length > 0 && (
            <div className="card-surface overflow-hidden">
              <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
                {items.map((item, index) => (
                  <figure
                    key={item.id}
                    className="relative overflow-hidden rounded-2xl border border-border bg-muted"
                  >
                    <img
                      src={item.url}
                      alt={`Preview of shelf image ${index + 1}: ${item.file.name}`}
                      className="h-44 w-full animate-fade-in object-cover"
                    />
                    {!busy && (
                      <Button
                        variant="subtle"
                        size="icon"
                        className="absolute right-2 top-2 rounded-xl"
                        onClick={() => removeItem(item.id)}
                      >
                        <X className="size-4" />
                        <span className="sr-only">Remove {item.file.name}</span>
                      </Button>
                    )}
                    <figcaption className="flex items-center gap-2 border-t border-border bg-surface px-3 py-2">
                      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent-green-soft text-accent-green">
                        <Check className="size-3.5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-medium">{item.file.name}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {formatBytes(item.file.size)}
                        </span>
                      </span>
                    </figcaption>
                  </figure>
                ))}
              </div>

              <div className="flex flex-col gap-3 border-t border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <p className="text-sm text-muted-foreground">
                  {items.length} of {MAX_SCAN_IMAGES} images ready to scan
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="subtle"
                    size="sm"
                    className="rounded-xl"
                    disabled={busy || items.length >= MAX_SCAN_IMAGES}
                    onClick={() => fileInput.current?.click()}
                  >
                    <Plus className="size-4" /> Add image
                  </Button>
                  <Button
                    variant="brand"
                    size="sm"
                    className="rounded-xl"
                    onClick={startScan}
                    disabled={busy}
                  >
                    <ScanLine className="size-4" /> Start scan
                  </Button>
                </div>
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
                  {scanId && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Your images are saved — retrying re-runs the analysis only.
                    </p>
                  )}
                </div>
              </div>
              <Button variant="brand" size="sm" className="rounded-xl" onClick={retryScan}>
                <RefreshCw className="size-4" /> Retry scan
              </Button>
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

      {busy && (
        <ProcessingOverlay
          stageIndex={stageIndex}
          progress={progress}
          previewUrl={items[0]?.url ?? null}
          imageCount={items.length}
          canCancel={phase === "uploading"}
          onCancel={cancelUpload}
        />
      )}
    </AppShell>
  );
}

function ProcessingOverlay({
  stageIndex,
  progress,
  previewUrl,
  imageCount,
  canCancel,
  onCancel,
}: {
  stageIndex: number;
  progress: number;
  previewUrl: string | null;
  imageCount: number;
  canCancel: boolean;
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
            Analyzing {imageCount === 1 ? "your shelf" : `${imageCount} shelf images`}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Keep this page open — you'll be taken to the results automatically.
          </p>
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate">{SCAN_STAGES[stageIndex]}</span>
            <span className="shrink-0 tabular-nums">{progress}%</span>
          </div>
          <Progress value={progress} className="mt-2 h-2 rounded-full" />

          <ul className="mt-7 space-y-3 text-left">
            {SCAN_STAGES.map((stage, i) => {
              const done = i < stageIndex || progress >= 100;
              const active = i === stageIndex && progress < 100;
              return (
                <li key={stage} className="flex items-center gap-3">
                  <span
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full text-brand-foreground",
                      done ? "bg-brand" : active ? "bg-brand/60" : "bg-muted",
                    )}
                  >
                    {done ? (
                      <Check className="size-3.5" />
                    ) : active ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <span className="size-1.5 rounded-full bg-muted-foreground" />
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
        </div>

        {canCancel && (
          <div className="mt-9 flex justify-center">
            <Button variant="subtle" size="sm" className="rounded-xl" onClick={onCancel}>
              Cancel upload
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
