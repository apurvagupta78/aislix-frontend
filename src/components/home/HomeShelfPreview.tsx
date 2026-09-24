import { Fragment } from "react";
import { AlertTriangle, Camera, History, Sparkles, Wrench } from "lucide-react";
import {
  HERO_SHELF_IMAGE,
  heroAnnotations,
  heroInsights,
} from "@/lib/home/homepage-data";
import { toneBox, toneCard, toneLabel, toneText } from "@/lib/home/homepage-tone";

const flow = [
  { icon: Camera, label: "Capture" },
  { icon: Sparkles, label: "Analyse" },
  { icon: Wrench, label: "Act" },
  { icon: History, label: "Track" },
];

export function HomeShelfPreview() {
  return (
    <div
      className="home-product-frame rounded-3xl border border-border bg-card p-3 sm:p-4"
      aria-label="Example shelf audit"
    >
      <div className="flex items-center justify-between px-2 pb-3 pt-1">
        <div className="flex items-center gap-2" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-[var(--aislix-darkstore-border)]" />
          <span className="size-2.5 rounded-full bg-[var(--aislix-supermarket-border)]" />
          <span className="size-2.5 rounded-full bg-[var(--aislix-warehouse-border)]" />
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          Oral care · Aisle 7 · Today 10:42
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1.1fr_1fr]">
        <div className="relative overflow-hidden rounded-2xl bg-surface">
          <img
            src={HERO_SHELF_IMAGE}
            alt="Supermarket oral care shelf with AI detection boxes"
            className="aspect-[4/5] w-full object-cover"
            width={640}
            height={800}
            fetchPriority="high"
            decoding="async"
          />
          {heroAnnotations.map((a) => (
            <div
              key={a.label}
              className={`absolute rounded-md border-2 ${toneBox[a.tone]}`}
              style={{
                left: `${a.left}%`,
                top: `${a.top}%`,
                width: `${a.width}%`,
                height: `${a.height}%`,
              }}
            >
              <span
                className={`absolute -top-5 left-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold ${toneLabel[a.tone]}`}
              >
                {a.label}
              </span>
            </div>
          ))}
          <span className="absolute bottom-3 left-3 rounded-md bg-[var(--aislix-primary)]/85 px-2 py-1 text-[11px] font-semibold text-white">
            16 products detected
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <div className="rounded-2xl bg-[var(--aislix-primary)] p-4 text-white">
            <p className="text-xs font-medium text-white/70">Shelf score</p>
            <p className="mt-1 text-4xl font-bold tracking-tight">
              87<span className="text-lg text-white/60">/100</span>
            </p>
            <div className="mt-3 h-1.5 rounded-full bg-white/15">
              <div className="h-full w-[87%] rounded-full bg-white" />
            </div>
            <p className="mt-2 text-xs text-white/70">+6 vs last visit</p>
          </div>
          {heroInsights.map(({ icon: Icon, label, value, tone }) => (
            <div
              key={label}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${toneCard[tone]}`}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white">
                <Icon className={`size-4 ${toneText[tone]}`} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
                <p className="truncate text-sm font-semibold text-foreground">{value}</p>
              </div>
            </div>
          ))}
          <div className="mt-auto flex items-center gap-2 rounded-xl border border-border px-3 py-2.5">
            <AlertTriangle
              className="size-4 shrink-0 text-[#C2410C]"
              aria-hidden="true"
            />
            <p className="text-sm font-semibold text-foreground">3 actions to review</p>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-2 border-t border-border pt-3 text-xs font-medium text-muted-foreground sm:gap-4">
        {flow.map(({ icon: Icon, label }, i) => (
          <Fragment key={label}>
            <span className="flex items-center gap-1.5">
              <Icon className="size-3.5 text-[var(--aislix-primary)]" aria-hidden="true" />
              {label}
            </span>
            {i < flow.length - 1 && (
              <span className="text-border" aria-hidden="true">
                —
              </span>
            )}
          </Fragment>
        ))}
      </div>
      <p className="pb-1 pt-2 text-center text-[11px] text-muted-foreground">
        Aislix demo data · example annotations for illustration
      </p>
    </div>
  );
}
