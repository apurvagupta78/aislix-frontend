import { ArrowDown, History } from "lucide-react";
import { SectionHeading } from "@/components/landing/retail-shelf-intelligence/shared";

/** Illustrative visit progression — labelled as demo/example, not real customer data. */
const VISITS = [
  { date: "12 Sep", osa: 91, planogram: 84, issues: 7 },
  { date: "19 Sep", osa: 96, planogram: 93, issues: 3 },
  { date: "26 Sep", osa: 98, planogram: 97, issues: 1 },
];

const PROCESS = ["Audit", "Fix", "Rescan", "Verify", "Track"] as const;

export function HomeAuditHistory() {
  return (
    <section id="audit-history" className="scroll-mt-16 border-t border-border bg-surface py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="AUDIT HISTORY"
          title="Your Shelf. Your History. One Place."
          subtitle="Every audit becomes part of your retail history. Compare visits, see what changed, identify recurring issues and verify whether corrective actions actually worked."
        />

        <div className="mx-auto mt-10 max-w-lg">
          <div className="rounded-xl border border-border bg-card p-5 shadow-lift sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Store 101 · Oral Care</p>
                <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Demo / Example
                </p>
              </div>
              <span className="grid size-9 place-items-center rounded-lg border border-[var(--aislix-warehouse-border)] bg-[var(--aislix-warehouse-bg)] text-[var(--aislix-primary)]">
                <History className="size-4" strokeWidth={1.75} aria-hidden="true" />
              </span>
            </div>

            <div className="mt-6 space-y-4">
              {VISITS.map((visit, index) => (
                <div key={visit.date}>
                  <div className="rounded-lg border border-border/80 bg-background px-4 py-3">
                    <p className="text-xs font-semibold text-foreground">{visit.date}</p>
                    <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
                      <div>
                        <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">OSA</dt>
                        <dd className="text-sm font-semibold tabular-nums text-foreground">
                          {visit.osa}%
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Planogram
                        </dt>
                        <dd className="text-sm font-semibold tabular-nums text-foreground">
                          {visit.planogram}%
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Issues
                        </dt>
                        <dd className="text-sm font-semibold tabular-nums text-foreground">
                          {visit.issues}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  {index < VISITS.length - 1 ? (
                    <div className="flex justify-center py-1">
                      <ArrowDown
                        className="size-4 text-muted-foreground/50"
                        strokeWidth={1.75}
                        aria-hidden="true"
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          className="mt-8 flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-foreground sm:text-xs"
          aria-label="Audit, fix, re-audit, verify, track"
        >
          {PROCESS.map((step, index) => (
            <span key={step} className="inline-flex items-center gap-1.5">
              {index > 0 ? (
                <span className="px-0.5 text-muted-foreground/45" aria-hidden="true">
                  →
                </span>
              ) : null}
              <span>{step}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
