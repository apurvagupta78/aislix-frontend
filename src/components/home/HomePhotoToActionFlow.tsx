import { Fragment } from "react";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Eye,
  FileText,
  Leaf,
  MessageCircle,
  ShieldCheck,
  Store,
  TrendingUp,
  Users,
  Zap,
  AlertTriangle,
  UserRound,
} from "lucide-react";
import { HERO_SHELF_IMAGE, DEMO_SHELF_IMAGE } from "@/lib/home/homepage-data";

const STEPS = [
  {
    n: 1,
    title: "At the Store",
    body: "Capture a photo of the shelf or fill a quick digital audit.",
    tone: "local" as const,
    icon: Store,
  },
  {
    n: 2,
    title: "No More WhatsApp",
    body: "Stop losing photos in personal chats. Send directly via WhatsApp or the Aislix app.",
    tone: "supermarket" as const,
    icon: MessageCircle,
  },
  {
    n: 3,
    title: "AI Analysis",
    body: "Aislix detects products, checks planograms, finds issues and creates an audit.",
    tone: "warehouse" as const,
    icon: null,
  },
  {
    n: 4,
    title: "Audit History",
    body: "Every audit is saved with date, store, photos, findings and status. Track progress over time.",
    tone: "local" as const,
    icon: FileText,
  },
  {
    n: 5,
    title: "Action & Improvement",
    body: "Assign corrective actions, track SLAs and re-audit to ensure issues are resolved.",
    tone: "supermarket" as const,
    icon: TrendingUp,
  },
];

const BENEFITS = [
  {
    icon: Eye,
    title: "Full Visibility",
    body: "See what's really happening on the ground.",
    tone: "local" as const,
  },
  {
    icon: Zap,
    title: "Save Time",
    body: "Replace manual follow-ups and scattered photos.",
    tone: "supermarket" as const,
  },
  {
    icon: ShieldCheck,
    title: "Accountability",
    body: "Convert findings into actions with SLAs.",
    tone: "custom" as const,
  },
  {
    icon: BarChart3,
    title: "Track Progress",
    body: "Audit history shows real improvement.",
    tone: "darkstore" as const,
  },
  {
    icon: Users,
    title: "Better Collaboration",
    body: "Keep field teams, managers and HQ aligned.",
    tone: "warehouse" as const,
  },
  {
    icon: Leaf,
    title: "Drive Growth",
    body: "Better execution leads to stronger brand performance.",
    tone: "supermarket" as const,
  },
];

const TONE = {
  local: {
    card: "border-[var(--aislix-local-border)] bg-[var(--aislix-local-bg)]",
    ink: "text-[#2A6FA8]",
    iconBg: "bg-white text-[#2A6FA8]",
  },
  supermarket: {
    card: "border-[var(--aislix-supermarket-border)] bg-[var(--aislix-supermarket-bg)]",
    ink: "text-[#4F6B2E]",
    iconBg: "bg-white text-[#4F6B2E]",
  },
  warehouse: {
    card: "border-[var(--aislix-warehouse-border)] bg-[var(--aislix-warehouse-bg)]",
    ink: "text-[#1F6FB2]",
    iconBg: "bg-white text-[#1F6FB2]",
  },
  darkstore: {
    card: "border-[var(--aislix-darkstore-border)] bg-[var(--aislix-darkstore-bg)]",
    ink: "text-[#B03A63]",
    iconBg: "bg-white text-[#B03A63]",
  },
  custom: {
    card: "border-[var(--aislix-custom-border)] bg-[var(--aislix-custom-bg)]",
    ink: "text-[#35658F]",
    iconBg: "bg-white text-[#35658F]",
  },
};

