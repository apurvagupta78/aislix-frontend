import { AlertTriangle, ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  SUMMARY_TILES,
  complianceTone,
  issueBadgeClass,
  issueLabel,
  issueRowClass,
  summaryCounts,
  type PlanogramComparison,
} from "@/lib/planogram-compliance";

/**
 * "Planogram compliance" — rendered for any scan that carried expected products,
 * whether from an assignment or the ad-hoc Option 2 flow on the New Scan page.
 */
export function PlanogramComparisonSection({ comparison }: { comparison: PlanogramComparison }) {
  const percent = comparison.compliance_percent;
  const counts = summaryCounts(comparison.summary);
  const found = counts["found"];
  const expected = counts["expected"];
  return (
    <section className="card-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
            <ClipboardCheck className="size-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Planogram compliance</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {percent === null ? "—" : `${Math.round(percent)}%`}
              {expected !== null && found !== null
                ? ` · ${found} of ${expected} expected products correct`
                : " · expected SKU list compared against the shelf"}
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
        {SUMMARY_TILES.map((tile) => (
          <div key={tile.key} className="rounded-xl border border-border bg-surface p-3">
            <p className="text-xs text-muted-foreground">{tile.label}</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{counts[tile.key] ?? "—"}</p>
          </div>
        ))}
      </div>

      {comparison.lines.length > 0 && (
        <div className="mt-5 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Expected brand</th>
                <th className="px-3 py-2 font-medium">Expected product</th>
                <th className="px-3 py-2 font-medium">Expected qty</th>
                <th className="px-3 py-2 font-medium">Actual brand</th>
                <th className="px-3 py-2 font-medium">Actual product</th>
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
                  <td className="px-3 py-2 text-muted-foreground">{line.expected_brand ?? "—"}</td>
                  <td className="px-3 py-2 font-medium text-foreground">
                    {line.expected_product ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{line.expected_qty ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{line.actual_brand ?? "—"}</td>
                  <td className="px-3 py-2 text-foreground">{line.actual_product ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{line.actual_qty ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Badge
                      variant="secondary"
                      className={`rounded-full border-0 ${issueBadgeClass(line.issue_type)}`}
                    >
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
              <li key={action.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Badge
                  variant="secondary"
                  className={`rounded-full border-0 ${issueBadgeClass(action.issue_type)}`}
                >
                  {issueLabel(action.issue_type)}
                </Badge>
                <span className="text-muted-foreground">{action.suggestion}</span>
                <Badge variant="outline" className="rounded-full text-xs capitalize">
                  {action.status}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Shown when an audit was run "with planogram" but no comparison came back. */
export function PlanogramMissingAlert({ demoMode = false }: { demoMode?: boolean }) {
  const detail = demoMode
    ? "Add at least one expected product with brand, product name, and expected facings in Products & prices above, then re-audit."
    : "Link this audit to expected products before auditing — add rows in Products & prices on the New Audit page (Option 2), or assign from a planogram library entry.";
  return (
    <section
      role="alert"
      className="card-surface flex items-start gap-3 border-warning/40 bg-warning/5 p-4 sm:p-6"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-warning/15 text-warning">
        <AlertTriangle className="size-4" />
      </span>
      <div>
        <h2 className="text-sm font-semibold tracking-tight">Planogram compliance unavailable</h2>
        <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
      </div>
    </section>
  );
}
