import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Props = {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
};

/** White content surface with soft shadow — groups related UI. */
export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  padded = true,
}: Props) {
  return (
    <section className={cn("play-surface rounded-2xl", className)}>
      {title || description || action ? (
        <div
          className={cn(
            "flex flex-wrap items-start justify-between gap-3 border-b border-border/60",
            padded ? "px-5 py-4" : "px-5 py-3",
          )}
        >
          <div>
            {title ? <h2 className="text-base font-semibold">{title}</h2> : null}
            {description ? (
              <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {action}
        </div>
      ) : null}
      <div className={padded ? "p-5" : undefined}>{children}</div>
    </section>
  );
}
