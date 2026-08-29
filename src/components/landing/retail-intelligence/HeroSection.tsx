import { ArrowRight, CheckCircle2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackLandingEvent } from "@/lib/landing-analytics";

export const LANDING_SAMPLE_EVENT = "aislix:landing-sample";
export const LANDING_UPLOAD_EVENT = "aislix:landing-upload";

function startDemo(eventName: string, location: string) {
  trackLandingEvent("cta_click", { location });
  document.getElementById("demo")?.scrollIntoView({ behavior: "smooth", block: "start" });
  window.setTimeout(() => window.dispatchEvent(new Event(eventName)), 350);
}

/** Focused LinkedIn ad hero with actions wired to the live demo. */
export function HeroSection() {
  return (
    <section id="hero" className="relative overflow-hidden bg-brand text-brand-foreground">
      <div className="absolute inset-0 grid-lines opacity-10 [mask-image:radial-gradient(75%_80%_at_50%_0%,black,transparent)]" />
      <div className="relative mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20 lg:py-24">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-foreground/20 bg-brand-foreground/5 px-3.5 py-1.5 text-xs text-brand-foreground/80">
            <span className="size-1.5 rounded-full bg-accent-green" />
            AI-Powered Retail Shelf Intelligence
          </span>
          <h1 className="mt-6 text-4xl font-semibold leading-[1.08] tracking-normal sm:text-6xl">
            Audit Every Aisle. <span className="text-accent-green">From a Single Photo.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-brand-foreground/75 sm:text-lg">
            Aislix turns a shelf photo into a complete retail audit—detecting products, brands,
            quantities and availability gaps in about a minute.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              size="xl"
              className="min-h-12 w-full bg-accent-green text-brand-foreground shadow-card hover:bg-accent-green/90 sm:w-auto"
              onClick={() => startDemo(LANDING_SAMPLE_EVENT, "hero_sample")}
            >
              Try Sample Shelf <ArrowRight className="size-4" />
            </Button>
            <Button
              size="xl"
              variant="outline"
              className="min-h-12 w-full border-brand-foreground/30 bg-transparent text-brand-foreground hover:bg-brand-foreground/10 hover:text-brand-foreground sm:w-auto"
              onClick={() => startDemo(LANDING_UPLOAD_EVENT, "hero_upload")}
            >
              <Upload className="size-4" /> Upload Your Shelf Photo
            </Button>
          </div>
          <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-xs text-brand-foreground/75 sm:text-sm">
            {["No card required", "3 free scans", "Results in ~60s"].map((item) => (
              <span key={item} className="inline-flex items-center gap-2">
                <CheckCircle2 className="size-4 text-accent-green" /> {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
