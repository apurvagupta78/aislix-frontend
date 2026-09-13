import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type PlanogramModeChoice = "demo" | "custom" | "none";

export const PLANOGRAM_UPLOAD_OPTIONS: Array<{
  mode: Exclude<PlanogramModeChoice, "demo">;
  label: string;
  detail: string;
}> = [
  {
    mode: "custom",
    label: "Use My Planogram",
    detail: "Compare the shelf against your own planogram.",
  },
  {
    mode: "none",
    label: "Audit Without Planogram",
    detail: "Analyse the visible shelf without an expected layout.",
  },
];

export const PLANOGRAM_SAMPLE_OPTIONS: Array<{
  mode: PlanogramModeChoice;
  label: string;
  detail: string;
  recommended?: boolean;
}> = [
  {
    mode: "demo",
    label: "Use Demo Setup",
    detail: "Recommended for the free demo.",
    recommended: true,
  },
  ...PLANOGRAM_UPLOAD_OPTIONS,
];

export function PlanogramModeOption({
  label,
  detail,
  selected,
  recommended,
  disabled,
  onClick,
}: {
  label: string;
  detail: string;
  selected: boolean;
  recommended?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        selected
          ? "border-brand bg-brand-soft/50 shadow-sm"
          : "border-border bg-card hover:border-brand/30",
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        {recommended ? (
          <Badge variant="secondary" className="text-[10px] font-medium">
            Recommended
          </Badge>
        ) : null}
      </div>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{detail}</p>
    </button>
  );
}
