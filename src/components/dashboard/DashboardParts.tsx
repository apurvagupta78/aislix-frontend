import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  Bell,
  Building2,
  ClipboardList,
  CreditCard,
  Download,
  FileText,
  Gauge,
  History,
  Info,
  Megaphone,
  Package,
  PackageX,
  ScanLine,
  Store,
  Tags,
  Timer,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CardSkeleton, EmptyState, ErrorState, Skeleton } from "@/components/States";
import {
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatQuota,
  formatScore,
  healthTone,
  type AccountSummary,
  type ActivityItem,
  type DashboardKpis,
  type DashboardNotification,
} from "@/lib/dashboard";

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card-surface flex flex-col p-6 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
          {description ? (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="mt-5 flex-1">{children}</div>
    </section>
  );
}

/* ---------------- KPI cards ---------------- */

const toneClass = {
  good: "text-accent-green",
  warn: "text-warning",
  bad: "text-destructive",
  unknown: "text-muted-foreground",
} as const;

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  valueClassName = "",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof ScanLine;
  valueClassName?: string;
}) {
  return (
    <div className="card-surface card-hover p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand">
          <Icon className="size-4" />
        </span>
        {hint && <span className="text-[0.7rem] text-muted-foreground">{hint}</span>}
      </div>
      <p className={`mt-4 text-2xl font-semibold tracking-tight ${valueClassName}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function KpiCards({
  kpis,
  isLoading,
  error,
  onRetry,
}: {
  kpis?: DashboardKpis | undefined;
  isLoading: boolean;
  error?: Error | null | undefined;
  onRetry?: (() => void) | undefined;
}) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <ErrorState
        title="Couldn't load your metrics"
        description={error.message}
        {...(onRetry ? { onRetry } : {})}
      />
    );
  }
  if (!kpis) {
    return (
      <EmptyState
        title="No metrics yet"
        description="Run your first shelf audit to start populating dashboard metrics."
        action={
          <Button asChild variant="brand" size="sm" className="rounded-xl">
            <Link to="/audit">Start an audit</Link>
          </Button>
        }
      />
    );
  }

  const tone = healthTone(kpis.shelf_health_score);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi label="Total audits" value={formatNumber(kpis.total_scans)} icon={ScanLine} />
      <Kpi label="Products detected" value={formatNumber(kpis.products_detected)} icon={Package} />
      <Kpi label="Stores" value={formatNumber(kpis.stores)} icon={Store} />
      <Kpi
        label="Shelf health score"
        value={kpis.shelf_health_score === undefined ? "—" : `${formatScore(kpis.shelf_health_score)}/100`}
        icon={Gauge}
        valueClassName={toneClass[tone]}
      />
      <Kpi
        label="Low stock alerts"
        value={formatNumber(kpis.low_stock_alerts)}
        icon={AlertTriangle}
        valueClassName={kpis.low_stock_alerts ? "text-warning" : ""}
      />
      <Kpi
        label="Out of stock alerts"
        value={formatNumber(kpis.out_of_stock_alerts)}
        icon={PackageX}
        valueClassName={kpis.out_of_stock_alerts ? "text-destructive" : ""}
      />
      <Kpi label="Average AI confidence" value={formatPercent(kpis.average_confidence)} icon={Tags} />
      <Kpi
        label="Audits remaining this month"
        value={formatQuota(kpis.scans_remaining)}
        icon={Timer}
      />
    </div>
  );
}

/* ---------------- Quick actions ---------------- */

const quickActions = [
  {
    to: "/audit",
    title: "Start new audit",
    description: "Capture or upload a shelf photo.",
    icon: ScanLine,
  },
  {
    to: "/history",
    title: "View audit history",
    description: "Review past visits, issues and results.",
    icon: History,
  },
  {
    to: "/compare",
    title: "Compare audits",
    description: "See what changed between visits.",
    icon: ArrowLeftRight,
  },
  {
    to: "/report",
    title: "Download reports",
    description: "Export audit reports and detailed data.",
    icon: FileText,
  },
  {
    to: "/stores",
    title: "Manage stores",
    description: "Add outlets and track store performance.",
    icon: Building2,
  },
  {
    to: "/settings",
    title: "Manage users",
    description: "Invite teammates and manage access.",
    icon: Users,
  },
  {
    to: "/audit",
    title: "Import master shelf setup",
    description: "Upload a role-specific master setup and configure an audit faster.",
    icon: ClipboardList,
  },
] as const;

export function QuickActions() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {quickActions.map((a) => (
        <Link
          key={a.to}
          to={a.to}
          className="card-surface card-hover group flex items-start gap-4 p-5"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
            <a.icon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              {a.title}
              <ArrowRight className="size-3.5 text-brand opacity-0 transition-opacity group-hover:opacity-100" />
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{a.description}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

/* ---------------- Recent activity ---------------- */

const activityIcon = {
  scan_completed: ScanLine,
  pdf_downloaded: Download,
  store_added: Building2,
  user_invited: UserPlus,
  subscription_upgraded: CreditCard,
} as const;

export function ActivityTimeline({
  items,
  isLoading,
  error,
  onRetry,
}: {
  items?: ActivityItem[] | undefined;
  isLoading: boolean;
  error?: Error | null | undefined;
  onRetry?: (() => void) | undefined;
}) {
  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="size-8 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <ErrorState
        title="Couldn't load activity"
        description={error.message}
        {...(onRetry ? { onRetry } : {})}
      />
    );
  }
  if (!items || items.length === 0) {
    return (
      <EmptyState
        title="No activity yet"
        description="Audits, downloads, store changes and team invites will appear here."
      />
    );
  }

  return (
    <ol className="relative space-y-5 before:absolute before:left-4 before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-border">
      {items.map((item) => {
        const Icon = activityIcon[item.kind] ?? Bell;
        return (
          <li key={item.id} className="relative flex gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-xl border border-border bg-card text-brand">
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
              {item.description && (
                <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
              )}
              <p className="mt-1 text-[0.7rem] text-muted-foreground">
                {formatDateTime(item.created_at)}
                {item.actor ? ` · ${item.actor}` : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------------- Notifications ---------------- */

const notificationIcon = {
  low_stock: AlertTriangle,
  confidence_warning: Gauge,
  subscription: CreditCard,
  announcement: Megaphone,
} as const;

const severityClass = {
  critical: "bg-destructive/10 text-destructive",
  warning: "bg-warning/12 text-warning",
  info: "bg-brand-soft text-brand",
} as const;

export function NotificationsPanel({
  items,
  isLoading,
  error,
  onRetry,
}: {
  items?: DashboardNotification[] | undefined;
  isLoading: boolean;
  error?: Error | null | undefined;
  onRetry?: (() => void) | undefined;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <ErrorState
        title="Couldn't load notifications"
        description={error.message}
        {...(onRetry ? { onRetry } : {})}
      />
    );
  }
  if (!items || items.length === 0) {
    return (
      <EmptyState
        title="You're all caught up"
        description="Stock alerts, confidence warnings and announcements will show up here."
        icon={<Bell className="size-5" />}
      />
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((n) => {
        const Icon = notificationIcon[n.kind] ?? Info;
        const tone = severityClass[n.severity ?? "info"];
        const body = (
          <div className="flex gap-3 rounded-xl border border-border bg-surface p-3.5 transition-colors hover:border-brand/30">
            <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${tone}`}>
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{n.title}</p>
              {n.message && <p className="mt-0.5 text-xs text-muted-foreground">{n.message}</p>}
              {n.created_at && (
                <p className="mt-1 text-[0.7rem] text-muted-foreground">
                  {formatDateTime(n.created_at)}
                </p>
              )}
            </div>
            {!n.read && <span className="mt-1 size-2 shrink-0 rounded-full bg-brand" />}
          </div>
        );
        return <li key={n.id}>{body}</li>;
      })}
    </ul>
  );
}

