import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** MP-style table container with optional header row. */
export function MpTableShell({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-line bg-white shadow-card", className)}>
      {title || description || action ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3 md:px-5">
          <div className="min-w-0">
            {title ? (
              <h2 className="font-display text-[15px] font-semibold leading-tight text-navy">{title}</h2>
            ) : null}
            {description ? <p className="mt-1 text-[13px] text-mp-muted">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

/** Standard MP thead styling for raw HTML tables. */
export function mpTableClassName() {
  return "w-full min-w-[48rem] text-sm";
}

export function mpTableHeadClassName() {
  return "bg-canvas text-left text-[11px] font-bold uppercase tracking-[0.08em] text-mp-muted";
}

export function mpTableRowClassName() {
  return "border-t border-line hover:bg-canvas/60";
}

export function mpTableCellClassName() {
  return "px-3 py-2.5 text-navy";
}
