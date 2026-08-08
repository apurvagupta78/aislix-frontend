import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, Compass, Target, Users } from "lucide-react";
import { MarketingPage } from "@/components/MarketingLayout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Aislix — The team behind AI shelf intelligence" },
      {
        name: "description",
        content:
          "Aislix Technologies builds computer-vision shelf auditing for supermarkets, dark stores, warehouses, FMCG brands, distributors and local stores. Learn what we build and why.",
      },
      { property: "og:title", content: "About Aislix Technologies" },
      {
        property: "og:description",
        content: "Why we built AI shelf auditing for modern and traditional retail.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: About,
});

const values = [
  {
    icon: Target,
    title: "Accuracy over theatre",
    body: "Every detection ships with a confidence score. We would rather show uncertainty than present a confident-looking number a store manager cannot trust.",
  },
  {
    icon: Compass,
    title: "Built for Indian retail first",
    body: "Dense shelves, mixed packaging, regional brands and phone cameras — our models are tuned for how stores actually look, not for tidy planogram renders.",
  },
  {
    icon: Users,
    title: "Useful to the person on the floor",
    body: "An audit is only valuable if it tells someone what to refill next. Alerts, severity and recommendations are as important to us as raw detection.",
  },
  {
    icon: Building2,
    title: "Enterprise-ready from day one",
    body: "Role-based access, workspace isolation, GST invoicing and an API — so a single store and a national chain can both run on the same platform.",
  },
];

function About() {
  return (
    <MarketingPage>
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16">
          <p className="text-xs font-medium uppercase tracking-widest text-brand">Company</p>
          <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Shelf audits should take seconds, not afternoons
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Retail teams still walk aisles with clipboards and spreadsheets, then wait days for a
            summary that is out of date on arrival. Aislix Technologies replaces that loop with a
            photo: upload a shelf, get a complete SKU inventory, share of shelf, out-of-stock alerts
            and an audit-ready report in seconds.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild variant="brand" className="rounded-xl">
              <Link to="/contact" search={{ subject: "Book a demo" }}>Book a demo</Link>
            </Button>
            <Button asChild variant="subtle" className="rounded-xl">
              <Link to="/pricing">See pricing</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">What we care about</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {values.map((v) => (
            <div key={v.title} className="card-surface card-hover p-6">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
                <v.icon className="size-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold tracking-tight">{v.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-8">
        <div className="card-surface flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Work with us</h2>
            <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
              We are a small, focused team. Open roles will be listed here — until then, introduce
              yourself and tell us what you would build.
            </p>
          </div>
          <Button asChild variant="subtle" className="rounded-xl">
            <Link to="/contact" search={{ subject: "Other" }}>Get in touch</Link>
          </Button>
        </div>
      </section>
    </MarketingPage>
  );
}
