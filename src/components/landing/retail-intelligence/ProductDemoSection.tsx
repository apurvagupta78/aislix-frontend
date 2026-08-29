import { useEffect, useRef, useState } from "react";
import { ArrowRight, ImagePlus, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LANDING_DEMO_SAMPLE } from "@/data/landingDemoSample";
import { trackLandingEvent } from "@/lib/landing-analytics";
import { useSignupHref } from "./useSignupHref";

type DemoState = "idle" | "loading" | "results";

const SAMPLE_IMAGE = "/landing/samples/lays-rack.webp";

export function ProductDemoSection() {
  const [state, setState] = useState<DemoState>("idle");
  const signupHref = useSignupHref();
  const [imageSrc, setImageSrc] = useState<string>(SAMPLE_IMAGE);
  const [usedUpload, setUsedUpload] = useState(false);
  const startedRef = useRef(false);
  const objectUrlRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

  const start = (source: "sample" | "upload") => {
    if (!startedRef.current) {
      startedRef.current = true;
      trackLandingEvent("demo_started", { source });
    }
    setState("loading");
    window.setTimeout(() => {
      setState("results");
      trackLandingEvent("demo_completed", { source });
    }, 600);
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setImageSrc(url);
    setUsedUpload(true);
    start("upload");
  };

  const sample = LANDING_DEMO_SAMPLE;

  return (
    <section id="demo" className="border-t border-border py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <p className="text-xs font-medium uppercase tracking-widest text-brand">Interactive demo</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-4xl">See What Aislix Sees</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Upload a shelf photo and see how AI turns it into structured retail intelligence.
        </p>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Button variant="hero" size="lg" className="min-h-11" onClick={() => {
            if (objectUrlRef.current) {
              URL.revokeObjectURL(objectUrlRef.current);
              objectUrlRef.current = null;
            }
            setImageSrc(SAMPLE_IMAGE);
            setUsedUpload(false);
            start("sample");
          }}>
            <Sparkles className="size-4" /> Try Sample Shelf
          </Button>
          <Button
            variant="subtle"
            size="lg"
            className="min-h-11 rounded-xl"
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus className="size-4" /> Upload Shelf Photo
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <div className="card-surface overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-medium">Shelf image</span>
              <Badge variant="secondary" className="rounded-lg">Sample analysis</Badge>
            </div>
            <div className="relative">
              <img
                src={imageSrc}
                alt="Retail shelf photo used for the Aislix sample analysis"
                className="block h-auto w-full"
                loading="lazy"
                decoding="async"
                width={1280}
                height={960}
              />
              {state === "results" && (
                <div className="pointer-events-none absolute inset-0">
                  {sample.boxes.map((b, i) => (
                    <span
                      key={i}
                      className="absolute rounded-md border-2 border-brand/80 bg-brand/10"
                      style={{
                        top: `${b.top}%`,
                        left: `${b.left}%`,
                        width: `${b.width}%`,
                        height: `${b.height}%`,
                      }}
                    >
                      <span className="absolute -top-2 left-0 max-w-full truncate rounded bg-brand px-1.5 py-0.5 text-[10px] font-medium text-brand-foreground">
                        {b.label}
                      </span>
                    </span>
                  ))}
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
                <p className="mt-4 text-sm font-medium">Run the sample analysis</p>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  Pick “Try Sample Shelf” to see the structured output Aislix returns for a shelf
                  photo.
                </p>
              </div>
            )}

            {state === "loading" && (
              <div className="flex h-full min-h-64 flex-col items-center justify-center text-center">
                <Loader2 className="size-6 animate-spin text-brand" />
                <p className="mt-4 text-sm text-muted-foreground">Preparing sample analysis…</p>
              </div>
            )}

            {state === "results" && (
              <div>
                {usedUpload && (
                  <p className="mb-4 rounded-xl border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
                    Sample analysis preview — sign up to analyze your own shelves.
                  </p>
                )}
                <div className="grid grid-cols-3 gap-3">
                  <Metric label="Products detected" value={String(sample.productsDetected)} />
                  <Metric label="Unique SKUs" value={String(sample.uniqueSkus)} />
                  <Metric label="Shelf health" value={`${sample.shelfHealth}`} />
                </div>

                <div className="mt-5 overflow-x-auto">
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
                      {sample.items.map((it) => (
                        <tr key={it.product} className="border-b border-border/60 last:border-0">
                          <td className="py-2.5 pr-3 text-muted-foreground">{it.brand}</td>
                          <td className="py-2.5 pr-3 font-medium text-foreground">{it.product}</td>
                          <td className="py-2.5 pr-3">{it.qty}</td>
                          <td className="py-2.5 pr-3 text-muted-foreground">
                            {Math.round(it.confidence * 100)}%
                          </td>
                          <td className="py-2.5">
                            <Badge
                              variant={it.compliance === "ok" ? "secondary" : "outline"}
                              className="rounded-lg"
                            >
                              {it.compliance === "ok" ? "On planogram" : "Needs review"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 rounded-2xl border border-border bg-surface p-4">
                  <p className="text-sm font-medium">Want to analyze your own shelves?</p>
                  <Button asChild variant="brand" className="mt-3 min-h-11 rounded-xl">
                    <a
                      href={signupHref}
                      onClick={() => {
                        trackLandingEvent("cta_click", { location: "demo" });
                        trackLandingEvent("signup_started", { location: "demo" });
                      }}
                    >
                      Start Free Shelf Scan <ArrowRight className="size-4" />
                    </a>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">{value}</p>
    </div>
  );
}
