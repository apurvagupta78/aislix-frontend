import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackLandingEvent } from "@/lib/landing-analytics";
import { useSignupHref } from "./useSignupHref";

export function FinalCtaSection() {
  const signupHref = useSignupHref();
  return (
    <section id="cta" className="border-t border-border bg-hero-glow py-20">
      <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-4xl">
          Ready to See What Your Shelves Are Telling You?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Start with 3 free shelf scans. No credit card required.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild variant="hero" size="xl" className="min-h-11 w-full sm:w-auto">
            <a
              href={signupHref}
              onClick={() => {
                trackLandingEvent("cta_click", { location: "footer" });
                trackLandingEvent("signup_started", { location: "footer" });
              }}
            >
              Start Free Shelf Scan <ArrowRight className="size-4" />
            </a>
          </Button>
          <Button asChild variant="outline" size="xl" className="min-h-11 w-full rounded-xl sm:w-auto">
            <a
              href="/contact?subject=Book%20a%20demo"
              onClick={() => trackLandingEvent("cta_click", { location: "footer_demo" })}
            >
              Book a Demo
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
