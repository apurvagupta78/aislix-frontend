import { useEffect, useRef, useState } from "react";
import { ArrowRight, ImagePlus, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trackLandingEvent } from "@/lib/landing-analytics";
import {
  LandingScanError,
  captureLandingLead,
  loadLandingSessionId,
  persistLandingSession,
  runLandingSample,
  runLandingScan,
  signupUrlWithLanding,
  type LandingScanResult,
} from "@/lib/landing-scan-api";
import { onFocusUpload } from "./demoBus";

type DemoState = "idle" | "scanning" | "results" | "error";
type Mode = "sample" | "upload";

const MAX_BYTES = 10 * 1024 * 1024;

export function ProductDemoSection() {
  const [state, setState] = useState<DemoState>("idle");
  const [result, setResult] = useState<LandingScanResult | null>(null);
  const [error, setError] = useState<{ message: string; limit: boolean } | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => onFocusUpload(() => fileRef.current?.focus()), []);
  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

  const run = async (mode: Mode, file?: File) => {
    setState("scanning");
    setError(null);
    trackLandingEvent("demo_scan_started", { mode });
    try {
      const sid = loadLandingSessionId() ?? undefined;
      const res =
        mode === "upload" && file
          ? await runLandingScan(file, sid)
          : await runLandingSample("lays-a1l", sid);
      persistLandingSession(res);
      setResult(res);
      setState("results");
      trackLandingEvent("demo_scan_completed", {
        scan_id: res.scan_id,
        landing_session_id: res.landing_session_id,
        products: res.metrics?.total_products ?? 0,
      });
    } catch (e) {
      const status = e instanceof LandingScanError ? e.status : 0;
      const message =
        status === 429
          ? "You've used all free anonymous scans for today."
          : e instanceof Error
            ? e.message
            : "Scan failed. Please try again.";
      setError({ message, limit: status === 429 });
      setState("error");
      trackLandingEvent("demo_scan_failed", { error: message });
    }
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(jpeg|jpg|png)$/i.test(file.type)) {
      setError({ message: "Please upload a JPEG or PNG shelf photo.", limit: false });
      setState("error");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError({ message: "Image is larger than 10MB. Please upload a smaller photo.", limit: false });
      setState("error");
      return;
    }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setPreviewSrc(url);
    setResult(null);
    void run("upload", file);
  };

  const annotated =
    result?.annotated_image_base64 && result.annotated_image_mime
      ? `data:${result.annotated_image_mime};base64,${result.annotated_image_base64}`
      : null;

  return (
    <section id="demo" className="border-t border-border py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <p className="text-xs font-medium uppercase tracking-widest text-brand">Live demo</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-4xl">See What Aislix Sees</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Upload a shelf photo and see how AI turns it into structured retail intelligence.
        </p>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Button
            variant="hero"
            size="lg"
            className="min-h-11"
            disabled={state === "scanning"}
            onClick={() => {
              setPreviewSrc(null);
              setResult(null);
              void run("sample");
            }}
          >
            <Sparkles className="size-4" /> Try Sample Shelf
          </Button>
          <Button
            variant="subtle"
            size="lg"
            className="min-h-11 rounded-xl"
            disabled={state === "scanning"}
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus className="size-4" /> Upload Shelf Photo
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png"
            className="sr-only"
            aria-label="Upload shelf photo"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          JPEG or PNG, up to 10MB. No login required — 3 free shelf scans.
        </p>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <div className="card-surface overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-medium">Shelf image</span>
              {state === "results" && (
                <Badge variant="secondary" className="rounded-lg">AI annotated</Badge>
              )}
            </div>
            <div className="relative min-h-64">
              {annotated || previewSrc ? (
                <img
                  src={annotated ?? previewSrc ?? ""}
                  alt="Shelf photo analyzed by Aislix AI"
                  className="block h-auto w-full"
                  decoding="async"
                />
              ) : (
                <div className="flex min-h-64 items-center justify-center px-6 text-center text-sm text-muted-foreground">
                  Your shelf photo and AI annotations appear here.
                </div>
              )}
            </div>
          </div>

          <div className="card-surface p-5">
            {state === "idle" && (
              <div className="flex h-full min-h-64 flex-col items-center justify-center text-center">
                <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
                  <Sparkles className="size-5" />
                </span>
                <p className="mt-4 text-sm font-medium">Run a live shelf analysis</p>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  Upload your own shelf photo, or try the reference shelf, to see the structured
                  output Aislix returns.
                </p>
              </div>
            )}

            {state === "scanning" && (
              <div className="flex h-full min-h-64 flex-col items-center justify-center text-center">
                <Loader2 className="size-6 animate-spin text-brand" />
                <p className="mt-4 text-sm font-medium">Analyzing shelf… 30–90s</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Detecting facings, brands and shelf execution issues.
                </p>
              </div>
            )}

            {state === "error" && error && (
              <div className="flex h-full min-h-64 flex-col items-center justify-center text-center">
                <span className="grid size-11 place-items-center rounded-xl bg-muted text-foreground">
                  <TriangleAlert className="size-5" />
                </span>
                <p className="mt-4 text-sm font-medium">{error.message}</p>
                {error.limit ? (
                  <Button asChild variant="brand" className="mt-4 min-h-11 rounded-xl">
                    <a
                      href={signupUrlWithLanding()}
                      onClick={() => trackLandingEvent("cta_click", { location: "demo" })}
                    >
                      Sign up for unlimited scans <ArrowRight className="size-4" />
                    </a>
                  </Button>
                ) : (
                  <Button
                    variant="subtle"
                    className="mt-4 min-h-11 rounded-xl"
                    onClick={() => setState("idle")}
                  >
                    Try again
                  </Button>
                )}
              </div>
            )}

            {state === "results" && result && (
              <div>
                <div className="grid grid-cols-3 gap-3">
                  <Metric label="Products detected" value={fmt(result.metrics?.total_products)} />
                  <Metric label="Unique SKUs" value={fmt(result.metrics?.unique_skus)} />
                  <Metric label="Shelf health" value={fmt(result.metrics?.shelf_health_score)} />
                </div>

                {result.executive_summary && (
                  <p className="mt-4 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-muted-foreground">
                    {result.executive_summary}
                  </p>
                )}

                <div className="mt-5 max-h-80 overflow-auto">
                  <table className="w-full min-w-[420px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pr-3 font-medium">Brand</th>
                        <th className="py-2 pr-3 font-medium">Product</th>
                        <th className="py-2 pr-3 font-medium">Qty</th>
                        <th className="py-2 pr-3 font-medium">Conf.</th>
                        <th className="py-2 font-medium">Compliance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.inventory?.map((it, i) => {
                        const excluded = it.counted_in_totals === false;
                        const needsReview = it.compliance_status === "needs_review";
                        return (
                          <tr
                            key={`${it.brand}-${it.product_name}-${i}`}
                            className={`border-b border-border/60 last:border-0 ${excluded ? "opacity-55" : ""}`}
                          >
                            <td className="py-2.5 pr-3 text-muted-foreground">{it.brand}</td>
                            <td className="py-2.5 pr-3 font-medium text-foreground">
                              {it.product_name}
                            </td>
                            <td className="py-2.5 pr-3">{it.quantity}</td>
                            <td className="py-2.5 pr-3 text-muted-foreground">
                              {typeof it.confidence === "number"
                                ? `${Math.round(it.confidence * 100)}%`
                                : "—"}
                            </td>
                            <td className="py-2.5">
                              <Badge
                                variant={needsReview || excluded ? "outline" : "secondary"}
                                className="rounded-lg"
                              >
                                {excluded
                                  ? (it.exclusion_reason ?? "Not counted")
                                  : needsReview
                                    ? "Needs review"
                                    : "On planogram"}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {typeof result.scans_daily_limit === "number" && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {result.scans_used_today ?? 0} of {result.scans_daily_limit} free anonymous
                    scans used today.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {state === "results" && result && <LeadGate sessionId={result.landing_session_id} />}
      </div>
    </section>
  );
}

function fmt(v: number | undefined) {
  return typeof v === "number" ? String(Math.round(v)) : "—";
}

function LeadGate({ sessionId }: { sessionId: string }) {
  const [form, setForm] = useState({ email: "", name: "", company: "" });
  const [status, setStatus] = useState<"form" | "saving" | "saved">("form");
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = form.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 255) {
      setErr("Enter a valid work email address.");
      return;
    }
    setErr(null);
    setStatus("saving");
    try {
      await captureLandingLead({
        landing_session_id: sessionId,
        email,
        name: form.name.trim().slice(0, 100) || undefined,
        company: form.company.trim().slice(0, 120) || undefined,
      });
      trackLandingEvent("landing_lead_captured", { landing_session_id: sessionId });
      setStatus("saved");
    } catch {
      setErr("Could not save your details. Please try again.");
      setStatus("form");
    }
  };

  return (
    <div id="lead-gate" className="card-surface mt-6 p-6">
      {status === "saved" ? (
        <div className="text-center">
          <p className="text-base font-semibold">Results saved to your session</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your free account to keep this scan and analyze more shelves.
          </p>
          <Button asChild variant="brand" className="mt-4 min-h-11 rounded-xl">
            <a
              href={signupUrlWithLanding()}
              onClick={() => {
                trackLandingEvent("cta_click", { location: "lead_gate" });
                trackLandingEvent("signup_started", { location: "lead_gate" });
              }}
            >
              Create Free Account <ArrowRight className="size-4" />
            </a>
          </Button>
        </div>
      ) : (
        <>
          <p className="text-base font-semibold">Save your results &amp; analyze more shelves</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your work email to unlock 3 free shelf scans in your workspace.
          </p>
          <form className="mt-4 grid gap-3 sm:grid-cols-3" onSubmit={submit}>
            <div className="space-y-1.5">
              <Label htmlFor="lead-email">Work email</Label>
              <Input
                id="lead-email"
                type="email"
                required
                maxLength={255}
                placeholder="you@company.com"
                className="h-11 rounded-xl"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-name">Name (optional)</Label>
              <Input
                id="lead-name"
                maxLength={100}
                className="h-11 rounded-xl"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-company">Company (optional)</Label>
              <Input
                id="lead-company"
                maxLength={120}
                className="h-11 rounded-xl"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
              />
            </div>
            <div className="sm:col-span-3 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <Button
                type="submit"
                variant="brand"
                className="min-h-11 rounded-xl"
                disabled={status === "saving"}
              >
                {status === "saving" ? "Saving…" : "Continue"}
              </Button>
              <a
                href={signupUrlWithLanding()}
                className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                onClick={() => trackLandingEvent("cta_click", { location: "lead_gate_skip" })}
              >
                Continue without saving
              </a>
            </div>
            {err && <p className="sm:col-span-3 text-sm text-destructive">{err}</p>}
          </form>
        </>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">{value}</p>
    </div>
  );
}
