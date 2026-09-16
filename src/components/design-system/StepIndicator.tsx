import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export type StepDef = { id: string | number; label: string };

type Props = {
  steps: StepDef[];
  currentIndex: number;
  completedThrough?: number;
};

/** Clear progress for guided flows — numbered, labelled, and readable on mobile. */
export function StepIndicator({ steps, currentIndex, completedThrough }: Props) {
  const doneThrough = completedThrough ?? currentIndex;
  const current = steps[currentIndex];

  return (
    <div>
      <ol
        className="flex flex-wrap items-center gap-2 md:gap-0"
        aria-label={`Step ${currentIndex + 1} of ${steps.length}`}
      >
        {steps.map((step, index) => {
          const done = index < doneThrough;
          const active = index === currentIndex;
          return (
            <li key={step.id} className="flex min-w-0 flex-1 items-center">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors",
                    done
                      ? "border-status-good bg-status-good-soft text-status-good-strong"
                      : active
                        ? "border-brand bg-brand text-brand-foreground shadow-soft"
                        : "border-border bg-card text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-4" aria-hidden /> : index + 1}
                </span>
                <p
                  className={cn(
                    "hidden truncate text-sm font-semibold sm:block",
                    done || active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </p>
              </div>
              {index < steps.length - 1 ? (
                <div
                  className={cn(
                    "mx-2 hidden h-0.5 flex-1 rounded-full md:block",
                    done ? "bg-status-good/40" : "bg-border",
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-xs font-medium text-muted-foreground sm:hidden">
        Step {currentIndex + 1} of {steps.length}
        {current ? ` — ${current.label}` : ""}
      </p>
    </div>
  );
}
