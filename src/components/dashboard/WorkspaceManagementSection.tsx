import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ClipboardCheck,
  LayoutGrid,
  Store,
  Users,
} from "lucide-react";
import type {
  AssignedAuditStatusKey,
  WorkspaceManagementData,
} from "@/lib/dashboard-workspace-management";
import { cn } from "@/lib/utils";

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function planogramStatusClass(status: string): string {
  if (status === "Active") return "bg-accent-green/10 text-accent-green ring-accent-green/15";
  if (status === "Draft") return "bg-muted/50 text-muted-foreground ring-border/50";
  return "bg-muted/40 text-muted-foreground ring-border/40";
}

function auditStatusClass(key: AssignedAuditStatusKey): string {
  if (key === "completed") return "bg-accent-green/10 text-accent-green ring-accent-green/15";
  if (key === "needs_action") return "bg-amber-500/10 text-amber-700 ring-amber-500/15";
  if (key === "cancelled") return "bg-muted/40 text-muted-foreground ring-border/40";
  return "bg-brand-soft/60 text-brand ring-brand/10";
}

function teamStatusClass(status: string): string {
  if (status === "Active") return "bg-accent-green/10 text-accent-green ring-accent-green/15";
  if (status === "Invited") return "bg-brand-soft/60 text-brand ring-brand/10";
  return "bg-muted/40 text-muted-foreground ring-border/40";
}

function StatusChip({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset",
        className,
      )}
    >
      {label}
    </span>
  );
}

function CardShell({
  icon: Icon,
  title,
  description,
  countLabel,
  count,
  footerLabel,
  footerTo,
  footerSearch,
  hideCount,
  children,
}: {
  icon: typeof LayoutGrid;
  title: string;
  description: string;
  countLabel: string;
  count: number;
  footerLabel: string;
  footerTo: string;
  footerSearch?: Record<string, string>;
  hideCount?: boolean;
  children: ReactNode;
}) {
  return (
    <article className="group flex h-full min-h-[280px] flex-col rounded-2xl border border-border/60 bg-card p-4 shadow-sm transition-colors hover:border-brand/25 hover:bg-brand-soft/10">
      <div className="flex items-start gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft/50 text-brand">
          <Icon className="size-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight text-brand">{title}</h3>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{description}</p>
        </div>
      </div>

      {!hideCount ? (
        <p className="mt-3 text-xs text-muted-foreground">
          <span className="text-lg font-semibold tabular-nums text-foreground">{count}</span>{" "}
          {countLabel}
        </p>
      ) : null}

      <div className="mt-3 min-h-[120px] flex-1">{children}</div>

      <Link
        to={footerTo}
        search={footerSearch}
        className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-brand transition-transform group-hover:translate-x-0.5"
      >
        {footerLabel}
        <ArrowRight className="size-3.5" />
      </Link>
    </article>
  );
}

function PlanogramsCard({ data }: { data: WorkspaceManagementData["planograms"] }) {
  const empty = data.count === 0;
  return (
    <CardShell
      icon={LayoutGrid}
      title="Your Planograms"
      description="View and manage the shelf setups your team uses for audits."
      count={data.count}
      countLabel={data.count === 1 ? "planogram" : "planograms"}
      hideCount={empty}
      footerLabel={empty ? "Add planogram →" : "View all planograms →"}
      footerTo="/store-master"
    >
      {empty ? (
        <p className="text-xs text-muted-foreground">
          Your planograms will appear here once you add one.
        </p>
      ) : (
        <ul className="space-y-2">
          {data.recent.map((row) => (
            <li key={row.id} className="flex items-start justify-between gap-2 text-xs">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{row.name}</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {[row.store_name, row.category].filter(Boolean).join(" · ")}
                </p>
              </div>
              <StatusChip label={row.status} className={planogramStatusClass(row.status)} />
            </li>
          ))}
        </ul>
      )}
    </CardShell>
  );
}

