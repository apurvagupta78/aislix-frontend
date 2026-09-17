import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  title?: string;
  description?: string;
  action?: ReactNode;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
  padded?: boolean;
};

/** Calm content surface that groups related work without looking like a floating panel. */
export function SectionCard({
  title,
  description,
  action,
  icon: Icon,
  children,
  className,
  padded = true,
}: Props) {
  return (
    <section className={cn("overflow-hidden rounded-xl border border-line bg-white shadow-card", className)}>
      {title || description || action ? (
        <div
          className={cn(
            "flex flex-wrap items-start justify-between gap-3 border-b border-line",
            padded ? "px-5 py-4" : "px-5 py-3",
          )}
        >
          <div className="flex min-w-0 items-start gap-3">
            {Icon ? (
              <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-warehouse-line bg-warehouse-bg text-navy">
                <Icon className="size-4" aria-hidden />
              </span>
            ) : null}
            <div className="min-w-0">
              {title ? (
                <h2 className="font-display text-[15px] font-semibold leading-tight text-navy">{title}</h2>
              ) : null}
              {description ? <p className="mt-1 text-[13px] text-mp-muted">{description}</p> : null}
            </div>
          </div>
          {action}
        </div>
      ) : null}
      <div className={padded ? "p-5" : undefined}>{children}</div>
    </section>
  );
}
