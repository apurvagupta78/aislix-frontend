import { useEffect, useRef, useState } from "react";
import { AlertCircle, Download, ImagePlus, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trackLandingEvent } from "@/lib/landing-analytics";
import {
  downloadLandingCsv,
  getSamplePreviewUrl,
  loadLandingSessionId,
  persistLandingSession,
  runLandingSample,
  runLandingScan,
  type LandingScanResult,
} from "@/lib/landing-scan-api";
import { LeadCaptureSection } from "./LeadCaptureSection";

type Phase = "idle" | "scanning" | "done" | "error";

const MAX_BYTES = 10 * 1024 * 1024;

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
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [result, setResult] = useState<LandingScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

  async function run(kind: "sample" | "upload", file?: File) {
    setError(null);
    setResult(null);
    setPhase("scanning");
    trackLandingEvent("demo_scan_started", { kind });

    try {
      const scan =
        kind === "sample"
          ? await runLandingSample("lays-a1l", loadLandingSessionId() ?? undefined)
          : await runLandingScan(file!, loadLandingSessionId() ?? undefined);
      setResult(scan);
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
    setPreviewImageUrl(getSamplePreviewUrl("lays-a1l"));
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

  const shownImage = phase === "done" && result ? (imageSrc(result) ?? previewImageUrl) : previewImageUrl;
  const scanning = phase === "scanning";

  return (
    <>
      <section id="demo" className="border-t border-border py-14">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">See What Aislix Sees</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
              Run a live AI shelf scan right here — no signup, no setup.
            </p>
          </div>

          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Button
              variant="hero"
              size="xl"
              className="min-h-11 w-full sm:w-auto"
              disabled={scanning}
              onClick={onSample}
            >
              <Sparkles className="size-4" /> Try Sample Shelf
            </Button>
            <Button
              variant="outline"
              size="xl"
              className="min-h-11 w-full rounded-xl sm:w-auto"
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

          <div className="mt-8 grid gap-5 lg:grid-cols-[55fr_45fr]">
            {/* IMAGE PANEL */}
            <div className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
              {shownImage ? (
                <>
                  <img
                    src={shownImage}
                    alt="Shelf photo analysed by Aislix"
                    className={`block h-auto w-full ${scanning ? "animate-pulse opacity-90" : ""}`}
                  />
                  {scanning && (
                    <Badge className="absolute left-4 top-4 gap-2 rounded-lg px-3 py-1.5">
                      <Loader2 className="size-3.5 animate-spin" /> Analyzing…
                    </Badge>
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
            <div className="rounded-3xl border border-border bg-card p-5 shadow-soft sm:p-6">
              {scanning && (
                <div className="grid min-h-72 place-items-center text-center">
                  <div>
                    <Loader2 className="mx-auto size-6 animate-spin text-brand" />
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
                <div className="grid min-h-72 place-items-center text-center">
                  <p className="max-w-xs text-sm text-muted-foreground">
                    Your detected products, unique SKUs and shelf health score will appear here.
                  </p>
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
                      <div key={m.label} className="rounded-2xl border border-border bg-surface p-3">
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

                  <div className="mt-5 max-h-80 overflow-auto rounded-2xl border border-border">
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
                        {result.inventory?.map((row, i) => (
                          <tr key={`${row.brand}-${row.product_name}-${i}`} className="border-t border-border">
                            <td className="px-3 py-2">{row.brand || "—"}</td>
                            <td className="px-3 py-2">{row.product_name || "—"}</td>
                            <td className="px-3 py-2">{row.quantity}</td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {row.confidence != null ? `${Math.round(row.confidence * 100)}%` : "—"}
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

                  <div className="mt-4">
                    <Button
                      variant="outline"
                      className="min-h-11 w-full rounded-xl"
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

      {phase === "done" && result && (
        <LeadCaptureSection landingSessionId={result.landing_session_id} />
      )}
    </>
  );
}
