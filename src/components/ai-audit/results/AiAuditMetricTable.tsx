import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type MetricColumn<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
};

export function statusBadge(status: unknown, className?: string) {
  const normalized = String(status ?? "").toUpperCase();
  let tone = "border-border text-muted-foreground";
  if (
    normalized.includes("COMPLIANT") &&
    !normalized.includes("NON") &&
    !normalized.includes("PARTIAL")
  ) {
    tone = "border-emerald-500/40 bg-emerald-500/5 text-emerald-700";
  } else if (
    normalized.includes("NOT_FOUND") ||
    normalized.includes("NON_COMPLIANT") ||
    normalized.includes("MISMATCHED") ||
    normalized.includes("BELOW_MINIMUM") ||
    normalized.includes("HIGH_PRIORITY")
  ) {
    tone = "border-rose-500/40 bg-rose-500/5 text-rose-700";
  } else if (
    normalized.includes("PARTIAL") ||
    normalized.includes("BELOW") ||
    normalized.includes("ABOVE") ||
    normalized.includes("WRONG") ||
    normalized.includes("REDUCED")
  ) {
    tone = "border-amber-500/40 bg-amber-500/5 text-amber-700";
  } else if (normalized.includes("MATCHED") || normalized.includes("IDENTIFIED") || normalized.includes("CORRECT")) {
    tone = "border-emerald-500/40 bg-emerald-500/5 text-emerald-700";
  }
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap text-[10px]", tone, className)}>
      {String(status || "—")}
    </Badge>
  );
}

export function pctCell(value: number | null | undefined) {
  if (value == null) return "—";
  return `${Math.round(value)}%`;
}

export function confCell(value: number | undefined) {
  if (!value) return "—";
  return `${Math.round(value <= 1 ? value * 100 : value)}%`;
}

export function AiAuditMetricTable<T>({
  columns,
  rows,
  rowKey,
  caption,
}: {
  columns: MetricColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  caption?: string;
}) {
  if (!rows.length) return null;
  return (
    <div className="overflow-x-auto rounded-lg border border-border/70">
      {caption ? (
        <p className="border-b border-border/60 px-3 py-2 text-[11px] text-muted-foreground">{caption}</p>
      ) : null}
      <table className="min-w-full text-left text-xs">
        <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={cn("px-2 py-2 whitespace-nowrap", col.className)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={rowKey(row, index)} className="border-t border-border/60 align-top hover:bg-muted/20">
              {columns.map((col) => (
                <td key={col.key} className={cn("px-2 py-2", col.className)}>
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
