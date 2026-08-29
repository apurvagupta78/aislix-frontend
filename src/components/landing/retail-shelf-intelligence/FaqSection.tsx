import { ChevronDown } from "lucide-react";
import { SectionHeading } from "./shared";

const FAQS = [
  {
    q: "What is Aislix?",
    a: "Aislix is an AI-powered retail shelf intelligence platform. Upload a shelf photo and get product detection, brand identification, counts and shelf health insights.",
  },
  {
    q: "How does Aislix analyze a shelf?",
    a: "Computer vision and AI detect individual product facings, read packaging where visible, and aggregate structured inventory and shelf metrics.",
  },
  { q: "Do I need special hardware?", a: "No. A standard smartphone camera is enough." },
  {
    q: "Can I use Aislix with a normal smartphone?",
    a: "Yes. Take a photo in-store and upload it to Aislix.",
  },
  {
    q: "How many free scans do I get?",
    a: "3 free shelf scans when you create a workspace. The live demo on this page includes additional anonymous trial scans per day.",
  },
  {
    q: "Can my team use Aislix?",
    a: "Yes. Invite team members after signup — roles for owners, managers and field users.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="scroll-mt-16 bg-background py-16 sm:py-20">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <SectionHeading eyebrow="FAQ" title="Questions retail teams ask" />
        <div className="mt-8 divide-y divide-border rounded-xl border border-border bg-card">
          {FAQS.map(({ q, a }) => (
            <details key={q} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-foreground">
                {q}
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
