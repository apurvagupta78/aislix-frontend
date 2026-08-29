import { useEffect, useRef, useState } from "react";
import { AlertCircle, Download, ImagePlus, Loader2, Sparkles } from "lucide-react";
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
import { CYAN_BTN, SectionHeading, SignupCta } from "./shared";

type Phase = "idle" | "scanning" | "done" | "error";

const MAX_BYTES = 10 * 1024 * 1024;

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
}: {
  onResult?: (result: LandingScanResult, imageUrl: string | null) => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
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

    try {
      const scan =
        mode === "sample"
          ? await runLandingSample(DEFAULT_SAMPLE_ID, loadLandingSessionId() ?? undefined)
          : file
            ? await runLandingUpload(file, loadLandingSessionId() ?? undefined)
            : null;
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
      const status = (err as { status?: number }).status;
      setError(
        status === 429
          ? "You've used all free demo scans for today. Create a free account to keep scanning."
          : (err as Error).message || "Scan failed. Please try again.",
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
    setPreviewImageUrl(DEFAULT_SAMPLE_IMAGE);
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
    <section id="demo" className="scroll-mt-16 bg-background py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Live demo"
          title="See What Aislix Sees"
          subtitle="Try a real shelf scan — no login required."
        />

        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Button
            size="xl"
            className={`min-h-11 w-full sm:w-auto ${CYAN_BTN}`}
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

        <div className="mt-8 overflow-hidden rounded-2xl border border-landing-border bg-card shadow-lift lg:grid lg:grid-cols-[55fr_45fr]">
          {/* Shelf image */}
          <div className="relative grid min-h-80 place-items-center overflow-hidden bg-landing-surface lg:min-h-[600px] lg:border-r lg:border-landing-border">
            {shownImage && (
              <img
                src={shownImage}
                alt={phase === "done" ? "Shelf photo analyzed by Aislix" : "Sample retail shelf"}
                className="h-full max-h-[700px] w-full object-contain p-3 sm:p-5"
              />
            )}
            {scanning && (
              <div className="absolute inset-0 bg-landing-navy/20">
                <Badge className={`absolute left-4 top-4 gap-2 rounded-md px-3 py-2 ${CYAN_BTN}`}>
                  <Loader2 className="size-3.5 animate-spin" /> Analyzing shelf…
                </Badge>
              </div>
            )}
          </div>

          {/* Analysis */}
          <div className="min-w-0 p-5 sm:p-7">
            {scanning && (
              <div className="grid min-h-72 place-items-center text-center">
                <div>
                  <Loader2 className="mx-auto size-6 animate-spin text-landing-cyan" />
                  <p className="mt-4 text-sm font-medium text-foreground">Analyzing shelf… 30–90s</p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Detecting products, brands and availability gaps.
                  </p>
                </div>
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
              <div className="grid min-h-72 place-items-center">
                <div className="w-full">
                  <div className="grid grid-cols-3 gap-3">
                    {["Products detected", "Unique SKUs", "Shelf health"].map((label) => (
                      <div
                        key={label}
                        className="rounded-lg border border-landing-border bg-landing-surface p-3"
                      >
                        <p className="text-lg font-semibold tracking-tight text-muted-foreground">—</p>
                        <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                          {label}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-5 text-center text-sm text-muted-foreground">
                    Click <span className="font-medium text-foreground">Try Sample Shelf</span> to
                    run live AI analysis.
                  </p>
                </div>
              </div>
            )}

            {phase === "done" && result && (
              <div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Products detected", value: result.metrics?.total_products },
                    { label: "Unique SKUs", value: result.metrics?.unique_skus },
                    {
                      label: "Shelf health",
                      value:
                        result.metrics?.shelf_health_score != null
                          ? `${Math.round(result.metrics.shelf_health_score)}%`
                          : undefined,
                    },
                  ].map((m) => (
                    <div
                      key={m.label}
                      className="rounded-lg border border-landing-border bg-landing-surface p-3"
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

                {result.executive_summary && (
                  <p className="mt-4 line-clamp-4 text-sm leading-relaxed text-muted-foreground">
                    {result.executive_summary}
                  </p>
                )}

                <div className="mt-5 max-h-72 overflow-auto rounded-lg border border-landing-border">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-landing-surface text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Brand</th>
                        <th className="px-3 py-2 font-medium">Product</th>
                        <th className="px-3 py-2 font-medium">Qty</th>
                        <th className="px-3 py-2 font-medium">Conf.</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.inventory?.map((row, i) => (
                        <tr
                          key={`${row.brand}-${row.product_name}-${i}`}
                          className="border-t border-landing-border"
                        >
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
                </div>

                {result.scans_daily_limit != null && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {result.scans_used_today ?? 0} of {result.scans_daily_limit} free demo scans used
                    today
                  </p>
                )}

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <SignupCta
                    location="demo_results"
                    event="feature_cta_click"
                    className="w-full sm:flex-1"
                  />
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto"
                    disabled={!result.csv_base64}
                    onClick={() => downloadLandingCsv(result)}
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
  );
}
