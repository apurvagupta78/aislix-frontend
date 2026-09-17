import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type MpBadgeTone =
  | "active"
  | "healthy"
  | "attention"
  | "neutral"
  | "local"
  | "market"
  | "dark"
  | "warehouse"
  | "fmcg";

const toneClasses: Record<MpBadgeTone, string> = {
  active: "bg-warehouse-bg border-warehouse-line",
  healthy: "bg-market-bg border-market-line",
  attention: "bg-dark-bg border-dark-line",
  neutral: "bg-neutral-bg border-neutral-line",
  local: "bg-local-bg border-local-line",
  market: "bg-market-bg border-market-line",
  dark: "bg-dark-bg border-dark-line",
  warehouse: "bg-warehouse-bg border-warehouse-line",
  fmcg: "bg-fmcg-bg border-fmcg-line",
};

const dotClasses: Record<MpBadgeTone, string> = {
  active: "bg-warehouse-line",
  healthy: "bg-market-line",
  attention: "bg-dark-line",
  neutral: "bg-neutral-line",
  local: "bg-local-line",
  market: "bg-market-line",
  dark: "bg-dark-line",
  warehouse: "bg-warehouse-line",
  fmcg: "bg-fmcg-line",
};

export function MpBadge({
  tone = "neutral",
  dot = false,
  children,
  className,
}: {
  tone?: MpBadgeTone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold text-navy",
        toneClasses[tone],
        className,
      )}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className={cn("h-1.5 w-1.5 rounded-full ring-1 ring-inset ring-navy/20", dotClasses[tone])}
        />
      ) : null}
      {children}
    </span>
  );
}

export function mpStageTone(stage: string): MpBadgeTone {
  if (stage === "Completed") return "healthy";
  if (stage === "In progress") return "active";
  return "neutral";
}
