import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type KpiTone = "neutral" | "good" | "warn" | "danger" | "info";

const TONE_DOT: Record<KpiTone, string> = {
  neutral: "bg-[#D9E2E8]",
  good: "bg-[#79E2A8]",
  warn: "bg-[#8EC9E8]",
  danger: "bg-[#ECBDCC]",
  info: "bg-[#7DB7D6]",
};

export function KpiCard({
  label,
  value,
  hint,
  tone = "neutral",
  className,
  onClick,
}: {
  label: string;
  value: string;
  hint?: string;
  /** Kept for call-site compatibility; KPI cards no longer render icons. */
  icon?: LucideIcon;
  /** Colour meaning: good / needs attention / urgent. */
  tone?: KpiTone;
  className?: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "rounded-lg border border-[#D9E2E8] bg-white p-4 text-left",
        onClick && "transition-colors hover:bg-[#F4F7F9]",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT[tone])} aria-hidden />
        <p className="truncate text-sm text-[#667085]">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums leading-none text-[#04203F]">{value}</p>
      {hint ? <p className="mt-1.5 text-xs text-[#667085]">{hint}</p> : null}
    </Tag>
  );
}