function StepVisual({ step }: { step: (typeof STEPS)[number] }) {
  if (step.n === 1) {
    return (
      <div className="relative mt-4 overflow-hidden rounded-xl border border-border bg-white">
        <img
          src={DEMO_SHELF_IMAGE}
          alt=""
          className="aspect-[4/3] w-full object-cover opacity-90"
          loading="lazy"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--aislix-primary)]/25">
          <div className="w-[42%] overflow-hidden rounded-lg border-2 border-white shadow-lift">
            <img src={DEMO_SHELF_IMAGE} alt="" className="aspect-[9/16] w-full object-cover" loading="lazy" />
          </div>
        </div>
      </div>
    );
  }
  if (step.n === 2) {
    return (
      <div className="mt-4 rounded-xl border border-[var(--aislix-supermarket-border)] bg-white p-3 shadow-soft">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--aislix-supermarket-bg)] text-[#4F6B2E]">
            <MessageCircle className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="overflow-hidden rounded-lg border border-border">
              <img src={HERO_SHELF_IMAGE} alt="" className="aspect-video w-full object-cover" loading="lazy" />
            </div>
            <p className="mt-2 text-xs font-semibold text-foreground">Photo sent to Aislix</p>
            <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
              10:24 AM
              <CheckCircle2 className="size-3 text-[#4F6B2E]" aria-hidden="true" />
            </p>
          </div>
        </div>
      </div>
    );
  }
  if (step.n === 3) {
    return (
      <div className="relative mt-4 overflow-hidden rounded-xl border border-border bg-white">
        <img src={HERO_SHELF_IMAGE} alt="" className="aspect-[4/3] w-full object-cover" loading="lazy" />
        <span className="absolute left-[8%] top-[18%] rounded bg-[#79E2A8] px-1.5 py-0.5 text-[9px] font-bold text-[var(--aislix-primary)]">
          Lays · 5 facings
        </span>
        <span className="absolute left-[38%] top-[40%] rounded bg-[#7DB7D6] px-1.5 py-0.5 text-[9px] font-bold text-white">
          Coke · 3 facings
        </span>
        <span className="absolute left-[55%] top-[22%] rounded bg-[#FFEAF1] px-1.5 py-0.5 text-[9px] font-bold text-[#B03A63]">
          Colgate · 2 facings
        </span>
      </div>
    );
  }
  if (step.n === 4) {
    const rows = [
      { icon: CheckCircle2, label: "Store Audit Completed", date: "12 Sep 2026", color: "text-[#4F6B2E]" },
      { icon: AlertTriangle, label: "Findings Raised", date: "12 Sep 2026", color: "text-[#B7791F]" },
      { icon: UserRound, label: "Action Assigned", date: "13 Sep 2026", color: "text-[#9B86D9]" },
      { icon: CheckCircle2, label: "Re-audit Completed", date: "18 Sep 2026", color: "text-[#4F6B2E]" },
    ];
    return (
      <ul className="mt-4 space-y-2 rounded-xl border border-border bg-white p-3">
        {rows.map((r) => (
          <li key={r.label} className="flex items-start gap-2">
            <r.icon className={`mt-0.5 size-4 shrink-0 ${r.color}`} aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold text-foreground">{r.label}</p>
              <p className="text-[10px] text-muted-foreground">{r.date}</p>
            </div>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="mt-4 rounded-xl border border-[var(--aislix-supermarket-border)] bg-white p-3">
      <div className="flex items-center gap-2 text-[#4F6B2E]">
        <CheckCircle2 className="size-4" aria-hidden="true" />
        <p className="text-xs font-bold uppercase tracking-wide">Issue Resolved</p>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Planogram compliance improved from 62% to 92%.
      </p>
      <div className="mt-3 flex items-end gap-3 px-1">
        <div className="flex flex-1 flex-col items-center gap-1">
          <div className="h-8 w-full rounded-t bg-[var(--aislix-custom-border)]" />
          <span className="text-[10px] font-semibold text-muted-foreground">62%</span>
        </div>
        <div className="flex flex-[1.4] flex-col items-center gap-1">
          <div className="h-16 w-full rounded-t bg-[#79E2A8]" />
          <span className="text-[10px] font-semibold text-[#4F6B2E]">92%</span>
        </div>
      </div>
    </div>
  );
}

export function HomePhotoToActionFlow() {
  return (
    <section
      id="photo-to-action"
      className="scroll-mt-[5.5rem] border-t border-border bg-card py-20 lg:py-28"
      aria-labelledby="flow-title"
    >
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 id="flow-title" className="text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-4xl">
            From a photo to real action.{" "}
            <span className="text-[#4F6B2E]">All in one place.</span>
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            No more scattered photos on WhatsApp. Turn every store visit into structured audits,
            history and action — with Aislix.
          </p>
        </div>

        <div className="mt-12 flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-2">
          {STEPS.map((step, i) => {
            const tone = TONE[step.tone];
            const Icon = step.icon;
            return (
              <Fragment key={step.title}>
                <article
                  className={`flex flex-1 flex-col rounded-2xl border p-4 shadow-soft sm:p-5 ${tone.card}`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`flex size-10 shrink-0 items-center justify-center rounded-xl shadow-sm ${tone.iconBg}`}
                    >
                      {Icon ? (
                        <Icon className="size-5" aria-hidden="true" />
                      ) : (
                        <span className="text-sm font-bold tracking-tight">A</span>
                      )}
                    </span>
                    <div>
                      <p className={`text-sm font-bold ${tone.ink}`}>
                        {step.n}. {step.title}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                    </div>
                  </div>
                  <StepVisual step={step} />
                </article>
                {i < STEPS.length - 1 ? (
                  <div className="hidden shrink-0 items-center lg:flex" aria-hidden="true">
                    <ArrowRight className="size-5 text-[var(--aislix-primary)]/40" />
                  </div>
                ) : null}
              </Fragment>
            );
          })}
        </div>

        <ul className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {BENEFITS.map(({ icon: Icon, title, body, tone }) => (
            <li key={title} className="text-center">
              <span
                className={`mx-auto flex size-11 items-center justify-center rounded-full border ${TONE[tone].card} ${TONE[tone].ink}`}
              >
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-3 text-sm font-bold text-foreground">{title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
