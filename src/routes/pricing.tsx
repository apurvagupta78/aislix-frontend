import { useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/MarketingLayout";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ComparisonTable,
  CurrencySelect,
  CycleToggle,
  EnterpriseSection,
  PricingBottomActions,
  PricingGrid,
} from "@/components/pricing/PricingPlans";
import { ANNUAL_DISCOUNT_PERCENT } from "@/lib/plan-entitlements";
import { useDisplayCurrency } from "@/lib/display-currency";
import type { BillingCycle, PlanDefinition } from "@/lib/plan-entitlements";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { property: "og:url", content: "https://aislix.com/pricing" },
      { title: "Pricing — Aislix AI Shelf Intelligence" },
      {
        name: "description",
        content:
          "Simple pricing for AI shelf audits. Start free, pay as you go, or choose a monthly plan as your retail operation grows.",
      },
    ],
    links: [{ rel: "canonical", href: "https://aislix.com/pricing" }],
  }),
  component: Pricing,
});

const faqs = [
  {
    q: "How is an AI audit counted?",
    a: "One shelf image analysed end-to-end counts as one AI audit. Only successfully completed AI audits consume your allowance or create a Pay as You Go charge. Failed, cancelled or incomplete processing does not count.",
  },
  {
    q: "Can I try Aislix before paying?",
    a: "Yes. The Free plan includes 5 completed AI audits in a rolling 24-hour window — no credit card required.",
  },
  {
    q: "What happens when I hit my monthly limit?",
    a: "Auditing pauses until your next billing period or until you upgrade. You can change plans anytime from billing settings.",
  },
  {
    q: "Can I pay only when I use Aislix?",
    a: "Yes. Pay as You Go charges ₹29 per completed AI audit with no monthly subscription.",
  },
];

function Pricing() {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const { currency, setCurrency, isBase } = useDisplayCurrency();
  const navigate = Route.useNavigate();
  const compareRef = useRef<HTMLElement>(null);

  const onSelect = (plan: PlanDefinition) => {
    if (plan.contactSales) void navigate({ to: "/contact", search: { subject: "Sales enquiry" } });
    else void navigate({ to: "/signup" });
  };

  const goToSales = () => {
    void navigate({ to: "/contact", search: { subject: "Sales enquiry" } });
  };

  const scrollToCompare = () => {
    compareRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-[#f6f8fb]">
      <SiteHeader />
      <main>
        <section className="mx-auto max-w-[90rem] px-6 pb-8 pt-24 text-center sm:px-8 lg:pt-28">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">Pricing</p>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Simple pricing. Pay for the shelf audits you need.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            Start free, pay as you go, or choose a monthly plan as your retail operation grows.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <CycleToggle cycle={cycle} onChange={setCycle} />
            <CurrencySelect currency={currency} onChange={setCurrency} />
          </div>
          {cycle === "annual" ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Annual billing saves {ANNUAL_DISCOUNT_PERCENT}% versus paying monthly.
              {isBase ? "" : " Converted from INR at indicative rates; billed in INR."}
            </p>
          ) : null}
        </section>

        <section className="mx-auto max-w-[90rem] px-6 pb-10 sm:px-8">
          <PricingGrid cycle={cycle} onSelect={onSelect} currency={currency} />
        </section>

        <section className="mx-auto max-w-[90rem] px-6 pb-8 sm:px-8">
          <EnterpriseSection onSelect={onSelect} />
        </section>

        <section className="mx-auto max-w-[90rem] px-6 pb-8 sm:px-8">
          <PricingBottomActions onCompare={scrollToCompare} onSales={goToSales} />
        </section>

        <section className="mx-auto max-w-3xl px-6 py-6 text-center sm:px-8">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>No credit card required for Free.</p>
            <p>For Pay as You Go, you only pay for completed AI audits.</p>
            <p className="inline-flex items-center justify-center gap-1.5">
              <ShieldCheck className="size-4 text-brand" aria-hidden />
              Upgrade or change plans as your retail operation grows.
            </p>
          </div>
        </section>

        <section ref={compareRef} className="mx-auto max-w-[90rem] scroll-mt-24 px-6 py-12 sm:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">Compare plans</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Audit volume, team scale, intelligence features and reports at a glance.
          </p>
          <div className="mt-6">
            <ComparisonTable />
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-6 pb-16 sm:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">Pricing FAQ</h2>
          <Accordion type="single" collapsible className="mt-5">
            {faqs.map((f) => (
              <AccordionItem key={f.q} value={f.q}>
                <AccordionTrigger className="text-left text-sm font-medium">{f.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <section className="border-t border-border/60 bg-white">
          <div className="mx-auto flex max-w-[90rem] flex-col items-start gap-5 px-6 py-14 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Ready to audit your first shelf?</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Start free — or pay only when you run a completed AI audit.
              </p>
            </div>
            <Button asChild variant="brand" className="rounded-xl">
              <Link to="/signup">
                Start Free <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
