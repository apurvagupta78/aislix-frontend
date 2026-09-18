import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CurrencySelect, CycleToggle, PricingGrid } from "@/components/pricing/PricingPlans";
import { useDisplayCurrency } from "@/lib/display-currency";
import type { BillingCycle, Plan } from "@/lib/pricing";

export function HomePricingIsland() {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const { currency, setCurrency, isBase, format } = useDisplayCurrency();
  const navigate = useNavigate();

  const onSelectPlan = (plan: Plan) => {
    if (plan.contactSales) void navigate({ to: "/contact", search: { subject: "Sales enquiry" } });
    else void navigate({ to: "/signup" });
  };

  return (
    <section id="pricing" className="home-section bg-background">
      <div className="mx-auto max-w-[90rem] px-6 text-center sm:px-8">
        <p className="text-xs font-medium uppercase tracking-widest text-brand">Pricing</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Plans that scale from one local store to a national chain.
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Start free. Paid plans from {format(499)}/month. Unlimited teammates and store records on
          every paid plan.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <CycleToggle cycle={cycle} onChange={setCycle} />
          <CurrencySelect currency={currency} onChange={setCurrency} />
        </div>
        {!isBase && (
          <p className="mt-3 text-xs text-muted-foreground">
            Converted from INR at indicative rates; billed in INR.
          </p>
        )}
        <div className="mt-10 text-left">
          <PricingGrid cycle={cycle} onSelect={onSelectPlan} currency={currency} />
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
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
