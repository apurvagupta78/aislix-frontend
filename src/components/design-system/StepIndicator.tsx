import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export type StepDef = { id: string | number; label: string };

type Props = {
  steps: StepDef[];
  currentIndex: number;
  completedThrough?: number;
};

export function StepIndicator({ steps, currentIndex, completedThrough }: Props) {
  const doneThrough = completedThrough ?? currentIndex;

  return (
    <div className="flex flex-wrap items-center gap-2 md:gap-0">
      {steps.map((step, index) => {
        const done = index < doneThrough;
        const active = index === currentIndex;
        return (
          <div key={step.id} className="flex min-w-0 flex-1 items-center">
            <div className="flex min-w-0 items-center gap-2">
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                  done
                    ? "border-brand bg-brand text-brand-foreground"
                    : active
                      ? "border-brand bg-brand-soft/70 text-brand"
                      : "border-border bg-card text-muted-foreground",
                )}
              >
                {done ? <Check className="size-4" /> : index + 1}
              </div>
              <p
                className={cn(
                  "hidden truncate text-xs font-semibold sm:block",
                  done || active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </p>
            </div>
            {index < steps.length - 1 ? (
              <div
                className={cn(
                  "mx-2 hidden h-px flex-1 md:block",
                  done ? "bg-brand/35" : "bg-border",
                )}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
