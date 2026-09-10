import { Badge } from "@/components/ui/badge";
import type { PlanogramMatchLine } from "@/lib/demo-planogram-match";
import type { ScanResult } from "@/lib/scan-results";
import { cn } from "@/lib/utils";

type MatchLine = {
  brand: string;
  product: string;
  expected_qty: number;
  detected_qty: number;
  issue_type: PlanogramMatchLine["issue_type"];
  detail?: string;
};

const STATUS_LABEL: Record<PlanogramMatchLine["issue_type"], string> = {
  correct: "Match",
  missing: "Missing",
  wrong_product: "Wrong product",
  qty_mismatch: "Short",
};

const STATUS_CLASS: Record<PlanogramMatchLine["issue_type"], string> = {
  correct: "bg-emerald-50 text-emerald-800 border-emerald-200",
  missing: "bg-destructive/10 text-destructive border-destructive/30",
  wrong_product: "bg-destructive/10 text-destructive border-destructive/30",
  qty_mismatch: "bg-amber-50 text-amber-900 border-amber-200",
};

export function DemoPlanogramMatchCompact({ data }: { data: ScanResult }) {
  const pg = data.planogram;
  if (!pg?.requested) return null;

  const raw = pg.summary?.lines;
  const lines = Array.isArray(raw) ? (raw as MatchLine[]) : [];
  if (!lines.length) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2.5 sm:px-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Planogram
          </p>
          <p className="text-sm font-medium">Expected vs found on shelf</p>
        </div>
        {pg.sku_match_percent != null ? (
          <Badge variant="secondary" className="rounded-full tabular-nums">
            {Math.round(pg.sku_match_percent)}% match
          </Badge>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="bg-background text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium sm:px-4">Product</th>
              <th className="px-3 py-2 font-medium sm:px-4">Expected</th>
              <th className="px-3 py-2 font-medium sm:px-4">Found</th>
              <th className="px-3 py-2 font-medium sm:px-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={`${line.brand}-${line.product}-${i}`} className="border-t border-border">
                <td className="px-3 py-2.5 sm:px-4">
                  <span className="font-medium">{line.brand}</span>
                  <span className="block text-xs text-muted-foreground">{line.product}</span>
                </td>
                <td className="px-3 py-2.5 tabular-nums sm:px-4">{line.expected_qty}</td>
                <td className="px-3 py-2.5 tabular-nums sm:px-4">{line.detected_qty}</td>
                <td className="px-3 py-2.5 sm:px-4">
                  <span
                    className={cn(
                      "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
                      STATUS_CLASS[line.issue_type],
                    )}
                  >
                    {STATUS_LABEL[line.issue_type]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
