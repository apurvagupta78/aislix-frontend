import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

const SETUP_STEPS = [
  { id: 1, label: "Operating Model" },
  { id: 2, label: "Location" },
  { id: 3, label: "Audit Method" },
  { id: 4, label: "Template / CSV" },
] as const;

export function NewAuditProgress({
  completedThrough,
  phase,
}: {
  completedThrough: number;
  phase: "setup" | "configure" | "assign";
}) {
  const phaseLabel =
    phase === "configure" ? "Configure data" : phase === "assign" ? "Assign audit" : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 md:gap-0">
        {SETUP_STEPS.map((step, index) => {
          const done = step.id <= completedThrough;
          const active = phase === "setup" && step.id === completedThrough + 1;
          return (
            <div key={step.id} className="flex min-w-0 flex-1 items-center">
              <div className="flex min-w-0 items-center gap-2">
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                    done
                      ? "border-brand bg-brand text-brand-foreground"
                      : active
                        ? "border-brand bg-brand-soft/50 text-brand"
                        : "border-border bg-muted/40 text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-4" /> : step.id}
                </div>
                <div className="min-w-0 hidden sm:block">
                  <p
                    className={cn(
                      "truncate text-xs font-semibold",
                      done || active ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </p>
                </div>
              </div>
              {index < SETUP_STEPS.length - 1 ? (
                <div
                  className={cn(
                    "mx-2 hidden h-px flex-1 md:block",
                    done ? "bg-brand/40" : "bg-border",
                  )}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      {phaseLabel ? (
        <p className="text-sm text-muted-foreground">
          Next: <span className="font-medium text-foreground">{phaseLabel}</span>
        </p>
      ) : null}
    </div>
  );
}