/* ---------------- Account summary ---------------- */

export function AccountSummaryPanel({
  account,
  isLoading,
  error,
  onRetry,
}: {
  account?: AccountSummary | undefined;
  isLoading: boolean;
  error?: Error | null | undefined;
  onRetry?: (() => void) | undefined;
}) {
  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-full rounded-xl" />
      </div>
    );
  }
  if (error) {
    return (
      <ErrorState
        title="Couldn't load your plan"
        description={error.message}
        {...(onRetry ? { onRetry } : {})}
      />
    );
  }
  if (!account) {
    return (
      <EmptyState
        title="No subscription details"
        description="Plan and usage details appear once your workspace is provisioned."
        icon={<AlertOctagon className="size-5" />}
      />
    );
  }

  const included = account.scans_included;
  const used = account.scans_used;
  const pct =
    included && included > 0 && typeof used === "number"
      ? Math.min(100, Math.round((used / included) * 100))
      : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Current plan</p>
          <p className="mt-0.5 text-lg font-semibold tracking-tight text-foreground">
            {account.plan_name ?? "—"}
          </p>
        </div>
        {account.status && (
          <Badge variant="secondary" className="rounded-full capitalize">
            {account.status.replace(/_/g, " ")}
          </Badge>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Audits used</span>
          <span className="font-medium text-foreground">
            {formatNumber(used)} / {formatQuota(included)}
          </span>
        </div>
        <Progress value={pct ?? 0} className="mt-2 h-1.5" />
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border border-border bg-surface p-3">
          <dt className="text-xs text-muted-foreground">Audits remaining</dt>
          <dd className="mt-1 font-semibold text-foreground">
            {formatQuota(account.scans_remaining)}
          </dd>
        </div>
        <div className="rounded-xl border border-border bg-surface p-3">
          <dt className="text-xs text-muted-foreground">Renewal date</dt>
          <dd className="mt-1 font-semibold text-foreground">{formatDate(account.renewal_date)}</dd>
        </div>
      </dl>

      <Button asChild variant="brand" className="w-full rounded-xl">
        <Link to="/billing">Upgrade plan</Link>
      </Button>
    </div>
  );
}
