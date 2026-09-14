import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Store,
  TrendingUp,
} from "lucide-react";
import type { ExecutiveScorecards } from "@/lib/audit-executive";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function Card({
  label,
  value,
  hint,
  to,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  to?: string;
  icon: React.ReactNode;
}) {
  const inner = (
    <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-brand/30">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help underline decoration-dotted underline-offset-2">
                {label}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">{hint}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
    </div>
  );
  if (to) {
    return (
      <Link to={to} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
        {inner}
      </Link>
    );
  }
  return inner;
}

export function OperationalScorecards({ data }: { data: ExecutiveScorecards }) {
  const refreshed = new Date(data.last_refreshed_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Operational scorecards
          </h2>
          <p className="text-xs text-muted-foreground">
            This week · Approved outcomes · Last refreshed {refreshed}
          </p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <Card
          label="Audits assigned"
          value={String(data.assigned)}
          hint="Assignments created in the selected period. Not the same as approved."
          to="/assigned-scans"
          icon={<ClipboardList className="size-3.5 text-brand" />}
        />
        <Card
          label="Submitted"
          value={String(data.submitted)}
          hint="Audits submitted for review — distinct from approved."
          to="/assigned-scans"
          icon={<Clock className="size-3.5 text-brand" />}
        />
        <Card
          label="Approved"
          value={String(data.approved)}
          hint="Assignments marked completed or approval_status approved."
          to="/history"
          icon={<CheckCircle2 className="size-3.5 text-accent-green" />}
        />
        <Card
          label="Pending approvals"
          value={String(data.pending_approvals)}
          hint="Audits awaiting manager review."
          to="/assigned-scans"
          icon={<AlertTriangle className="size-3.5 text-warning" />}
        />
        <Card
          label="Overdue audits"
          value={String(data.overdue)}
          hint="Past due date and not completed."
          to="/assigned-scans"
          icon={<Clock className="size-3.5 text-destructive" />}
        />
        <Card
          label="Stores w/ critical variance"
          value={String(data.stores_critical_variance)}
          hint="Stores with ≥₹10k signed line variance in digital audits."
          to="/audit-intelligence"
          icon={<Store className="size-3.5 text-destructive" />}
        />
        <Card
          label="Signed variance value"
          value={`₹${Math.abs(data.signed_variance_inr).toLocaleString("en-IN")}`}
          hint="Sum of signed quantity variance × unit cost. Not confirmed financial loss."
          to="/audit-intelligence"
          icon={<TrendingUp className="size-3.5 text-warning" />}
        />
        <Card
          label="Absolute discrepancy"
          value={`₹${data.absolute_variance_inr.toLocaleString("en-IN")}`}
          hint="Sum of absolute line variance values — shortages and overages do not cancel."
          to="/audit-intelligence"
          icon={<TrendingUp className="size-3.5 text-muted-foreground" />}
        />
        <Card
          label="Planogram compliance"
          value={
            data.planogram_compliance_avg != null
              ? `${Math.round(data.planogram_compliance_avg)}%`
              : "—"
          }
          hint="Average compliance on completed audits in period."
          icon={<CheckCircle2 className="size-3.5 text-brand" />}
        />
        <Card
          label="Open corrective actions"
          value={String(data.open_corrective_actions)}
          hint="Open issues — approving an audit does not auto-close these."
          to="/corrective-actions"
          icon={<WrenchIcon />}
        />
      </div>
    </section>
  );
}

function WrenchIcon() {
  return (
    <svg className="size-3.5 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}
