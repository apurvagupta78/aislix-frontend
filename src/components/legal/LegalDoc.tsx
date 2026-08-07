import { MarketingPage } from "@/components/MarketingLayout";

export type LegalSection = { heading: string; body: string[]; bullets?: string[] };

export function LegalDoc({
  title,
  intro,
  updated,
  sections,
}: {
  title: string;
  intro: string;
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <MarketingPage>
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-16">
          <p className="text-xs font-medium uppercase tracking-widest text-brand">Legal</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{intro}</p>
          <p className="mt-4 text-xs text-muted-foreground">Last updated {updated}</p>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[220px_1fr]">
        <nav aria-label="On this page" className="hidden lg:block">
          <div className="sticky top-24 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              On this page
            </p>
            <ul className="space-y-1.5">
              {sections.map((s) => (
                <li key={s.heading}>
                  <a
                    href={`#${slug(s.heading)}`}
                    className="text-sm text-muted-foreground transition-colors hover:text-brand"
                  >
                    {s.heading}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <article className="max-w-3xl space-y-10">
          {sections.map((s) => (
            <section key={s.heading} id={slug(s.heading)} className="scroll-mt-24">
              <h2 className="text-lg font-semibold tracking-tight sm:text-xl">{s.heading}</h2>
              {s.body.map((p) => (
                <p key={p} className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {p}
                </p>
              ))}
              {s.bullets && (
                <ul className="mt-3 space-y-2">
                  {s.bullets.map((b) => (
                    <li
                      key={b}
                      className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground"
                    >
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent-green" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </article>
      </div>
    </MarketingPage>
  );
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
