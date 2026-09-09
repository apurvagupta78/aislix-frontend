import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { icpSegments, type PlanId } from "@/lib/pricing";

const planLabels: Record<PlanId, string> = {
  free: "Free",
  starter: "Starter",
  growth: "Growth",
  professional: "Professional",
  enterprise: "Enterprise",
};

export function IcpSegmentsSection() {
  const primary = icpSegments.filter((s) => s.priority === "primary");
  const secondary = icpSegments.filter((s) => s.priority === "secondary");

  return (
    <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
      <div className="text-center">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Who Aislix is for</h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
          Shelf audits from a phone photo — structured SKU counts, brand share, planogram gaps.
        </p>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {[primary, secondary].map((group, groupIndex) => (
          <div key={groupIndex} className="space-y-4">
            {group.map((segment) => (
              <div
                key={segment.title}
                className={cn(
                  "card-surface card-hover p-5",
                  segment.priority === "primary" && "border-brand/20",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold">{segment.title}</h3>
                  {segment.priority === "primary" && (
                    <Badge className="rounded-full bg-brand-soft text-brand hover:bg-brand-soft">
                      Best fit
                    </Badge>
                  )}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {segment.description}
                </p>
                <Button asChild variant="ghost" size="sm" className="mt-3 h-8 rounded-lg px-2 text-xs">
                  <a href={`/pricing#plan-${segment.recommendedPlan}`}>
                    See {planLabels[segment.recommendedPlan]} plan
                    <ArrowRight className="size-3.5" />
                  </a>
                </Button>
              </div>
            ))}
          </div>
        ))}
      </div>

      <p className="mx-auto mt-6 max-w-2xl text-center text-xs text-muted-foreground">
        Warehouse pallet or barcode systems are out of scope — Aislix is for customer-facing retail
        shelves.
      </p>
    </section>
  );
}
