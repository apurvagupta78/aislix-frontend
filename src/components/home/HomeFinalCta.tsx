import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HomeFinalCta() {
  return (
    <section className="bg-card px-5 py-20 lg:px-8 lg:py-24" aria-labelledby="cta-title">
      <div className="mx-auto grid max-w-7xl items-center gap-10 rounded-3xl bg-[var(--aislix-primary)] px-8 py-14 text-white lg:grid-cols-[1.4fr_1fr] lg:px-16">
        <div>
          <p className="text-sm font-semibold text-[var(--aislix-warehouse-border)]">
            Start with one shelf
          </p>
          <h2
            id="cta-title"
            className="mt-3 text-3xl font-bold tracking-[-0.02em] sm:text-4xl"
          >
            Turn every shelf visit into measurable action.
          </h2>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-white/75">
            From one shelf photo to actionable insights, corrective actions and a complete audit
            history — Aislix helps retail teams see more, act faster and track what changes.
          </p>
        </div>
        <div className="lg:justify-self-end">
          <Button
            asChild
            variant="secondary"
            size="xl"
            className="rounded-xl bg-white px-6 text-[var(--aislix-primary)] hover:bg-[var(--aislix-local-bg)]"
          >
            <Link to="/signup">
              Create your free workspace
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <p className="mt-3 text-sm text-white/65">
            No card required · Start with your first shelf audit
          </p>
        </div>
      </div>
    </section>
  );
}
