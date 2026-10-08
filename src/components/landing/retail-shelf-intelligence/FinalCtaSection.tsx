import { CheckCircle2 } from "lucide-react";
import { SignupCta } from "./shared";

const TRUST = ["Instant results", "No setup required", "Start in minutes"];

export function FinalCtaSection() {
  return (
    <section className="border-t border-border bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-4xl px-5 text-center sm:px-8">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Ready to see what your shelves are telling you?
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Start with 5 free shelf audits every 24 hours. No credit card required.
        </p>

        <div className="mt-7 flex justify-center">
          <SignupCta
            location="final_cta"
            event="final_cta_click"
            size="xl"
            variant="brand"
            className="w-full sm:w-auto"
          >
            Create your workspace →
          </SignupCta>
        </div>

        <ul className="mt-7 flex flex-wrap justify-center gap-x-6 gap-y-2">
          {TRUST.map((t) => (
            <li key={t} className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-[#04203F]" /> {t}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
