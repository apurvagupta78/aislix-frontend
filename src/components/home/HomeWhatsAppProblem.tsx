import { ArrowRight, MessageCircle } from "lucide-react";
import { SectionHeading } from "@/components/landing/retail-shelf-intelligence/shared";

const SCATTERED = [
  "Shelf photo.jpg",
  "Can someone check aisle 4?",
  "OSA spreadsheet v3.xlsx",
  "Looks fine to me",
  "Which store was this?",
];

const TRACKED = [
  "Store",
  "Fixture",
  "Shelf",
  "Products",
  "Availability",
  "Facings",
  "Planogram Compliance",
  "Prices",
  "Promotions",
  "Issues",
  "Corrective Actions",
  "Rescan Results",
];

export function HomeWhatsAppProblem() {
  return (
    <section className="border-t border-border bg-background py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="STOP LOSING SHELF AUDITS"
          title="Stop Losing Shelf Audits in WhatsApp or Emails"
          subtitle="A shelf visit shouldn't end when the photo is shared."
        />
        <p className="mx-auto mt-4 max-w-2xl text-center text-sm leading-relaxed text-muted-foreground">
          Today, store visits often end with photos, messages and spreadsheets scattered across
          WhatsApp groups or multiple email threads. Aislix turns every shelf visit into a
          searchable retail record.
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
          <div className="rounded-xl border border-border bg-card p-5 shadow-soft sm:p-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MessageCircle className="size-4" strokeWidth={1.75} aria-hidden="true" />
              <span className="text-xs font-semibold uppercase tracking-wider">Scattered evidence</span>
            </div>
            <ul className="mt-4 space-y-2.5">
              {SCATTERED.map((item) => (
                <li
                  key={item}
                  className="rounded-lg border border-dashed border-border/80 bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="hidden place-items-center lg:grid">
            <ArrowRight className="size-6 text-brand/60" strokeWidth={1.75} aria-hidden="true" />
          </div>

          <div className="rounded-xl border border-brand/20 bg-brand-soft/30 p-5 shadow-soft sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand">
              Structured Aislix record
            </p>
            <p className="mt-3 text-base font-semibold tracking-tight text-foreground">
              Keep the Photo. Keep the Audit. Keep the History.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {TRACKED.map((item) => (
                <span
                  key={item}
                  className="rounded-md border border-border/80 bg-background px-2.5 py-1 text-[11px] font-medium text-foreground"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>

        <p className="mx-auto mt-10 max-w-xl text-center text-sm font-medium text-foreground">
          Instead of asking &ldquo;What did we find last time?&rdquo; — open the store&apos;s history.
        </p>
      </div>
    </section>
  );
}
