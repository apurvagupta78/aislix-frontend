import { useState } from "react";

import { MpCard, MpCardHeader } from "@/components/design-system/MpCard";
import { ChartUnavailable } from "@/components/corrective-actions/CaCharts";
import { Button } from "@/components/ui/button";
import {
  VARIANCE_TYPES,
  type StoreVarianceRow,
  type VarianceType,
} from "@/lib/corrective-action-insights";
import { cn } from "@/lib/utils";

const PAGE = 10;

/** Stores down, variance types across; every count opens the matching actions. */
export function StoreVarianceMatrix({
  rows,
  totals,
  onSelect,
  description = "What went wrong in each store — click a number to see those actions.",
  className,
}: {
  rows: StoreVarianceRow[];
  totals: Record<VarianceType, number>;
  onSelect: (storeId: string | null, type: VarianceType | null) => void;
  description?: string;
  className?: string;
}) {
  const [visible, setVisible] = useState(PAGE);
  const columns = VARIANCE_TYPES.filter((t) => totals[t.value] > 0);
  const grand = columns.reduce((s, c) => s + totals[c.value], 0);

  const cell = (count: number, storeId: string | null, type: VarianceType | null, label: string, strong = false) =>
    count > 0 ? (
      <button
        type="button"
        onClick={() => onSelect(storeId, type)}
        className={cn(
          "min-w-8 rounded-md px-2 py-1 tabular-nums text-navy transition-colors hover:bg-[#F4F7F9] hover:underline",
          strong && "font-semibold",
        )}
        aria-label={label}
      >
        {count}
      </button>
    ) : (
      <span className="px-2 text-mp-muted" aria-hidden>
        —
      </span>
    );

  return (
    <MpCard className={cn("overflow-hidden", className)}>
      <MpCardHeader title="Variances by store and type" description={description} />
      {!rows.length || !grand ? (
        <div className="px-4 pb-4 pt-3 md:px-5">
          <ChartUnavailable reason="No corrective actions in these filters." />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-mp-muted">
                <th className="px-4 py-2 font-medium md:px-5">Store</th>
                {columns.map((c) => (
                  <th key={c.value} className="px-1 py-2 text-center font-medium">
                    {c.label}
                  </th>
                ))}
                <th className="px-1 py-2 text-center font-medium">Total</th>
                <th className="py-2 pr-4 text-center font-medium">Not fixed</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, visible).map((r) => (
                <tr key={r.storeId ?? "none"} className="border-b border-[#EEF1F4]">
                  <td className="px-4 py-1.5 md:px-5">
                    <span className="block max-w-[200px] truncate font-medium text-navy" title={r.store}>
                      {r.store}
                    </span>
                  </td>
                  {columns.map((c) => (
                    <td key={c.value} className="px-1 py-1.5 text-center">
                      {cell(r.counts[c.value], r.storeId, c.value, `${r.counts[c.value]} ${c.label} actions in ${r.store}`)}
                    </td>
                  ))}
                  <td className="px-1 py-1.5 text-center">
                    {cell(r.total, r.storeId, null, `All ${r.total} actions in ${r.store}`, true)}
                  </td>
                  <td className="py-1.5 pr-4 text-center">
                    <span className="inline-flex items-center gap-1.5 tabular-nums text-navy">
                      {r.open > 0 ? <span className="size-1.5 rounded-full bg-[#F6CFDC]" aria-hidden /> : null}
                      {r.open}
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="bg-white text-xs">
                <td className="px-4 py-2 font-semibold text-navy md:px-5">All stores</td>
                {columns.map((c) => (
                  <td key={c.value} className="px-1 py-2 text-center">
                    {cell(totals[c.value], null, c.value, `All ${c.label} actions`, true)}
                  </td>
                ))}
                <td className="px-1 py-2 text-center">{cell(grand, null, null, "All actions", true)}</td>
                <td className="py-2 pr-4 text-center tabular-nums text-navy">
                  {rows.reduce((s, r) => s + r.open, 0)}
                </td>
              </tr>
            </tbody>
          </table>
          {rows.length > visible ? (
            <div className="border-t border-line p-3 text-center">
              <Button variant="outline" size="sm" onClick={() => setVisible((v) => v + PAGE)}>
                Show more stores ({rows.length - visible} left)
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </MpCard>
  );
}
