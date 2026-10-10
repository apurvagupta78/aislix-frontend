import { createFileRoute, Link } from "@tanstack/react-router";
import { Camera, ClipboardCheck, FileText, Smartphone, Store, Users } from "lucide-react";

import { MarketingPage } from "@/components/MarketingLayout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/guide")({
  head: () => ({
    meta: [
      { title: "Getting started with Aislix — pilot guide" },
      {
        name: "description",
        content:
          "Set up your Aislix workspace, add stores, invite your team and run your first AI shelf audit. A daily routine for supermarkets, dark stores, FMCG brands, distributors and local stores.",
      },
      { property: "og:url", content: "https://aislix.com/guide" },
    ],
    links: [{ rel: "canonical", href: "https://aislix.com/guide" }],
  }),
  component: GuidePage,
});

const SETUP = [
  {
    icon: Smartphone,
    title: "Get the app",
    body: "Android: download the Aislix app. iPhone: open aislix.com in Safari, tap Share, then Add to Home Screen.",
    link: { to: "/app" as const, label: "Get the app" },
  },
  {
    icon: Store,
    title: "Create your workspace and add stores",
    body: "Sign up, then follow the four setup steps. Add more stores one by one or import a CSV list in Organization & Stores.",
    link: { to: "/stores" as const, label: "Organization & stores" },
  },
  {
    icon: Users,
    title: "Invite your team",
    body: "Invite store managers and auditors by email. Give each person the stores they look after; they only see those stores.",
    link: { to: "/team" as const, label: "Team" },
  },
  {
    icon: Camera,
    title: "Run your first AI audit",
    body: "Tap New Audit, pick the store and take shelf photos. Results are ready in about a minute.",
    link: { to: "/new-audit" as const, label: "New audit" },
  },
  {
    icon: ClipboardCheck,
    title: "Fix what the AI found",
    body: "Empty shelves, wrong placements, empty bins and damaged displays become fixes with an owner and a due date. Close a fix with an after photo.",
    link: { to: "/corrective-actions" as const, label: "Corrective actions" },
  },
  {
    icon: FileText,
    title: "Share the report",
    body: "Save any report as PDF or Excel, or share it by link, WhatsApp or email.",
    link: { to: "/report" as const, label: "Reports" },
  },
];

const ROUTINES = [
  {
    segment: "Supermarket",
    who: "Store and category managers",
    steps: [
      "Every morning, photograph each aisle with New Audit.",
      "Open the Restock list report: what to refill and what to put back, store by store.",
      "Assign the fixes to the floor team and check they are closed before noon.",
    ],
    report: "restock",
  },
  {
    segment: "Dark store",
    who: "Store managers and quality checkers",
    steps: [
      "Walk the racks and take one Rack Check photo per rack, whole rack in frame.",
      "The result shows which bins are empty, low or messy, so the team knows what to refill and tidy.",
      "Re-check the same rack after refilling to confirm it is full.",
    ],
    page: { to: "/rack-check" as const, label: "Rack check" },
  },
  {
    segment: "FMCG brand",
    who: "Sales and trade marketing teams",
    steps: [
      "Field reps photograph your shelf and your display in each outlet.",
      "Use Display Check with your brand name to confirm the display is there and in good shape.",
      "Download the Claim proof pack for display and visibility payments.",
    ],
    page: { to: "/display-check" as const, label: "Display check" },
    report: "claim",
  },
  {
    segment: "Distributor",
    who: "Sales managers and field reps",
    steps: [
      "Import your outlet list once, then reps audit each outlet on their route.",
      "Keep phone location on so each visit is stamped with place and time.",
      "Open Field team coverage to see visited outlets and what to restock next.",
    ],
    report: "field",
  },
  {
    segment: "Local store",
    who: "Store owners",
    steps: [
      "Take one photo of each shelf in the evening.",
      "Open the Restock list: what is running out and what to reorder.",
      "Share the list with your supplier on WhatsApp.",
    ],
    report: "restock",
  },
];

const PHOTO_TIPS = [
  "Stand straight in front of the shelf, not at an angle.",
  "Use the normal 1x lens, not ultra-wide.",
  "Fit the whole shelf or rack in the frame, top to bottom.",
  "Good light, no flash glare on packets or price tags.",
  "If the result says the photo is unclear, retake it closer; nothing is raised from an unclear photo.",
];

function GuidePage() {
  return (
    <MarketingPage>
      <section className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-sm font-medium text-[#667085]">Pilot guide</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#04203F] sm:text-4xl">Getting started with Aislix</h1>
        <p className="mt-3 max-w-2xl text-base text-[#667085]">
          Six steps to your first audit, then a simple daily routine for your type of business.
        </p>

        <ol className="mt-8 grid gap-3 sm:grid-cols-2">
          {SETUP.map((step, i) => (
            <li key={step.title} className="rounded-2xl border border-[#D9E2E8] bg-white p-5">
              <div className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#EEF1F4] text-sm font-semibold text-[#04203F]">
                  {i + 1}
                </span>
                <step.icon className="size-4 text-[#7DB7D6]" aria-hidden />
                <h2 className="text-base font-semibold text-[#04203F]">{step.title}</h2>
              </div>
              <p className="mt-2 text-sm text-[#667085]">{step.body}</p>
              <Link to={step.link.to} className="mt-3 inline-block text-sm font-medium text-[#04203F] underline">
                {step.link.label}
              </Link>
            </li>
          ))}
        </ol>

        <h2 className="mt-12 text-2xl font-semibold text-[#04203F]">Your daily routine</h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {ROUTINES.map((r) => (
            <article key={r.segment} className="rounded-2xl border border-[#D9E2E8] bg-white p-5">
              <h3 className="text-base font-semibold text-[#04203F]">{r.segment}</h3>
              <p className="text-xs text-[#667085]">{r.who}</p>
              <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-[#04203F]">
                {r.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                {r.page ? (
                  <Link to={r.page.to} className="font-medium text-[#04203F] underline">
                    {r.page.label}
                  </Link>
                ) : null}
                {r.report ? (
                  <a href={`/report?type=${r.report}`} className="font-medium text-[#04203F] underline">
                    Open the report
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>

        <h2 className="mt-12 text-2xl font-semibold text-[#04203F]">Photo tips</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-[#04203F]">
          {PHOTO_TIPS.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>

        <div className="mt-12 rounded-2xl border border-[#D9E2E8] bg-[#F4F7F9] p-5">
          <p className="text-sm font-semibold text-[#04203F]">Need help during the pilot?</p>
          <p className="mt-1 text-sm text-[#667085]">Write to hello@aislix.com and we will reply the same working day.</p>
          <Button asChild variant="brand" className="mt-3 rounded-xl">
            <Link to="/contact">Contact us</Link>
          </Button>
        </div>
      </section>
    </MarketingPage>
  );
}
