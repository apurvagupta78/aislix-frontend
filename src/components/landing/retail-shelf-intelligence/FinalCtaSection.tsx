import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackLandingEvent } from "@/lib/landing-analytics";
import { scrollToSection } from "@/lib/landing-utm";
import { SignupCta } from "./shared";

const TRUST = ["Instant results", "No setup required", "Start in minutes"];

export function FinalCtaSection() {
  return (
    <section className="bg-landing-navy py-16 sm:py-20">
      <div className="mx-auto max-w-4xl px-5 text-center sm:px-8">
        <h2 className="text-2xl font-semibold tracking-tight text-brand-foreground sm:text-3xl">
          Ready to See What Your Shelves Are Telling You?
        </h2>
        <p className="mt-3 text-sm text-brand-foreground/70">
          Start with 3 free shelf scans. No credit card required.
        </p>

        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <SignupCta location="final_cta" event="final_cta_click" size="xl" className="w-full sm:w-auto">
            Start free shelf scan →
          </SignupCta>
          <Button
            variant="outline"
            size="xl"
            className="w-full border-brand-foreground/25 bg-transparent text-brand-foreground hover:bg-brand-foreground/10 hover:text-brand-foreground sm:w-auto"
            onClick={() => {
              trackLandingEvent("demo_click", { location: "final_cta" });
              scrollToSection("demo");
            }}
          >
            View live demo
          </Button>
        </div>

        <ul className="mt-7 flex flex-wrap justify-center gap-x-6 gap-y-2">
          {TRUST.map((t) => (
            <li key={t} className="flex items-center gap-2 text-sm text-brand-foreground/70">
              <CheckCircle2 className="size-4 text-brand" /> {t}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
