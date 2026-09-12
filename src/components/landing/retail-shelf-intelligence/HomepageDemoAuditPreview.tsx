import { useMemo } from "react";
import {
  BadgePercent,
  BarChart3,
  CircleCheck,
  History,
  Image as ImageIcon,
  LayoutGrid,
  Package,
  Sparkles,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DEFAULT_SAMPLE_IMAGE } from "@/lib/landing-scan-api";
import { DEMO_PLANOGRAM_LABEL } from "@/lib/demo-oral-care-planogram";
import {
  getHomepageDemoPreviewStats,
  HOMEPAGE_DEMO_SHELF_OVERLAYS,
  type DemoShelfOverlay,
} from "@/lib/homepage-demo-preview";
import { cn } from "@/lib/utils";

const PROCESS_STEPS = [
  { icon: ImageIcon, label: "Capture" },
  { icon: Sparkles, label: "Analyse" },
  { icon: Wrench, label: "Act" },
  { icon: History, label: "Track" },
] as const;

function overlayStyles(kind: DemoShelfOverlay["kind"]) {
  switch (kind) {
    case "issue":
      return "border-amber-500/70 bg-amber-500/10";
    case "availability":
      return "border-brand/50 bg-brand/10";
    case "brand":
      return "border-brand/60 bg-brand/5";
    default:
      return "border-emerald-500/55 bg-emerald-500/8";
  }
}

function IntelligenceRow({
  icon: Icon,
  title,
  value,
  context,
}: {
  icon: typeof Package;
  title: string;
  value: string;
  context?: string;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border/80 bg-background/80 px-3 py-2 shadow-sm">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-brand-soft text-brand">
        <Icon className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 text-left">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        <p className="text-[13px] font-semibold leading-snug tabular-nums text-foreground">
          {value}
        </p>
        {context ? (
          <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{context}</p>
        ) : null}
      </div>
    </div>
  );
}

export function HomepageDemoAuditPreview() {
  const stats = useMemo(() => getHomepageDemoPreviewStats(), []);

  const rows = [
    {
      icon: Package,
      title: "Products & Brands",
      value: `${stats.productsDetected} products · ${stats.brandsDetected} brands detected`,
    },
    {
      icon: CircleCheck,
      title: "Availability",
      value: `${stats.osaPercent}% on-shelf`,
    },
    {
      icon: LayoutGrid,
      title: "Shelf Execution",
      value: `${stats.shelfExecutionPercent}% compliant`,
    },
    {
      icon: BarChart3,
      title: "Brand & Competition",
      value: `${stats.primaryBrand} ${stats.primaryBrandShelfSharePercent}% shelf share · ${stats.brandsDetected} brands`,
      context: "Brand presence vs category competition",
    },
    {
      icon: BadgePercent,
      title: "Prices & Promotions",
      value: `${stats.priceIssueCount} issue${stats.priceIssueCount === 1 ? "" : "s"} detected`,
    },
    {
      icon: TriangleAlert,
      title: "Actions",
      value: `${stats.actionIssueCount} issue${stats.actionIssueCount === 1 ? "" : "s"} to review`,
    },
  ] as const;

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch">
        {/* Shelf photograph — ~55% on desktop */}
        <div className="lg:w-[55%]">
          <div className="relative overflow-hidden rounded-xl border border-border bg-muted/20 shadow-sm">
            <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-2">
              <Badge className="rounded-md bg-brand px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand-foreground">
                AI Shelf Audit
              </Badge>
              <Badge
                variant="outline"
                className="rounded-md border-border/80 bg-background/90 px-2 py-1 text-[10px] font-medium text-foreground"
              >
                {stats.productsDetected} Products Detected
              </Badge>
            </div>

            <div className="relative mx-auto aspect-[3/4] max-h-[min(72vh,640px)] w-full sm:aspect-[4/5] lg:max-h-[560px]">
              <img
                src={DEFAULT_SAMPLE_IMAGE}
                alt="Demo retail shelf — oral care gondola"
                loading="lazy"
                decoding="async"
                className="size-full object-contain object-center p-2 sm:p-3"
              />

              {/* AI analysis overlays */}
              <div className="pointer-events-none absolute inset-2 sm:inset-3" aria-hidden="true">
                {HOMEPAGE_DEMO_SHELF_OVERLAYS.map((box) => (
                  <div
                    key={box.id}
                    className={cn(
                      "absolute rounded-sm border shadow-sm",
                      overlayStyles(box.kind),
                    )}
                    style={{
                      left: `${box.left}%`,
                      top: `${box.top}%`,
                      width: `${box.width}%`,
                      height: `${box.height}%`,
                    }}
                  >
                    {box.kind === "issue" || box.kind === "availability" ? (
                      <span className="absolute -top-0.5 left-1 max-w-[95%] truncate rounded bg-background/90 px-1 py-px text-[8px] font-medium text-foreground shadow-sm sm:text-[9px]">
                        {box.label}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <p className="border-t border-border/60 px-3 py-2 text-center text-[10px] text-muted-foreground">
              {DEMO_PLANOGRAM_LABEL} · Example annotations for illustration
            </p>
          </div>
        </div>

        {/* Intelligence preview — ~45% on desktop */}
        <div className="flex flex-col justify-center gap-2 lg:w-[45%] lg:py-0">
          <p className="mb-0.5 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-brand lg:text-left">
            Retail insights preview
          </p>
          {rows.map((row) => (
            <IntelligenceRow key={row.title} {...row} />
          ))}
          <p className="mt-0.5 text-center text-[10px] leading-relaxed text-muted-foreground lg:text-left">
            {DEMO_PLANOGRAM_LABEL} — example shelf share and competitive metrics for illustration,
            computed from the demo reference planogram.
          </p>
        </div>
      </div>

      <div
        className="mt-5 flex flex-wrap items-center justify-center gap-2 border-t border-border/70 pt-4 text-[11px] text-muted-foreground sm:text-xs"
        aria-label="Capture, analyse, act, track"
      >
        {PROCESS_STEPS.map(({ icon: Icon, label }, index) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            {index > 0 ? (
              <span className="px-0.5 text-muted-foreground/45" aria-hidden="true">
                →
              </span>
            ) : null}
            <Icon className="size-4 text-brand/75" strokeWidth={1.75} aria-hidden="true" />
            <span>{label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
