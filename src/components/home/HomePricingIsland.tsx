import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CurrencySelect, CycleToggle, PricingGrid } from "@/components/pricing/PricingPlans";
import { useDisplayCurrency } from "@/lib/display-currency";
import type { BillingCycle, Plan } from "@/lib/pricing";

export function HomePricingIsland() {
  const [cycle, setCycle] = useState<BillingCycle>("annual");
  const { currency, setCurrency, isBase, format } = useDisplayCurrency();
  const navigate = useNavigate();

  const onSelectPlan = (plan: Plan) => {
    if (plan.contactSales) void navigate({ to: "/contact", search: { subject: "Sales enquiry" } });
    else void navigate({ to: "/signup" });
  };

  return (
    <section
      id="pricing"
      className="scroll-mt-20 border-t border-border bg-surface py-20 lg:py-28"
      aria-labelledby="pricing-title"
    >
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl text-left">
            <p className="text-sm font-semibold text-[#2A6FA8]">Pricing</p>
            <h2
              id="pricing-title"
              className="mt-3 text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-4xl"
            >
              Plans that scale from one local store to a national chain.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Start free. Paid plans from {format(499)}/month. Unlimited teammates and store records
              on every paid plan.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
            <CycleToggle cycle={cycle} onChange={setCycle} />
            <CurrencySelect currency={currency} onChange={setCurrency} />
          </div>
        </div>
        {!isBase && (
          <p className="mt-3 text-xs text-muted-foreground">
            Converted from INR at indicative rates; billed in INR.
          </p>
        )}
        <div className="mt-12 text-left">
          <PricingGrid cycle={cycle} onSelect={onSelectPlan} currency={currency} />
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild variant="subtle" className="rounded-xl">
            <Link to="/pricing">
              Compare every feature <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="ghost" className="rounded-xl">
            <Link to="/contact" search={{ subject: "Sales enquiry" }}>
              Talk to Sales
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
