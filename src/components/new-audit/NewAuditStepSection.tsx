import type { ReactNode } from "react";
import { CheckCircle2, CircleDashed } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  id: string;
  stepNumber: number;
  title: string;
  description?: string;
  complete?: boolean;
  error?: string | null;
  children: ReactNode;
  className?: string;
};

export function NewAuditStepSection({
  id,
  stepNumber,
  title,
  description,
  complete,
  error,
  children,
  className,
}: Props) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-28 rounded-2xl border border-[var(--aislix-border)] bg-white p-5 shadow-soft md:p-6",
        className,
      )}
    >
      <header className="mb-5 flex items-start gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold",
            complete
              ? "border-[var(--aislix-supermarket-border)] bg-[var(--aislix-supermarket-bg)] text-[var(--aislix-primary)]"
              : "border-[var(--aislix-border)] bg-[var(--aislix-surface)] text-[var(--aislix-secondary)]",
          )}
        >
          {complete ? <CheckCircle2 className="size-4" /> : stepNumber}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--aislix-secondary)]">
            Step {stepNumber}
          </p>
          <h2 className="font-display text-lg font-semibold text-[var(--aislix-primary)]">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-[var(--aislix-secondary)]">{description}</p>
          ) : null}
        </div>
        {!complete && !error ? (
          <CircleDashed className="size-4 shrink-0 text-[var(--aislix-secondary)]" aria-hidden />
        ) : null}
      </header>
      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
      {children}
    </section>
  );
}
