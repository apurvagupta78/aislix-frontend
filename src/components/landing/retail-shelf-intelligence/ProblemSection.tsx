import { ClipboardList, Clock, Table2 } from "lucide-react";
import { SectionHeading } from "./shared";

const CARDS = [
  {
    Icon: ClipboardList,
    title: "Manual shelf audits",
    body: "Teams spend hours visiting stores, taking photos and compiling reports.",
  },
  {
    Icon: Table2,
    title: "Spreadsheet reporting",
    body: "Shelf issues get buried across spreadsheets, chat messages and manual reports.",
  },
  {
    Icon: Clock,
    title: "Delayed action",
    body: "By the time problems are identified, the opportunity may already be lost.",
  },
];

export function ProblemSection() {
  return (
    <section className="bg-surface py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading title="Retail shelves change every day. Your reporting shouldn't take days." />

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {CARDS.map(({ Icon, title, body }) => (
            <div
              key={title}
              className="rounded-xl border border-border bg-card p-6 shadow-soft"
            >
              <Icon className="size-5 text-primary" strokeWidth={1.7} />
              <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>

        <h3 className="mx-auto mt-12 max-w-3xl text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Aislix turns shelf photos into structured intelligence — in minutes.
        </h3>
      </div>
    </section>
  );
}
