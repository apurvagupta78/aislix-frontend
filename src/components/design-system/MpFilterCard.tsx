import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** MP-style filter surface — white card with optional section label. */
export function MpFilterCard({
  title = "Filters",
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-line bg-white shadow-card", className)}>
      {title ? (
        <div className="border-b border-line px-4 py-3 md:px-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-mp-muted">{title}</p>
        </div>
      ) : null}
      <div className="p-3 md:p-4">{children}</div>
    </div>
  );
}
