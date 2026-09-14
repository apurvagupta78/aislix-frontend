import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { SeverityBadge } from "@/components/audit/AuditStatusBadges";
import { AssignOwnerDialog } from "@/components/exceptions/AssignOwnerDialog";
import type { ActionRequiredItem } from "@/lib/audit-executive";
import { fetchExceptionById, type ExceptionRecord } from "@/lib/exceptions";

export function ActionRequiredQueue({ items }: { items: ActionRequiredItem[] }) {
  const [assignId, setAssignId] = useState<string | null>(null);

  const exceptionQuery = useQuery({
    queryKey: ["exception-for-assign", assignId],
    queryFn: () => fetchExceptionById(assignId!),
    enabled: Boolean(assignId),
  });
  if (!items.length) {
    return (
      <section className="rounded-xl border border-border bg-card p-6 text-center">
        <p className="text-sm font-medium">No exceptions requiring action</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Critical variances, pending approvals, and overdue work appear here first.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Action required
        </h2>
        <p className="text-xs text-muted-foreground">
          Exception-first queue — investigate, review, or assign from here.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Severity</th>
              <th className="p-3">Location / SKU</th>
              <th className="p-3">Issue</th>
              <th className="p-3">Impact</th>
              <th className="p-3">Owner / due</th>
              <th className="p-3">Evidence</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="border-b border-border/60 hover:bg-surface/50">
                <td className="p-3">
                  <SeverityBadge tier={row.severity} />
                </td>
                <td className="p-3">
                  <p className="font-medium">{row.store_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.shelf_label} · {row.sku_label}
                  </p>
                </td>
                <td className="p-3 text-muted-foreground">{row.issue}</td>
                <td className="p-3 tabular-nums">{row.impact}</td>
                <td className="p-3 text-xs text-muted-foreground">
                  {row.owner}
                  <br />
                  {row.age_due}
                </td>
                <td className="p-3 capitalize text-xs">{row.evidence_state}</td>
                <td className="p-3 text-right">
                  <div className="flex justify-end gap-2">
                    {row.next_action === "review" && row.scan_id ? (
                      <Button asChild size="sm" variant="default">
                        <Link to="/audit-review/$scanId" params={{ scanId: row.scan_id }}>
                          Review
                        </Link>
                      </Button>
                    ) : row.scan_id ? (
                      <Button asChild size="sm" variant="outline">
                        <Link to="/audit-review/$scanId" params={{ scanId: row.scan_id }}>
                          Investigate
                        </Link>
                      </Button>
                    ) : null}
                    <Button asChild size="sm" variant="ghost">
                      <Link to="/exceptions/$exceptionId" params={{ exceptionId: row.id }}>
                        Open
                      </Link>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setAssignId(row.id)}>
                      Assign owner
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AssignOwnerDialog
        exception={(exceptionQuery.data as ExceptionRecord | null) ?? null}
        open={Boolean(assignId)}
        onOpenChange={(open) => !open && setAssignId(null)}
      />
    </section>
  );
}