function StoresCard({ data }: { data: WorkspaceManagementData["stores"] }) {
  const empty = data.count === 0;
  return (
    <CardShell
      icon={Store}
      title="Your Stores"
      description="View the stores and outlets covered by your workspace."
      count={data.count}
      countLabel={data.count === 1 ? "store" : "stores"}
      hideCount={empty}
      footerLabel={empty ? "Add store →" : "View all stores →"}
      footerTo="/stores"
    >
      {empty ? (
        <p className="text-xs text-muted-foreground">No stores added yet.</p>
      ) : (
        <ul className="space-y-2">
          {data.recent.map((row) => (
            <li key={row.id} className="flex items-start justify-between gap-2 text-xs">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{row.name}</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {[row.city, row.country].filter(Boolean).join(", ") || "—"}
                  {row.audit_count != null ? ` · ${row.audit_count} audit${row.audit_count === 1 ? "" : "s"}` : ""}
                </p>
              </div>
              {row.status ? (
                <StatusChip
                  label={row.status === "Active" ? "Active" : row.status}
                  className={planogramStatusClass(row.status === "Active" ? "Active" : "Draft")}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </CardShell>
  );
}

function TeamCard({ data }: { data: WorkspaceManagementData["team"] }) {
  const empty = data.count <= 1;
  return (
    <CardShell
      icon={Users}
      title="Your Team"
      description="Manage team members, assignments and access to Aislix."
      count={data.count}
      countLabel={data.count === 1 ? "team member" : "team members"}
      footerLabel={empty ? "Invite team members →" : "Manage team →"}
      footerTo="/team"
    >
      {empty ? (
        <p className="text-xs text-muted-foreground">You&apos;re the only workspace member.</p>
      ) : (
        <ul className="space-y-2">
          {data.recent.map((row) => (
            <li key={row.user_id} className="flex items-start justify-between gap-2 text-xs">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{row.name}</p>
                <p className="truncate text-[10px] text-muted-foreground">{row.role}</p>
              </div>
              <StatusChip label={row.status} className={teamStatusClass(row.status)} />
            </li>
          ))}
        </ul>
      )}
    </CardShell>
  );
}

function AssignedAuditsCard({ data }: { data: WorkspaceManagementData["assigned_audits"] }) {
  const total = data.completed + data.in_progress + data.needs_action;
  const empty = total === 0;
  return (
    <CardShell
      icon={ClipboardCheck}
      title="Audits You Assigned"
      description="Track the audits you've assigned and see what is completed, in progress or still waiting."
      count={total}
      countLabel="assigned"
      hideCount={empty}
      footerLabel={empty ? "Assign an audit →" : "View assigned audits →"}
      footerTo={empty ? "/assign-scan" : "/assigned-scans"}
      footerSearch={empty ? undefined : { assigner: "me" }}
    >
      {empty ? (
        <p className="text-xs text-muted-foreground">No audits assigned yet.</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
            <span className="text-muted-foreground">
              Completed{" "}
              <span className="font-semibold tabular-nums text-accent-green">{data.completed}</span>
            </span>
            <span className="text-muted-foreground">
              In progress{" "}
              <span className="font-semibold tabular-nums text-brand">{data.in_progress}</span>
            </span>
            <span className="text-muted-foreground">
              Needs action{" "}
              <span className="font-semibold tabular-nums text-amber-700">{data.needs_action}</span>
            </span>
          </div>
          <ul className="space-y-2">
            {data.recent.map((row) => (
              <li key={row.id} className="flex items-start justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{row.store_name}</p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {[row.category, row.assigned_to, formatShortDate(row.date)].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <StatusChip label={row.status} className={auditStatusClass(row.status_key)} />
              </li>
            ))}
          </ul>
        </>
      )}
    </CardShell>
  );
}

export function WorkspaceManagementSection({ data }: { data: WorkspaceManagementData }) {
  return (
    <section className="mt-8">
      <div className="mb-4">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Workspace
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage the setup, people and audits behind your retail operation.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PlanogramsCard data={data.planograms} />
        <StoresCard data={data.stores} />
        <TeamCard data={data.team} />
        <AssignedAuditsCard data={data.assigned_audits} />
      </div>
    </section>
  );
}
