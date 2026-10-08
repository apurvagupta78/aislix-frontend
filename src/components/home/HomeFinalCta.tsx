import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HomeFinalCta() {
  return (
    <section className="border-t border-border bg-white px-5 py-16 lg:px-8 lg:py-20" aria-labelledby="cta-title">
      <div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Start with one shelf</p>
          <h2
            id="cta-title"
            className="mt-3 text-3xl font-semibold tracking-[-0.02em] text-foreground sm:text-4xl"
          >
            Turn every shelf visit into measurable action.
          </h2>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
            From one shelf photo to actionable insights, corrective actions and a complete audit
            history — Aislix helps retail teams see more, act faster and track what changes.
          </p>
        </div>
        <div className="lg:justify-self-end">
          <Button asChild variant="brand" size="xl" className="rounded-lg px-6">
            <Link to="/signup">
              Create your free workspace
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <p className="mt-3 text-sm text-muted-foreground">
            No card required · Start with your first shelf audit
          </p>
        </div>
      </div>
    </section>
  );
}
