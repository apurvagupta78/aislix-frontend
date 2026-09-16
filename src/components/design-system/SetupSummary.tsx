import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

export type SetupSummaryRow = {
  label: string;
  value: string;
  icon?: ReactNode;
};

type Props = {
  title?: string;
  rows: SetupSummaryRow[];
  footer?: ReactNode;
  onEdit?: () => void;
  className?: string;
};

/** Compact “Your setup” panel for multi-step flows. */
export function SetupSummary({
  title = "Your setup",
  rows,
  footer,
  onEdit,
  className,
}: Props) {
  return (
    <aside className={`play-surface rounded-2xl p-5 ${className ?? ""}`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        {onEdit ? (
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={onEdit}>
            Edit
          </Button>
        ) : null}
      </div>
      <dl className="space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start gap-3 text-sm">
            {row.icon ? (
              <span className="mt-0.5 text-muted-foreground">{row.icon}</span>
            ) : null}
            <div className="min-w-0 flex-1">
              <dt className="text-xs text-muted-foreground">{row.label}</dt>
              <dd className="font-medium leading-snug">{row.value}</dd>
            </div>
          </div>
        ))}
      </dl>
      {footer ? <div className="mt-5 border-t border-border pt-4">{footer}</div> : null}
    </aside>
  );
}
