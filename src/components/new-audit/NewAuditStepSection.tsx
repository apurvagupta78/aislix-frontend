import type { ReactNode } from "react";
import { Check } from "lucide-react";

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
        "scroll-mt-28 rounded-2xl border border-[var(--aislix-border)] bg-white p-5 md:p-6",
        className,
      )}
    >
      <header className="mb-5 flex items-start gap-3">
        <span
          aria-label={complete ? `Step ${stepNumber} done` : `Step ${stepNumber}`}
          className={cn(
            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
            complete
              ? "border-[#04203F] bg-[#04203F] text-white"
              : "border-[var(--aislix-border)] bg-white text-[var(--aislix-secondary)]",
          )}
        >
          {complete ? <Check className="size-3.5" /> : stepNumber}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-[var(--aislix-primary)]">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-[var(--aislix-secondary)]">{description}</p>
          ) : null}
        </div>
      </header>
      {error ? <p className="mb-4 text-sm font-medium text-[#04203F]">{error}</p> : null}
      {children}
    </section>
  );
}
