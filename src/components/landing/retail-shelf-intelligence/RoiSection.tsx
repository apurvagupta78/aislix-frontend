import { Eye, FileClock, Timer, Zap } from "lucide-react";
import { SectionHeading } from "./shared";

const OUTCOMES = [
  { Icon: Timer, title: "Less manual auditing", body: "Replace clipboard audits with a photo." },
  { Icon: FileClock, title: "Faster store reporting", body: "Structured shelf data, not spreadsheets." },
  { Icon: Eye, title: "Better shelf visibility", body: "See availability and placement clearly." },
  { Icon: Zap, title: "Faster corrective action", body: "Fix shelf issues while they still matter." },
];

export function RoiSection() {
  return (
    <section className="bg-background py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading eyebrow="Business value" title="Turn Every Shelf Photo Into a Business Decision." />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {OUTCOMES.map(({ Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-landing-border bg-card p-6 shadow-soft">
              <span className="grid size-9 place-items-center rounded-lg bg-landing-cyan-soft">
                <Icon className="size-4 text-landing-cyan" strokeWidth={1.8} />
              </span>
              <h3 className="mt-4 text-sm font-semibold text-foreground">{title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
