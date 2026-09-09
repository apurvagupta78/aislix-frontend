import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, HelpCircle, Mail, ShieldCheck, Zap } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/MarketingLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  PricingGrid,
} from "@/components/pricing/PricingPlans";
import { IcpSegmentsSection } from "@/components/pricing/IcpSegmentsSection";
import { addOns, formatPrice, pricingFaqs, primaryIcpStrip } from "@/lib/pricing";
import { useDisplayCurrency } from "@/lib/display-currency";
import type { BillingCycle, Plan } from "@/lib/pricing";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { property: "og:url", content: "https://aislix.com/pricing" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Pricing — Aislix AI Shelf Intelligence" },
      {
        name: "description",
        content:
          "Simple scan-based pricing for AI shelf audits. Start free, scale to unlimited scans on Professional, or talk to us about Enterprise.",
      },
      { property: "og:title", content: "Aislix pricing — pay by shelf scans" },
      {
        property: "og:description",
        content: "Free, Starter ₹999, Professional ₹4,999 or Enterprise. Compare every feature.",
      },
      
      
    ],
    links: [{ rel: "canonical", href: "https://aislix.com/pricing" }],
  }),
  component: Pricing,
});

function Pricing() {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const { currency, setCurrency, isBase } = useDisplayCurrency();

  const navigate = Route.useNavigate();

  const onSelect = (plan: Plan) => {
    // Checkout (Cashfree) is intentionally not wired yet: route to sales or sign-up.
    if (plan.contactSales) void navigate({ to: "/contact", search: { subject: "Sales enquiry" } });
    else void navigate({ to: "/signup" });
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main>
        <section className="mx-auto max-w-7xl px-5 pb-4 pt-14 text-center sm:px-8 sm:pt-20">
          <Badge className="rounded-full bg-brand-soft text-brand hover:bg-brand-soft">
            Scan-based pricing
          </Badge>
          <h1 className="mx-auto mt-5 max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">
            Simple pricing for shelf audit teams
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {primaryIcpStrip}
          </p>
          <p className="mx-auto mt-2 text-sm text-muted-foreground">
            Start free · Upgrade when your team runs recurring store audits
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <CycleToggle cycle={cycle} onChange={setCycle} />
            <CurrencySelect currency={currency} onChange={setCurrency} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Annual billing is charged for 10 months — two months free.
            {isBase ? "" : " Converted from INR at indicative rates; billed in INR."}
          </p>
        </section>

        <IcpSegmentsSection />

        <section className="mx-auto max-w-[90rem] px-5 pb-6 pt-4 sm:px-8">
          <PricingGrid cycle={cycle} onSelect={onSelect} currency={currency} />
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-accent-green" />{" "}
              {isBase ? "GST invoices for Indian businesses" : "Tax invoices for every payment"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Zap className="size-3.5 text-accent-green" /> No setup fee, cancel anytime
            </span>
            <span className="inline-flex items-center gap-1.5">
              <HelpCircle className="size-3.5 text-accent-green" />{" "}
              {isBase ? "Prices exclusive of 18% GST" : "Taxes calculated at checkout"}
            </span>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Compare every feature</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            A full breakdown of scanning limits, analytics depth and support across plans.
          </p>
          <div className="mt-6">
            <ComparisonTable />
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-12 sm:px-8">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Add-ons</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Extend any paid plan without changing tiers.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {addOns.map((a) => (
              <div key={a.id} className="card-surface card-hover p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold">{a.name}</h3>
                  {!a.available && (
                    <Badge variant="secondary" className="rounded-full text-[0.65rem]">
                      Coming soon
                    </Badge>
                  )}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{a.description}</p>
                <p className="mt-4 text-sm font-medium">
                  {a.priceInr === null ? "Custom" : formatPrice(a.priceInr, currency)}{" "}
                  <span className="text-xs text-muted-foreground">{a.unit}</span>
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-5 pb-16 sm:px-8">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Pricing FAQ</h2>
          <Accordion type="single" collapsible className="mt-5">
            {pricingFaqs.map((f) => (
              <AccordionItem key={f.q} value={f.q}>
                <AccordionTrigger className="text-left text-sm font-medium">{f.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <section className="border-t border-border bg-surface">
          <div className="mx-auto flex max-w-7xl flex-col items-start gap-5 px-5 py-14 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div>
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                Need a multi-location rollout?
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Custom AI models, on-premise deployment and SLAs for national retail groups.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="subtle" className="rounded-xl">
                <Link to="/contact" search={{ subject: "Sales enquiry" }}>
                  <Mail className="size-4" /> Contact sales
                </Link>
              </Button>
              <Button asChild variant="brand" className="rounded-xl">
                <Link to="/signup">
                  Start free <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
