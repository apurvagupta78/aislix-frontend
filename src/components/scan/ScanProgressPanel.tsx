import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { SCAN_STAGES } from "@/lib/scan-api";
import { cn } from "@/lib/utils";

export const AI_DISCLAIMER = "AI can make mistakes. Verify critical counts before acting on results.";

const DEMO_STAGES = [
  "Uploading image",
  "Detecting products",
  "Identifying brands & variants",
  "Counting inventory",
  "Building report",
] as const;

type ScanProgressPanelProps = {
  /** True while the scan is in flight. */
  active: boolean;
  /** True once the scan finished — snaps the bar to 100%. */
  done?: boolean;
  /** Roughly how long a scan takes; drives the eased progress curve. */
  expectedMs?: number;
  stages?: readonly string[];
  timingMessage?: string;
  /** Headline shown while running (samples use "Running demo scan…"). */
  title?: string;
  /** Show the stepped stage checklist (dashboard) instead of the compact label. */
  showStageList?: boolean;
  className?: string;
};

/**
 * Shared shelf-scan progress experience used by the dashboard processing screen
 * and the public landing demo, so both show identical bar, phases and copy.
 */
export function ScanProgressPanel({
  active,
  done = false,
  expectedMs = 120_000,
  stages = DEMO_STAGES,
  timingMessage = "This usually takes 2–3 minutes for large shelves. Keep this page open.",
  showStageList = false,
  title = "Analyzing shelf…",
  className,
}: ScanProgressPanelProps) {
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    if (!active) {
      setProgress(8);
      return;
    }
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const ratio = Math.min(1, (Date.now() - startedAt) / expectedMs);
      const eased = 8 + (98 - 8) * (1 - Math.pow(1 - ratio, 1.8));
      setProgress((current) => Math.max(current, Math.min(98, Math.round(eased))));
    }, 500);
    return () => clearInterval(timer);
  }, [active, expectedMs]);

  const value = done ? 100 : Math.min(progress, 98);
  const activeStage = Math.min(stages.length - 1, Math.floor((value / 100) * stages.length));

  return (
    <div className={cn("w-full", className)}>
      <p className="text-sm font-semibold text-foreground">
        {done ? "Analysis complete" : title}
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{timingMessage}</p>

      <div className="mt-5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{done ? stages[stages.length - 1] : stages[activeStage]}</span>
          <span>{value}%</span>
        </div>
        <Progress value={value} className="mt-2 h-2 rounded-full" />
      </div>

      {showStageList ? (
        <ul className="mt-6 space-y-3 text-left">
          {stages.map((stage, index) => {
            const stageDone = index < activeStage || done;
            const stageActive = index === activeStage && !done;
            return (
              <li key={stage} className="flex items-center gap-3">
                <span
                  className={`grid size-6 place-items-center rounded-full text-brand-foreground ${
                    stageDone ? "bg-brand" : stageActive ? "bg-brand/60" : "bg-muted"
                  }`}
                >
                  {stageDone ? (
                    <Check className="size-3.5" />
                  ) : stageActive ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-muted-foreground" />
                  )}
                </span>
                <span
                  className={`text-sm ${stageDone || stageActive ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {stage}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">{AI_DISCLAIMER}</p>
    </div>
  );
}

export { SCAN_STAGES };
