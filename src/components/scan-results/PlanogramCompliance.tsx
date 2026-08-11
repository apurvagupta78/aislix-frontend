import { ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  SUMMARY_TILES,
  complianceTone,
  issueLabel,
  issueRowClass,
  summaryCounts,
  type PlanogramComparison,
} from "@/lib/planogram-compliance";

/** "Planogram vs Actual" — only rendered for scans launched from an assignment. */
export function PlanogramComparisonSection({ comparison }: { comparison: PlanogramComparison }) {
  const percent = comparison.compliance_percent;
  const counts = summaryCounts(comparison.summary);
  return (
    <section className="card-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
            <ClipboardCheck className="size-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Planogram vs Actual</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Assigned shelf compared against the active planogram.
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Planogram compliance</p>
          <p className={`text-2xl font-semibold ${complianceTone(percent)}`}>
            {percent === null ? "—" : `${Math.round(percent)}%`}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {SUMMARY_TILES.map((tile) => {
          const value = counts[tile.key];
          return (
            <div key={tile.key} className="rounded-xl border border-border bg-surface p-3">
              <p className="text-xs text-muted-foreground">{tile.label}</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{value ?? "—"}</p>
            </div>
          );
        })}
      </div>

      {comparison.lines.length > 0 && (
        <div className="mt-5 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Expected product</th>
                <th className="px-3 py-2 font-medium">Actual</th>
                <th className="px-3 py-2 font-medium">Expected qty</th>
                <th className="px-3 py-2 font-medium">Actual qty</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Issue</th>
              </tr>
            </thead>
            <tbody>
              {comparison.lines.map((line) => (
                <tr
                  key={line.id}
                  className={`border-t border-border ${issueRowClass(line.issue_type)}`}
                >
                  <td className="px-3 py-2">
                    <span className="font-medium text-foreground">
                      {line.expected_product ?? "—"}
                    </span>
                    {line.expected_brand && (
                      <span className="block text-xs text-muted-foreground">
                        {line.expected_brand}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-foreground">{line.actual_product ?? "—"}</span>
                    {line.actual_brand && (
                      <span className="block text-xs text-muted-foreground">
                        {line.actual_brand}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{line.expected_qty ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{line.actual_qty ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary" className="rounded-full border-0">
                      {issueLabel(line.issue_type)}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{line.detail ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {comparison.actions.length > 0 && (
        <div className="mt-4 rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-foreground">Corrective actions</p>
          <ul className="mt-2 space-y-2">
            {comparison.actions.map((action) => (
              <li key={action.id} className="flex gap-2 text-sm text-muted-foreground">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" />
                <span>
                  <span className="font-medium text-foreground">
                    {issueLabel(action.issue_type)}:
                  </span>{" "}
                  {action.suggestion}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
